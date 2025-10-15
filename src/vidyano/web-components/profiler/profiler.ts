import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { ISize } from "components/size-tracker/size-tracker"
import { Scroller } from "components/scroller/scroller"

type ProfilerRequest = Vidyano.Dto.ProfilerRequestDto & {
    hasNPlusOne: boolean;
    parameters: {
        key: string;
        value: string;
    }[];
    flattenedEntries: FlattenedProfilerRequestEntry[];
}

type FlattenedProfilerRequestEntry = {
    entry: Vidyano.Dto.ProfilerEntryDto;
    level: number;
}

@Polymer.WebComponent.register({
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
}, "vi-profiler")
export class Profiler extends Polymer.WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="profiler.html">`; }

    readonly lastRequest: ProfilerRequest; private _setLastRequest: (request: Vidyano.Dto.ProfilerRequestDto) => void;
    readonly selectedRequest: ProfilerRequest; private _setSelectedRequest: (request: Vidyano.Dto.ProfilerRequestDto) => void;
    readonly hoveredEntry: Vidyano.Dto.ProfilerEntryDto; private _setHoveredEntry: (entry: Vidyano.Dto.ProfilerEntryDto) => void;
    readonly selectedEntry: Vidyano.Dto.ProfilerEntryDto; private _setSelectedEntry: (entry: Vidyano.Dto.ProfilerEntryDto) => void;
    readonly zoom: number; private _setZoom: (value: number) => void;
    timelineSize: ISize;
    profiledRequests: ProfilerRequest[];

    private _requestSQL(request: ProfilerRequest): string {
        return request.profiler.sql ? this._ms(request.profiler.sql.reduce((current, entry) => current + entry.elapsedMilliseconds, 0)) : "0ms";
    }

    private _requestSharpSQL(request: ProfilerRequest): string {
        return (request.profiler.sql ? request.profiler.sql.length : 0).toString();
    }

    private _requestHasWarnings(request: ProfilerRequest): boolean {
        return request.hasNPlusOne || (request.profiler.exceptions && request.profiler.exceptions.length > 0);
    }

    private _hasNPlusOne(request: Vidyano.Dto.ProfilerRequestDto, entries: Vidyano.Dto.ProfilerEntryDto[] = request.profiler.entries): boolean {
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

    private _onMousewheel(e: WheelEvent) {
        e.preventDefault();

        const scroller = <Scroller>this.$.timelineScroller;
        if (!scroller)
            return;

        const rect = scroller.getBoundingClientRect();
        const offsetX = e.pageX - rect.left - (window.pageXOffset || document.documentElement.scrollLeft || 0);
        const mousePctg = scroller.offsetWidth > 0 ? offsetX / scroller.offsetWidth : 0.5;

        if (e.deltaY === 0)
            return;

        const isZoomIn = e.deltaY < 0;
        const zoomFactor = 1.1;
        const newZoom = Math.max(isZoomIn ? this.zoom * zoomFactor : this.zoom / zoomFactor, 1);

        if (this.timelineSize && this.timelineSize.width > 0) {
            const newInnerWidth = (this.timelineSize.width - 2) * newZoom;
            this._setZoom(newZoom);

            scroller.horizontalScrollOffset = scroller.offsetWidth > 0 ? (newInnerWidth - scroller.offsetWidth) * mousePctg : 0;
        } else
            this._setZoom(newZoom);
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
        const svg = this.$.timeline as unknown as SVGSVGElement;
        if (!svg)
            return;

        let entriesGroup = svg.querySelector(".entries") as SVGGElement;
        const xAxisGroup = svg.querySelector(".xaxis") as SVGGElement;

        if (!request || !request.profiler || !size || !(typeof size.width === 'number' && size.width > 0) || !(typeof size.height === 'number' && size.height > 0)) {
            if (entriesGroup) {
                while (entriesGroup.firstChild)
                    entriesGroup.removeChild(entriesGroup.firstChild);
            }

            if (xAxisGroup) {
                while (xAxisGroup.firstChild)
                    xAxisGroup.removeChild(xAxisGroup.firstChild);
            }

            svg.setAttribute("width", "0");
            svg.setAttribute("height", "0");

            return;
        }

        const currentZoom = (typeof zoom === 'number' && !isNaN(zoom) && isFinite(zoom)) ? Math.max(zoom, 1) : 1;
        const currentSizeWidth = size.width;
        
        let totalDuration = 0;
        if (request.profiler && typeof request.profiler.elapsedMilliseconds === 'number' && !isNaN(request.profiler.elapsedMilliseconds))
            totalDuration = Math.max(request.profiler.elapsedMilliseconds, 0);

        const availableWidth = currentSizeWidth - 2;
        const renderWidth = availableWidth * currentZoom;

        if (isNaN(renderWidth) || !isFinite(renderWidth) || renderWidth <=0) {
            if (entriesGroup)
                while (entriesGroup.firstChild) entriesGroup.removeChild(entriesGroup.firstChild);
            
            if (xAxisGroup)
                while (xAxisGroup.firstChild) xAxisGroup.removeChild(xAxisGroup.firstChild);

            svg.setAttribute("width", "0");
            svg.setAttribute("height", "0");

            return;
        }

        const style = getComputedStyle(this);
        const entryHeight = parseInt(style.getPropertyValue("--vi-profiler-entry-height"));
        const entryLevelGap = parseInt(style.getPropertyValue("--vi-profiler-entry-level-gap")) ;

        const xAxisLabelsHeight = 24;
        const chartStartY = xAxisLabelsHeight;

        svg.setAttribute("width", renderWidth.toString());
        svg.setAttribute("height", size.height.toString());

        const scaleTime = (timeInput: number | undefined | null): number => {
            const validTime = (typeof timeInput === 'number' && !isNaN(timeInput)) ? timeInput : 0;
            if (totalDuration === 0)
                return 0;
            
            const scaled = (validTime / totalDuration) * renderWidth;
            return (isNaN(scaled) || !isFinite(scaled)) ? 0 : scaled;
        };

        const scaleDuration = (durationInput: number | undefined | null): number => {
            const validDuration = (typeof durationInput === 'number' && !isNaN(durationInput)) ? Math.max(durationInput, 0) : 0;
            
            if (totalDuration === 0)
                return validDuration > 0 ? 1 : 0;
            
            const scaled = (validDuration / totalDuration) * renderWidth;
            const result = Math.max((isNaN(scaled) || !isFinite(scaled)) ? 0 : scaled, validDuration > 0 ? 1 : 0);

            return (isNaN(result) || !isFinite(result)) ? (validDuration > 0 ? 1 : 0) : result;
        };

        if (xAxisGroup) {
            while (xAxisGroup.firstChild)
                xAxisGroup.removeChild(xAxisGroup.firstChild);

            if (size.height > xAxisLabelsHeight && renderWidth > 0) { 
                const maxTicks = 10;
                const minPixelsPerTick = 60;
                const tickInterval = getNiceTickInterval(totalDuration, maxTicks, minPixelsPerTick, renderWidth);

                const tickValues: number[] = [];
                if (totalDuration === 0) {
                    tickValues.push(0);
                } else if (tickInterval > 0) {
                    for (let t = 0; ; t += tickInterval) {
                        tickValues.push(t);
                        if (t > totalDuration && tickValues.length > 1) {
                            if (tickValues[tickValues.length-2] < totalDuration)
                                tickValues[tickValues.length-1] = totalDuration;
                            break;
                        }
                        if (t === 0 && totalDuration === 0) break;
                        if (tickValues.length > maxTicks * 2) break;
                        if (t >= totalDuration && t > 0) {
                            if (tickValues[tickValues.length -1] !== totalDuration)
                                tickValues[tickValues.length -1] = totalDuration;
                            break;
                        }
                    }
                    if (tickValues.length === 0 || tickValues[0] > 0) tickValues.unshift(0);
                    if (tickInterval > 0 && tickValues[tickValues.length - 1] < totalDuration) tickValues.push(totalDuration);
                }
                const finalTicks = [...new Set(tickValues)].sort((a,b) => a-b);

                finalTicks.forEach(tickValue => {
                    const xPos = scaleTime(tickValue);

                    const stripe = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    stripe.setAttribute("x1", xPos.toString());
                    stripe.setAttribute("y1", chartStartY.toString()); 
                    stripe.setAttribute("x2", xPos.toString());
                    stripe.setAttribute("y2", size.height.toString()); 
                    xAxisGroup.appendChild(stripe);

                    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
                    label.setAttribute("x", xPos.toString());
                    label.setAttribute("y", (xAxisLabelsHeight * 0.4).toString());
                    label.setAttribute("text-anchor", "middle");
                    label.setAttribute("dominant-baseline", "hanging"); 
                    label.textContent = formatTickLabel(tickValue);
                    xAxisGroup.appendChild(label);
                });
            }
        }

        if (!entriesGroup) {
            entriesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
            entriesGroup.classList.add("entries");
            if (xAxisGroup && xAxisGroup.nextSibling)
                svg.insertBefore(entriesGroup, xAxisGroup.nextSibling);
            else
                svg.appendChild(entriesGroup);
        } else {
            while (entriesGroup.firstChild)
                entriesGroup.removeChild(entriesGroup.firstChild);
        }

        const entriesData = request.flattenedEntries || (request.flattenedEntries = this._flattenEntries(request.profiler.entries));
        if (!entriesData || size.height <= xAxisLabelsHeight) 
            return;

        entriesData.forEach(entryData => {
            const { entry, level } = entryData;
            const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const entryDrawingAreaBottomAnchor = size.height - 15;

            g.setAttribute("class", this._computeEntryClassName(entry));
            if (this._computeEntryClassName(entry).includes("has-details"))
                g.addEventListener("click", () => this._setSelectedEntry(entry));

            const entryAreaBottom = size.height;
            const yRectBottom = entryAreaBottom - ((level -1) * entryHeight + (level -1) * entryLevelGap);
            const yStackHeightFromBottom = (level - 1) * (entryHeight + entryLevelGap);
            const yRectTop = entryDrawingAreaBottomAnchor - yStackHeightFromBottom - entryHeight; 

            const x = scaleTime(entry.started);
            let w = scaleDuration(entry.elapsedMilliseconds);
            if (isNaN(w) || !isFinite(w))
                w = entry.elapsedMilliseconds > 0 ? 1 : 0;
            const h = entryHeight;

            if (yRectTop < chartStartY || yRectTop >= entryDrawingAreaBottomAnchor)
                return;

            const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttribute("x", x.toString());
            rect.setAttribute("y", yRectTop.toString());
            rect.setAttribute("width", w.toString());
            rect.setAttribute("height", h.toString());
            g.appendChild(rect);

            const foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
            foreignObject.setAttribute("x", x.toString());
            foreignObject.setAttribute("y", yRectTop.toString());
            foreignObject.setAttribute("width", w.toString());
            foreignObject.setAttribute("height", h.toString());
            
            const textDiv = document.createElement("div");
            textDiv.className = "text";
            textDiv.style.width = `${w}px`;
            textDiv.textContent = entry.methodName;
            foreignObject.appendChild(textDiv);

            foreignObject.addEventListener("mouseenter", () => this._setHoveredEntry(entry));
            foreignObject.addEventListener("mouseleave", () => this._setHoveredEntry(null));
            g.appendChild(foreignObject);
            entriesGroup.appendChild(g);
        });
    }

    private _flattenEntries(entries: Vidyano.Dto.ProfilerEntryDto[] = [], level: number = 1, flattenedEntries: FlattenedProfilerRequestEntry[] = []): FlattenedProfilerRequestEntry[] {
        entries.forEach(entry => {
            flattenedEntries.push({
                entry: entry,
                level: level
            });

            this._flattenEntries(entry.entries, level + 1, flattenedEntries);
        });

        return flattenedEntries;
    }

    private _computeEntryClassName(e: Vidyano.Dto.ProfilerEntryDto): string {
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

    private _selectedEntryChanged(entry: Vidyano.Dto.ProfilerEntryDto) {
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

function formatTickLabel(ms: number): string {
    if (ms < 0)
        ms = 0;

    const MS_PER_SECOND = 1000;
    const MS_PER_MINUTE = 60 * 1000;

    if (ms < MS_PER_SECOND)
        return `${Math.round(ms)}ms`;
    
    if (ms < MS_PER_MINUTE) {
        const seconds = ms / MS_PER_SECOND;
        return `${(seconds % 1 === 0) ? seconds.toFixed(0) : seconds.toFixed(1)}s`;
    }
    
    const minutes = ms / MS_PER_MINUTE;
    return `${(minutes % 1 === 0) ? minutes.toFixed(0) : minutes.toFixed(1)}m`;
}

function getNiceTickInterval(range: number, maxTicks: number, minPixelsPerTick: number = 50, renderWidth: number): number {
    if (range <= 0)
        return 1; // Default for non-positive range
    
    // Adjust maxTicks based on renderWidth to avoid overcrowding
    const dynamicMaxTicks = Math.max(1, Math.min(maxTicks, Math.floor(renderWidth / minPixelsPerTick)));
    maxTicks = Math.max(1, dynamicMaxTicks); // Ensure at least one tick

    const tempInterval = range / maxTicks;
    if (tempInterval <= 0) return Math.max(1, range); // Avoid zero or negative interval

    const magnitude = Math.pow(10, Math.floor(Math.log10(tempInterval)));
    const scaledInterval = tempInterval / magnitude;

    let niceInterval: number;
    if (scaledInterval > 5) {
        niceInterval = 10 * magnitude;
    } else if (scaledInterval > 2.5) { 
        niceInterval = 5 * magnitude;
    } else if (scaledInterval > 1.5) { 
        niceInterval = 2 * magnitude;
    } else {
        niceInterval = 1 * magnitude;
    }
    
    return Math.max(1, niceInterval); // Ensure interval is at least 1ms (or smallest unit like 0.1 if needed)
}
