import * as d3 from "d3"
import * as Vidyano from "../../libs/vidyano/vidyano.js"
import * as Polymer from "../../libs/polymer/polymer.js"
import { ISize } from "../size-tracker/size-tracker.js"
import { Scroller } from "../scroller/scroller.js"
import { WebComponent } from "../web-component/web-component.js"

type ProfilerRequest = Vidyano.Dto.ProfilerRequest & {
    hasNPlusOne: boolean;
    parameters: {
        key: string;
        value: string;
    }[];
    flattenedEntries: FlattenedProfilerRequestEntry[];
}

type FlattenedProfilerRequestEntry = {
    entry: Vidyano.Dto.ProfilerEntry;
    level: number;
}

@WebComponent.register({
    properties: {
        service: Object,
        awaiting: {
            type: String,
            value: "Awaiting next request..."
        },
        profiledRequests: {
            type: Array,
            computed: "service.profiledRequests",
            observer: "_profiledRequestsChanged"
        },
        lastRequest: {
            type: Object,
            readOnly: true,
            value: null
        },
        selectedRequest: {
            type: Object,
            readOnly: true,
            observer: "_selectedRequestChanged"
        },
        hoveredEntry: {
            type: Object,
            readOnly: true,
            value: null
        },
        selectedEntry: {
            type: Object,
            readOnly: true,
            value: null,
            observer: "_selectedEntryChanged"
        },
        timelineSize: Object,
        zoom: {
            type: Number,
            readOnly: true,
            value: 1
        }
    },
    forwardObservers: [
        "service.profile",
        "service.profiledRequests"
    ],
    observers: [
        "_renderRequestTimeline(selectedRequest, timelineSize, zoom)"
    ]
})
export class Profiler extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="profiler.html">`; }

    private _boundMousehweel = this._onMousewheel.bind(this);
    readonly lastRequest: ProfilerRequest; private _setLastRequest: (request: Vidyano.Dto.ProfilerRequest) => void;
    readonly selectedRequest: ProfilerRequest; private _setSelectedRequest: (request: Vidyano.Dto.ProfilerRequest) => void;
    readonly hoveredEntry: Vidyano.Dto.ProfilerEntry; private _setHoveredEntry: (entry: Vidyano.Dto.ProfilerEntry) => void;
    readonly selectedEntry: Vidyano.Dto.ProfilerEntry; private _setSelectedEntry: (entry: Vidyano.Dto.ProfilerEntry) => void;
    readonly zoom: number; private _setZoom: (value: number) => void;
    timelineSize: ISize;
    profiledRequests: ProfilerRequest[];

    connectedCallback() {
        super.connectedCallback();

        this.$.timeline.addEventListener("DOMMouseScroll", this._boundMousehweel);
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.$.timeline.removeEventListener("DOMMouseScroll", this._boundMousehweel);
    }

    private _requestSQL(request: ProfilerRequest): string {
        return request.profiler.sql ? this._ms(request.profiler.sql.reduce((current, entry) => current + entry.elapsedMilliseconds, 0)) : "0ms";
    }

    private _requestSharpSQL(request: ProfilerRequest): string {
        return (request.profiler.sql ? request.profiler.sql.length : 0).toString();
    }

    private _requestHasWarnings(request: ProfilerRequest): boolean {
        return request.hasNPlusOne || (request.profiler.exceptions && request.profiler.exceptions.length > 0);
    }

    private _hasNPlusOne(request: Vidyano.Dto.ProfilerRequest, entries: Vidyano.Dto.ProfilerEntry[] = request.profiler.entries): boolean {
        if (!entries)
            return false;

        let hasNPlusOne = false;
        entries.forEach(entry => {
            const counts = entry.sql.groupBy(commandId => request.profiler.sql.find(s => s.commandId === commandId).commandText);
            if (counts.find(c => c.value.length > 1))
                entry.hasNPlusOne = hasNPlusOne = true;

            if (entry.entries && entry.entries.length > 0)
                hasNPlusOne = this._hasNPlusOne(request, entry.entries) || hasNPlusOne;
        });

        return hasNPlusOne;
    }

    private _onMousewheel(e: any) {
        const scroller = <Scroller>this.$.timelineScroller;

        const rect = scroller.getBoundingClientRect();
        const offsetX = e.pageX - rect.left - window.pageXOffset;
        const mousePctg = 1 / scroller.outerWidth * offsetX;

        const isZoomIn = (e.wheelDelta || -e.detail) > 0;
        const newZoom = Math.max(isZoomIn ? this.zoom * 1.1 : this.zoom / 1.1, 1);
        const newInnerWidth = (this.timelineSize.width - 2) * newZoom;

        this._setZoom(newZoom);

        scroller.horizontalScrollOffset = (newInnerWidth - scroller.outerWidth) * mousePctg;
    }

    private _selectRequest(e: Polymer.Gestures.TapEvent) {
        this._setSelectedRequest(e.model.request);
    }

    private _selectedRequestChanged() {
        this._setZoom(1);
        this._setSelectedEntry(null);
    }

    private _profiledRequestsChanged(profiledRequests: ProfilerRequest[] = []) {
        profiledRequests.forEach(request => {
            if (request.hasNPlusOne === undefined)
                request.hasNPlusOne = this._hasNPlusOne(request);

            if (request.parameters === undefined) {
                request.parameters = [];

                switch (request.method) {
                    case "GetPersistentObject": {
                        if (request.response.result != null) {
                            request.parameters.push({ key: "Type", value: request.response.result.type});
                            request.parameters.push({ key: "Id", value: request.response.result.objectId});
                        }

                        break;
                    }

                    case "GetQuery": {
                        if (request.response.result != null)
                            request.parameters.push({ key: "Name", value: request.response.query.name});

                        break;
                    }

                    case "ExecuteAction": {
                        request.parameters.push({ key: "Name", value: request.request.action});
                        break;
                    }

                    case "ExecuteQuery": {
                        request.parameters.push({ key: "Name", value: request.request.query.name});
                        request.parameters.push({ key: "PageSize", value: request.request.query.pageSize});

                        if (request.request.query.top)
                            request.parameters.push({ key: "Top", value: request.request.query.top});
                        if (request.request.query.skip)
                            request.parameters.push({ key: "Skip", value: request.request.query.skip});

                        break;
                    }
                }
            }
        });

        this._setSelectedRequest(profiledRequests[0]);
        this._setLastRequest(profiledRequests[0]);
    }

    private _renderRequestTimeline(request: ProfilerRequest, size: ISize, zoom: number) {
        const width = (size.width - 2) * zoom; // Strip vi-scroller borders
        const style = getComputedStyle(this);
        const headerHeight = parseInt(style.getPropertyValue("--vi-profiler-header-height"));
        const entryHeight = parseInt(style.getPropertyValue("--vi-profiler-entry-height"));
        const entryLevelGap = parseInt(style.getPropertyValue("--vi-profiler-entry-level-gap"));
        const scale = d3.scaleLinear().domain([0, request.profiler.elapsedMilliseconds]).range([0, width]);

        const svg = d3.select(this.$.timeline).
            attr("width", width).
            attr("height", size.height);

        // Render entries
        let entriesGroup = svg.select(".entries");
        if (entriesGroup.empty())
            entriesGroup = svg.append("g").classed("entries", true);

        const entryGroupSelection = entriesGroup.selectAll("g.entry").data(request.flattenedEntries || (request.flattenedEntries = this._flattenEntries(request.profiler.entries)));
        const entryGroup = entryGroupSelection.enter()
            .append("g")
            .attr("class", e => this._computeEntryClassName(e.entry))
            .on("click", (_, e) => this._setSelectedEntry(e.entry));

        entryGroup.append("rect")
            .attr("x", e => scale(e.entry.started || 0))
            .attr("y", e => size.height - (e.level * entryHeight) - (e.level * entryLevelGap))
            .attr("width", e => e.entry.elapsedMilliseconds ? scale(e.entry.elapsedMilliseconds) : 1)
            .attr("height", entryHeight);

        entryGroup
            .append("foreignObject")
            .attr("x", e => scale(e.entry.started || 0))
            .attr("y", e => size.height - (e.level * entryHeight) - (e.level * entryLevelGap))
            .attr("width", e => e.entry.elapsedMilliseconds ? scale(e.entry.elapsedMilliseconds) : 1)
            .attr("height", entryHeight)
            .html(e => `<div class="text" style="width: ${e.entry.elapsedMilliseconds ? scale(e.entry.elapsedMilliseconds) : 1}px;">` + e.entry.methodName + "</div>")
            .on("mouseenter", (_, e) => this._setHoveredEntry(e.entry))
            .on("mouseleave", (_, e) => this._setHoveredEntry(null));

        const entryGroupTransition = entryGroupSelection.transition().duration(0)
            .attr("class", e => this._computeEntryClassName(e.entry));

        entryGroupTransition
            .select("rect")
            .attr("x", e => scale(e.entry.started || 0))
            .attr("y", e => size.height - (e.level * entryHeight) - (e.level * entryLevelGap))
            .attr("width", e => e.entry.elapsedMilliseconds ? scale(e.entry.elapsedMilliseconds) : 1)
            .attr("height", entryHeight);

        entryGroupTransition.select("foreignObject")
            .attr("x", e => scale(e.entry.started || 0))
            .attr("y", e => size.height - (e.level * entryHeight) - (e.level * entryLevelGap))
            .attr("width", e => e.entry.elapsedMilliseconds ? scale(e.entry.elapsedMilliseconds) : 1)
            .attr("height", entryHeight)
            .select(".text")
            .attr("style", e => `width: ${e.entry.elapsedMilliseconds ? scale(e.entry.elapsedMilliseconds) : 1}px;`)
            .text(e => e.entry.methodName);

        entryGroupSelection.exit().remove();
    }

    private _flattenEntries(entries: Vidyano.Dto.ProfilerEntry[] = [], level: number = 1, flattenedEntries: FlattenedProfilerRequestEntry[] = []): FlattenedProfilerRequestEntry[] {
        entries.forEach(entry => {
            flattenedEntries.push({
                entry: entry,
                level: level
            });

            this._flattenEntries(entry.entries, level + 1, flattenedEntries);
        });

        return flattenedEntries;
    }

    private _computeEntryClassName(e: Vidyano.Dto.ProfilerEntry): string {
        let className = "entry";
        let hasDetails = false;

        if (e.sql && e.sql.length > 0) {
            className = `${className} has-sql`;

            if (e.hasNPlusOne)
                className = `${className} has-n-plus-one`;

            hasDetails = true;
        }

        if (e.exception)
            className = `${className} has-exception`;

        if (e.arguments)
            hasDetails = true;

        if (hasDetails)
            className = `${className} has-details`;

        return className;
    }

    private _requestParameters(request: ProfilerRequest): string {
        if (!request || !request.parameters)
            return "";

        return `(${request.parameters.map(p =>p.value).join(", ")})`;
    }

    private _ms(ms: number): string {
        return `${ms || 0}ms`;
    }

    private _requestDate(date: Date): string {
        return String.format(`{0:${Vidyano.CultureInfo.currentCulture.dateFormat.shortDatePattern} ${Vidyano.CultureInfo.currentCulture.dateFormat.shortTimePattern}}`, date);
    }

    private _selectedEntryChanged(entry: Vidyano.Dto.ProfilerEntry) {
        const info = document.createDocumentFragment();
        this.empty(this.$.selectedEntryInfo);

        if (!entry)
            return;

        const createTableCell = (content?: any | HTMLElement, colspan?: number) => {
            const td = document.createElement("td");

            if (content instanceof HTMLElement)
                td.appendChild(content);
            else
                td.textContent = <string>content;

            if (colspan)
                td.setAttribute("colspan", colspan.toString());

            return td;
        };

        const createTableRow = (...contents: (any | HTMLElement)[]) => {
            const row = document.createElement("tr");

            if (contents)
                contents.forEach(content => row.appendChild(createTableCell(content)));

            return row;
        };

        // Arguments information
        if (entry.arguments && entry.arguments.length > 0) {
            const title = document.createElement("h2");
            title.textContent = "Arguments";
            info.appendChild(title);

            const argumentNames = entry.methodName.replace(")", "").split("(")[1].split(", ");
            const table = document.createElement("table");
            table.className = "arguments";

            argumentNames.forEach((argName, argIndex) => {
                let row = table.appendChild(document.createElement("tr"));
                row.appendChild(createTableCell(argName));

                if (typeof (entry.arguments[argIndex]) === "object") {
                    let first = true;
                    for (let p in entry.arguments[argIndex]) {
                        if (!first) {
                            row = table.appendChild(document.createElement("tr"));
                            row.appendChild(createTableCell());
                        }
                        else
                            first = false;

                        row.appendChild(createTableCell(p));
                        row.appendChild(createTableCell(entry.arguments[argIndex][p]));
                    }
                }
                else
                    row.appendChild(createTableCell(entry.arguments[argIndex], 2));
            });

            info.appendChild(table);
        }

        // SQL information
        if (entry.sql  && entry.sql.length > 0) {
            const title = document.createElement("h2");
            title.textContent = "DB Statements";
            info.appendChild(title);

            entry.sql.forEach(sqlCommandId => {
                const sql = this.selectedRequest.profiler.sql.find(s => s.commandId === sqlCommandId);
                if (!sql)
                    return;

                const table = document.createElement("table");
                table.className = "sql-statement";

                const commandText = document.createElement("pre");
                commandText.textContent = sql.commandText;
                table.appendChild(createTableRow("CommandText", commandText));

                if (sql.parameters) {
                    const parametersRow = table.appendChild(createTableRow("Parameters"));
                    const parametersTable = document.createElement("table");
                    parametersRow.appendChild(createTableCell(parametersTable));

                    sql.parameters.forEach(sqlParam => parametersTable.appendChild(createTableRow(sqlParam.name, sqlParam.value, sqlParam.type)));

                    table.appendChild(parametersRow);
                }

                if (sql.recordsAffected)
                    table.appendChild(createTableRow("Records affected", sql.recordsAffected));

                table.appendChild(createTableRow("Total time", `${sql.elapsedMilliseconds || 0}ms`));

                if (sql.taskId)
                    table.appendChild(createTableRow("Task id", sql.taskId));

                if (entry.hasNPlusOne)
                    table.appendChild(createTableRow("Warning", "Possible N+1 detected"));

                info.appendChild(table);
            });
        }

        if (entry.exception) {
            const title = document.createElement("h2");
            title.textContent = "Exception";
            info.appendChild(title);

            const exception = this.selectedRequest.profiler.exceptions.find(e => e.id === entry.exception);
            if (exception) {
                const exceptionPre = document.createElement("pre");
                exceptionPre.textContent = exception.message;
                info.appendChild(exceptionPre);
            }
        }

        this.$.selectedEntryInfo.appendChild(info);
    }

    private _closeSelectedEntry() {
        this._setSelectedEntry(null);
    }

    private _close(e: Polymer.Gestures.TapEvent) {
        this.service.profile = false;

        e.stopPropagation();
    }
}