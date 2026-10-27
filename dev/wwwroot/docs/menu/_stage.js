// Shared by the menu's documentation pages: the live menu they demonstrate on, and the shape of a component page.
import { IconRegister, Vidyano, WebComponent, html, nothing } from "../../index.js";

export const app = window[Symbol.for("Vidyano.App")];

/** The style of a count badge in a row's end region. */
export const badge = "font: 600 11px/1 'Open Sans', sans-serif; background: #F5A623; color: #1d1d1d; border-radius: 9px; padding: 3px 7px; text-transform: none; flex-shrink: 0";

/** Whether the menu shows only icons: collapsed, and the mouse not over it. */
export const compact = menu => menu.collapsed && !menu.hovering;

/** Every element with this tag under the root, through the shadow roots of the elements in it. */
function findAll(root, tag, found = []) {
    for (const element of root.querySelectorAll("*")) {
        if (element.localName === tag)
            found.push(element);
        if (element.shadowRoot)
            findAll(element.shadowRoot, tag, found);
    }

    return found;
}

/**
 * The part of the element that shows inside the frame: its box, cut by every element around it that clips, such as a
 * closed program unit's children; null when nothing of it shows.
 */
function visibleRect(element, frame) {
    if (!element?.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
        return null;

    let { left, top, right, bottom } = element.getBoundingClientRect();
    for (let node = element; node && node !== frame; node = node.assignedSlot ?? node.parentElement ?? node.getRootNode().host) {
        const style = getComputedStyle(node);
        if (node === element || (style.overflowX === "visible" && style.overflowY === "visible"))
            continue;

        const clip = node.getBoundingClientRect();
        left = Math.max(left, clip.left); top = Math.max(top, clip.top);
        right = Math.min(right, clip.right); bottom = Math.min(bottom, clip.bottom);
    }

    const box = frame.getBoundingClientRect();
    left = Math.max(left, box.left); top = Math.max(top, box.top);
    right = Math.min(right, box.right); bottom = Math.min(bottom, box.bottom);

    return right - left >= 1 && bottom - top >= 1 ? { left, top, width: right - left, height: bottom - top } : null;
}

/**
 * The menu's own states: { id, label }, and collapsed or searching where the state is one of those. A component's
 * states add open, whether its program unit or groups are open.
 */
export const menuStates = [
    { id: "expanded", label: "Expanded" },
    { id: "collapsed", label: "Collapsed", collapsed: true },
    { id: "searching", label: "Searching", searching: true }
];

let specimenUnits;

/**
 * Made-up program units that hold one of everything the menu shows: program units with icons, two groups with a
 * separator between them, an item with an icon of its own and one outside any group. A search for "or" matches some
 * of each.
 */
export function specimen() {
    if (specimenUnits)
        return specimenUnits;

    // An item has an icon when one is registered under its type and name
    const chart = IconRegister.load("Chart_LineChart");
    if (chart)
        IconRegister.add("ProgramUnitItem_Url_OpenOrders", chart.innerHTML);

    const orders = { id: "orders", name: "Orders", title: "Orders" };
    const customers = { id: "customers", name: "Customers", title: "Customers" };
    const url = (name, title, group) => ({ id: name, name, title, group, objectId: `#${name}` });
    const unit = (name, icon, items) => new Vidyano.ProgramUnit(null, {}, { id: name, name, title: name, icon, offset: 0, openFirst: false, items });

    return specimenUnits = [
        unit("Store", "material-symbols:storefront-outline-rounded", [
            url("OpenOrders", "Open orders", orders),
            url("ShippedOrders", "Shipped orders", orders),
            { id: "separator", name: "Separator", title: "", isSeparator: true },
            url("AllCustomers", "All customers", customers),
            url("KeyAccounts", "Key accounts", customers),
            url("Reports", "Reports")
        ]),
        unit("Products", "fluent:puzzle-piece-48-regular", [url("Catalog", "Catalog")]),
        unit("Settings", "tabler:sparkles", [url("General", "General")])
    ];
}

/** What the instant search finds for "or" in the specimen. */
export const specimenInstantSearch = [
    { label: "Order 1024", breadcrumb: "Store › Open orders", href: "#order-1024" },
    { label: "Order 0987", breadcrumb: "Store › Shipped orders", href: "#order-0987" }
];

/**
 * A live vi-menu, next to a stand-in for the app, with buttons for its states. It shows the Dev application's program
 * units, or the ones in programUnits. Clicks that would navigate show as a toast instead. It renders without a shadow
 * root of its own, so the menu sits in the page's scope.
 *
 * Given parts, it outlines those parts of one component in the menu, the one with the tag in component that shows most
 * of them, and numbers them in that order. It tells which ones show in a parts-change event, and which one the pointer
 * is over in a part-hover event; highlight names the one to light up.
 */
class DocsMenuStage extends WebComponent {
    static properties = {
        state: { state: true },
        states: { type: Array },
        programUnits: { attribute: false },
        instantSearch: { attribute: false },
        search: { type: String },
        component: { type: String },
        parts: { type: Array },
        highlight: { type: String },
        boxes: { state: true }
    };

    #frame = 0;
    #host = null;
    #hostsFound = 0;
    #measured = 0;
    #boxesKey = "";
    #hovered = null;

    // Not as class fields: those would shadow the reactive accessors
    constructor() {
        super();

        this.state = "expanded";
        this.states = menuStates;
        this.programUnits = null;
        this.instantSearch = null;
        this.search = "Select";
        this.component = null;
        this.parts = null;
        this.highlight = null;
        this.boxes = [];
    }

    createRenderRoot() {
        return this;
    }

    // Set once, not bound: a binding would open the first program unit again whenever the stage renders
    firstUpdated() {
        const menu = this.querySelector("vi-menu");
        menu.activeProgramUnit ??= menu.programUnits[0];

        // Again once the page around it has its text and fonts
        requestAnimationFrame(this.#fit);
        document.fonts.ready.then(this.#fit);
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener("resize", this.#fit);
    }

    // As tall as the window leaves room for, so the page doesn't scroll: from its full height, less what overflows
    #fit = () => {
        const frame = this.querySelector(".frame");
        if (!frame?.isConnected)
            return;

        frame.style.height = "640px";
        const overflow = document.scrollingElement.scrollHeight - window.innerHeight;
        frame.style.height = `${Math.max(420, 640 - Math.max(0, overflow))}px`;
    };

    /** The state the buttons show: the one with the id in state, or else the first. */
    get current() {
        return this.states.find(s => s.id === this.state) ?? this.states[0];
    }

    willUpdate(changed) {
        if (changed.has("states") && !this.states.some(s => s.id === this.state))
            this.state = this.states[0].id;
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        window.removeEventListener("resize", this.#fit);
        cancelAnimationFrame(this.#frame);
        this.#frame = 0;
    }

    updated(changed) {
        if (this.parts && !this.#frame && this.isConnected)
            this.#frame = requestAnimationFrame(this.#measure);

        if (changed.has("state") || changed.has("states"))
            this.#enter(this.current);
    }

    // What the bindings can't set: whether the component is open, and the instant search results of a search
    async #enter(state) {
        const menu = this.querySelector("vi-menu");
        await menu.updateComplete;

        if (state.searching && this.instantSearch)
            menu.instantSearchResults = this.instantSearch;

        if (state.open === undefined)
            return;

        if (this.component === "vi-menu-program-unit")
            menu.activeProgramUnit = state.open ? menu.programUnits[0] : null;
        else if (this.component === "vi-menu-group")
            findAll(menu.shadowRoot, "vi-menu-group").forEach(group => group.expanded = state.open);
    }

    // Every frame while an outline shows, so it follows the menu as it opens, scrolls and changes state; the hidden
    // ones only need to be about right for the pointer, so a few times a second will do
    #measure = () => {
        this.#frame = requestAnimationFrame(this.#measure);

        if (!this.highlight && performance.now() - this.#measured < 150)
            return;

        this.#measured = performance.now();

        const frame = this.querySelector(".frame");
        const menu = this.querySelector("vi-menu");
        if (!frame || !menu?.shadowRoot)
            return;

        const rectsOf = host => this.parts.map(name => visibleRect(host.shadowRoot?.querySelector(`[part~="${name}"]`), frame));
        const count = rects => rects.filter(Boolean).length;

        // Choosing the component walks the whole menu, so only now and then: the one that shows most of the parts
        if (performance.now() - this.#hostsFound > 300) {
            const hosts = this.component === "vi-menu" ? [menu] : findAll(menu.shadowRoot, this.component);
            this.#host = hosts.map(host => ({ host, shown: count(rectsOf(host)) })).reduce((best, h) => h.shown > best.shown ? h : best, { host: null, shown: 0 }).host;
            this.#hostsFound = performance.now();
        }

        const origin = frame.getBoundingClientRect();
        const best = this.#host ? rectsOf(this.#host) : [];

        // A number on the top left corner of each, moved aside when it would cover one before it
        const placed = [];
        const boxes = best.map((rect, index) => {
            if (!rect)
                return null;

            const x = rect.left - origin.left, y = rect.top - origin.top;
            const marker = { x: Math.max(2, Math.min(x - 8, origin.width - 18)), y: Math.max(2, y - 8) };
            while (placed.some(p => Math.abs(p.x - marker.x) < 18 && Math.abs(p.y - marker.y) < 18))
                marker.x += 20;
            placed.push(marker);

            return { name: this.parts[index], number: index + 1, x, y, width: rect.width, height: rect.height, marker };
        }).filter(Boolean);

        const key = JSON.stringify(boxes);
        if (key === this.#boxesKey)
            return;

        const shown = boxes.map(b => b.name).join();
        const before = this.boxes.map(b => b.name).join();
        this.#boxesKey = key;
        this.boxes = boxes;
        if (shown !== before)
            this.dispatchEvent(new CustomEvent("parts-change", { detail: boxes.map(b => b.name) }));
    };

    // The smallest outline under the pointer
    #pointer(e) {
        if (!this.parts)
            return;

        const origin = this.querySelector(".frame").getBoundingClientRect();
        const x = e.clientX - origin.left, y = e.clientY - origin.top;
        const name = e.type === "pointerleave" ? null : this.boxes
            .filter(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height)
            .sort((a, b) => a.width * a.height - b.width * b.height)[0]?.name ?? null;

        if (name !== this.#hovered) {
            this.#hovered = name;
            this.dispatchEvent(new CustomEvent("part-hover", { detail: name }));
        }
    }

    /**
     * Opens the program unit with the first title, then the groups in it with the next ones, so what an example
     * changes is in view. Program units and groups match by title.
     * @returns The function that opens the first program unit again, as the stage starts.
     */
    reveal(...titles) {
        const [unitTitle, ...groupTitles] = titles;
        let revealed = true;

        // The stage may not have rendered its menu yet, when an example is chosen as the page starts
        const menu = this.updateComplete.then(async () => {
            const menu = this.querySelector("vi-menu");
            if (!revealed)
                return menu;

            menu.activeProgramUnit = menu.programUnits.find(u => u.title === unitTitle) ?? menu.activeProgramUnit;
            await menu.updateComplete;

            let parent = [...menu.shadowRoot.querySelectorAll("vi-menu-program-unit")].find(u => u.item === menu.activeProgramUnit);
            for (const title of groupTitles) {
                await parent?.updateComplete;
                parent = [...parent?.shadowRoot.querySelectorAll("vi-menu-group") ?? []].find(g => g.item.title === title);
                if (parent)
                    parent.expanded = true;
            }

            return menu;
        });

        return () => {
            revealed = false;
            menu.then(menu => {
                menu.shadowRoot.querySelectorAll("vi-menu-program-unit").forEach(u => u.shadowRoot?.querySelectorAll("vi-menu-group").forEach(g => g.collapseAll()));
                menu.activeProgramUnit = menu.programUnits[0];
            });
        };
    }

    #click(e) {
        // The menu's own toggle collapses it too; keep the buttons in step
        const menu = this.querySelector("vi-menu");
        // or, where the component has no such state, undo the collapse
        menu.updateComplete.then(() => {
            if (menu.collapsed === !!this.current.collapsed)
                return;

            const state = this.states.find(s => !!s.collapsed === menu.collapsed && !s.searching);
            if (state)
                this.state = state.id;
            else
                menu.collapsed = !!this.current.collapsed;
        });

        const anchor = e.composedPath().find(n => n instanceof HTMLAnchorElement);
        if (!anchor?.hasAttribute("href") || anchor.getAttribute("rel")?.includes("external"))
            return;

        e.preventDefault();
        app.log(`navigates to ${anchor.getAttribute("href")}`);

        const unit = e.composedPath().find(n => n.tagName === "VI-MENU-PROGRAM-UNIT");
        if (unit)
            menu.activeProgramUnit = unit.item;
    }

    #renderOverlay() {
        if (!this.parts)
            return nothing;

        const lit = b => this.highlight ? (b.name === this.highlight ? "on" : "off") : nothing;

        return html`
            <div class="overlay" aria-hidden="true">
                ${this.boxes.map(b => html`<div class="box" data-lit=${lit(b)} style="left: ${b.x}px; top: ${b.y}px; width: ${b.width}px; height: ${b.height}px"></div>`)}
                ${this.boxes.map(b => html`<span class="marker" data-lit=${lit(b)} style="left: ${b.marker.x}px; top: ${b.marker.y}px">${b.number}</span>`)}
            </div>
        `;
    }

    render() {
        const programUnits = this.programUnits ?? app.service.application?.programUnits ?? [];
        const state = this.current;

        return html`
            <style>
                *:focus { outline: none; }
                docs-menu-stage { display: flex; flex-direction: column; gap: 10px; width: 420px; max-width: 100%; user-select: none; }
                docs-menu-stage .frame { position: relative; height: 640px; display: flex; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,.14); background: #f4f6f8; font: 13px "Open Sans", Arial, Helvetica, sans-serif; }
                docs-menu-stage vi-menu { --vi-menu--expand-width: 300px; flex-shrink: 0; }
                docs-menu-stage .app { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 14px; }
                docs-menu-stage .app i { display: block; height: 10px; border-radius: 5px; background: #dde3e7; }
                docs-menu-stage .app i:first-child { height: 26px; background: #4682B4; opacity: .85; border-radius: 4px; margin-bottom: 6px; }
                docs-menu-stage .states { display: flex; gap: 4px; background: #e3e8eb; padding: 3px; border-radius: 8px; }
                docs-menu-stage .states button { flex: 1; border: 0; background: none; border-radius: 6px; padding: 4px 10px; font: 13px "Open Sans", sans-serif; color: #3e4c53; cursor: pointer; }
                docs-menu-stage .states button[aria-pressed="true"] { background: #fff; color: #1f2a30; font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
                docs-menu-stage .overlay { position: absolute; inset: 0; pointer-events: none; }
                /* Nothing at rest; the part the pointer is on, in the menu or in the list, gets its outline and number */
                docs-menu-stage .box { position: absolute; box-sizing: border-box; opacity: 0; transition: opacity .15s; }
                docs-menu-stage .marker { position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #9cc3e4; color: #263238; font: 700 9px/14px "Open Sans", sans-serif; text-align: center; box-shadow: 0 0 0 2px rgba(38,50,56,.6); transition: opacity .15s; }
                docs-menu-stage .marker:not([data-lit="on"]) { opacity: 0; }
                docs-menu-stage .box[data-lit="on"] { opacity: 1; outline: 2px solid #F5A623; background: rgba(245,166,35,.14); }
                docs-menu-stage .marker[data-lit="on"] { background: #F5A623; }
            </style>
            ${this.states.length > 1 ? html`
                <div class="states" role="group" aria-label="State">
                    ${this.states.map(s => html`<button aria-pressed=${String(s === state)} @click=${() => this.state = s.id}>${s.label}</button>`)}
                </div>
            ` : nothing}
            <div class="frame" @click=${e => this.#click(e)} @pointermove=${e => this.#pointer(e)} @pointerleave=${e => this.#pointer(e)}>
                <!-- The page decides collapsed, not the menu-collapsed cookie the built-in toggle keeps -->
                <vi-menu .label=${"Dev"} .programUnits=${programUnits} .collapsed=${!!state.collapsed} .filter=${state.searching ? this.search : ""}></vi-menu>
                <div class="app" aria-hidden="true"><i></i><i style="width: 70%"></i><i></i><i style="width: 85%"></i><i style="width: 60%"></i><i></i><i style="width: 75%"></i></div>
                ${this.#renderOverlay()}
            </div>
        `;
    }
}

if (!customElements.get("docs-menu-stage"))
    customElements.define("docs-menu-stage", DocsMenuStage);

/**
 * The parts of a menu component on a live menu: each outlined and numbered there, and listed next to it with what it
 * is and the selector that reaches it. parts is [{ name, text, when }], where when, optional, tells when the part
 * shows, for while it doesn't; states, the states the buttons offer, as in menuStates; regions, optional, the component
 * class whose start and end regions get a placeholder, so their boxes show. The menu shows the specimen, with Store
 * and its Orders group open.
 */
/** CSS declarations as a template, with their properties, values and comments in spans for their colors. */
function highlightDeclarations(text) {
    return text.split(/(\/\*[\s\S]*?(?:\*\/|$))/).map((chunk, index) => index % 2 === 1
        ? html`<span class="comment">${chunk}</span>`
        : chunk.split(/([\w-]+)(\s*:)([^;\n]*)/).map((piece, i) => i % 4 === 1 ? html`<span class="property">${piece}</span>` : i % 4 === 3 ? html`<span class="value">${piece}</span>` : piece));
}

class DocsParts extends WebComponent {
    static properties = {
        component: { type: String },
        parts: { type: Array },
        states: { type: Array },
        regions: { attribute: false },
        highlight: { state: true },
        shown: { state: true },
        present: { state: true },
        rules: { state: true },
        editing: { state: true },
        pinned: { state: true }
    };

    // Not as class fields: those would shadow the reactive accessors
    constructor() {
        super();

        this.component = "";
        this.parts = [];
        this.states = menuStates;
        this.regions = null;
        this.highlight = null;
        this.shown = null;
        this.present = [];
        this.rules = {};
        this.editing = false;
        this.pinned = null;
    }

    #placeholders = [];

    connectedCallback() {
        super.connectedCallback();

        this.#placeholders = this.regions ? ["start", "end"].map(region => this.regions.extend(region, menu => compact(menu) ? nothing : html`
            <span style="display: block; width: 10px; height: 10px; border-radius: 3px; background: rgba(255, 255, 255, .22)"></span>
        `)) : [];
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.#placeholders.forEach(dispose => dispose());
        this.#placeholders = [];
    }

    firstUpdated() {
        this.renderRoot.querySelector("docs-menu-stage").reveal("Store", "Orders");
    }

    /** The rules the editors hold, as one style sheet for the menu. */
    get css() {
        // Without braces, so a rule can't close its block and style the rest of the page
        return Object.entries(this.rules).filter(([, declarations]) => declarations.trim()).map(([name, declarations]) => `vi-menu::part(${name}) {\n${declarations.replace(/[{}]/g, "")}\n}`).join("\n");
    }

    // Only for as long as the page shows: a reload starts without rules
    #setRule(name, declarations) {
        this.rules = { ...this.rules, [name]: declarations };
    }

    // Enter ends a declaration with its semicolon; the editor indents every line by itself
    #keydown(e, name) {
        if (e.key !== "Enter" || e.shiftKey)
            return;

        const editor = e.target;
        const lineStart = editor.value.lastIndexOf("\n", editor.selectionStart - 1) + 1;
        const line = editor.value.slice(lineStart, editor.selectionStart);
        if (!/^\s*[\w-]+\s*:\s*\S/.test(line) || /[;{}]\s*$/.test(line))
            return;

        e.preventDefault();
        editor.setRangeText(";\n", editor.selectionStart, editor.selectionEnd, "end");
        this.#setRule(name, editor.value);
    }

    /** The rule of the part: its selector, and the declarations in an editor that applies them as they are typed. */
    #renderRule(name) {
        const declarations = this.rules[name] ?? "";

        return html`
            <div class="rule">
                <span class="selector">vi-menu</span>::part(<span class="name">${name}</span>) {
                <div class="body">
                    <pre aria-hidden="true">${highlightDeclarations(declarations)}${declarations.endsWith("\n") || !declarations ? " " : ""}</pre>
                    <textarea spellcheck="false" aria-label=${`Declarations for vi-menu::part(${name})`} placeholder="color: gold;" .value=${declarations}
                        @input=${e => this.#setRule(name, e.target.value)} @keydown=${e => this.#keydown(e, name)}
                        @focus=${() => { this.editing = true; this.pinned = name; }} @blur=${() => this.editing = false}></textarea>
                </div>
                }
            </div>
            ${declarations.trim() ? html`<div class="actions"><button @click=${() => this.#setRule(name, "")}>Clear rule</button></div>` : nothing}
        `;
    }

    #hover(name) {
        // Back to the pinned part when the pointer leaves the others
        this.highlight = name ?? this.pinned;

        // A pinned part, or one whose rule is being typed, stays in the box
        if (name && !this.editing && !this.pinned)
            this.shown = name;
    }

    // A click pins the part in the box, and a second one lets it go
    #pin(name) {
        this.pinned = this.pinned === name ? null : name;
        if (this.pinned)
            this.shown = this.highlight = this.pinned;
    }

    render() {
        const part = this.parts.find(p => p.name === this.shown);

        return html`
            <style>
                *:focus { outline: none; }
                :host { display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; }
                docs-menu-stage { flex-shrink: 0; }
                .legend { flex: 1; min-width: 280px; max-width: 560px; display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
                p { margin: 0; color: #46545c; }
                code { font: 12.5px ui-monospace, Consolas, monospace; background: #e7ebee; padding: 1px 5px; border-radius: 4px; }
                ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
                .chip { display: flex; align-items: center; gap: 7px; padding: 4px 12px 4px 5px; border: 1px solid #dce2e6; border-radius: 16px; background: #fff; font: 12.5px ui-monospace, Consolas, monospace; color: #1f2a30; cursor: default; }
                .chip .number { width: 18px; height: 18px; border-radius: 50%; background: #9cc3e4; color: #263238; font: 700 10px/18px "Open Sans", sans-serif; text-align: center; }
                .chip[aria-current="true"] { border-color: #F5A623; background: #fff6e6; }
                .chip[aria-current="true"] .number { background: #F5A623; }
                .chip[aria-pressed="true"] { border: 1px solid #F5A623; background: #fff6e6; box-shadow: 0 0 0 1px #F5A623; }
                .chip .pin { font-size: 10px; margin-left: -2px; }
                .chip.absent { color: #8a979e; border-style: dashed; }
                .chip.absent .number { background: #e3e8eb; color: #8a979e; }
                .about { display: flex; flex-direction: column; gap: 10px; min-height: 120px; box-sizing: border-box; padding: 16px 18px; background: #fff; border: 1px solid #e3e8eb; border-radius: 10px; }
                .about h3 { margin: 0; font: 600 14px ui-monospace, Consolas, monospace; }
                .about .absent { color: #8a6100; font-size: 13px; }
                pre { margin: 0; padding: 10px 14px; border-radius: 6px; background: #0d1117; color: #e6edf3; font: 12.5px/1.6 ui-monospace, Consolas, monospace; overflow: auto; }
                pre .selector { color: #7ee787; }
                pre .name { color: #a5d6ff; }
                .hint { color: #5b6b73; font-size: 13px; }
                .rule { margin: 0; padding: 10px 14px; border-radius: 6px; background: #0d1117; color: #e6edf3; font: 12.5px/1.6 ui-monospace, Consolas, monospace; }
                .rule .body { position: relative; margin: 2px 0; }
                .rule .body pre, .rule textarea { margin: 0; padding: 0 0 0 4ch; font: inherit; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 4; min-height: 1.6em; }
                .rule .body pre { background: none; border-radius: 0; color: inherit; }
                .rule textarea { position: absolute; inset: 0; width: 100%; box-sizing: border-box; border: 0; outline: 0; resize: none; overflow: hidden; background: none; color: transparent; caret-color: #F5A623; }
                .rule textarea::placeholder { color: #6e7681; }
                .rule .selector { color: #7ee787; }
                .rule .name { color: #a5d6ff; }
                .rule .property { color: #79c0ff; }
                .rule .value { color: #a5d6ff; }
                .rule .comment { color: #8b949e; }
                .rule:focus-within { box-shadow: 0 0 0 2px #F5A623; }
                .chip .edited { width: 6px; height: 6px; border-radius: 50%; background: #F5A623; margin-left: -2px; }
                .about .actions { display: flex; justify-content: flex-end; }
                .about .actions button { border: 0; background: none; color: #5b6b73; font: 12px "Open Sans", sans-serif; padding: 2px 6px; border-radius: 5px; cursor: pointer; }
                .about .actions button:hover { background: #eef1f3; color: #1f2a30; }
            </style>
            <style .textContent=${this.css}></style>
            <docs-menu-stage .component=${this.component} .parts=${this.parts.map(p => p.name)} .states=${this.states} .programUnits=${specimen()} .instantSearch=${specimenInstantSearch} .search=${"or"} .highlight=${this.highlight}
                @parts-change=${e => this.present = e.detail} @part-hover=${e => this.#hover(e.detail)}></docs-menu-stage>
            <div class="legend">
                <p>${this.component === "vi-menu" ? html`The parts of <code>vi-menu</code>, which <code>vi-menu::part(name)</code> restyles from outside the menu.` : html`<code>${this.component}</code> sits in the shadow root of <code>vi-menu</code>, where a selector of the page can't reach it. <code>vi-menu</code> passes its parts on, so <code>vi-menu::part(name)</code> restyles them from outside the menu.`}</p>
                <ol>
                    ${this.parts.map((p, index) => html`
                        <li>
                            <button class="chip ${this.present.includes(p.name) ? "" : "absent"}" aria-current=${String(this.highlight === p.name)} aria-pressed=${String(this.pinned === p.name)}
                                title=${this.pinned === p.name ? "Unpin" : "Pin it in the box below"} @click=${() => this.#pin(p.name)} @mouseenter=${() => this.#hover(p.name)} @mouseleave=${() => this.#hover(null)} @focus=${() => this.#hover(p.name)} @blur=${() => this.#hover(null)}>
                                ${this.pinned === p.name ? html`<span class="pin" aria-hidden="true">📌</span>` : nothing}
                                <span class="number">${index + 1}</span>${p.name}${this.rules[p.name]?.trim() ? html`<span class="edited" title="Has a rule"></span>` : nothing}
                            </button>
                        </li>
                    `)}
                </ol>
                <div class="about" aria-live="polite">
                    ${part ? html`
                        <h3>${part.name}</h3>
                        <p>${part.text}</p>
                        ${this.present.includes(part.name) || !part.when ? nothing : html`<p class="absent">${part.when}</p>`}
                        ${this.#renderRule(part.name)}
                    ` : html`<p class="hint">Point at a part, in the menu or in the list, for what it is and the selector that reaches it, where you can try a rule. Click a part in the list to keep it here.${this.states.length > 1 ? " The states above the menu show the parts in other situations." : ""}</p>`}
                </div>
            </div>
        `;
    }
}

if (!customElements.get("docs-parts"))
    customElements.define("docs-parts", DocsParts);

/** The styles every menu documentation page shares. */
export const pageStyles = html`
    <style>
        *:focus { outline: none; }
        :host { display: flex; flex-direction: column; gap: 20px; }
        p { margin: 0; color: #46545c; max-width: 820px; }
        code { font: 12.5px ui-monospace, Consolas, monospace; background: #e7ebee; padding: 1px 5px; border-radius: 4px; }
    </style>
`;

/**
 * Defines the documentation page of one menu component, with a Behavior tab, the extension points an outsider adds
 * content with and their live examples, when it has those, and a Styling tab, the parts an outsider restyles with
 * vi-menu::part(…). behavior, optional, is { examples, groups }; parts is [{ name, text, when }]; states, optional, the
 * states the Styling tab offers, the menu's own when left out; regions, optional, the component class whose start and end regions the Styling tab shows with a placeholder.
 * @returns The page's text and tabs, for its module to export.
 */
export function defineComponentPage({ tag, text, behavior, component, parts, states, regions }) {
    const tabs = [...(behavior ? [{ id: "behavior", title: "Behavior" }] : []), { id: "styling", title: "Styling" }];

    class DocsComponentPage extends WebComponent {
        static properties = {
            tab: { type: String }
        };

        // Not as class fields: those would shadow the reactive accessors
        constructor() {
            super();

            this.tab = tabs[0].id;
        }

        render() {
            if (this.tab === "behavior")
                return html`
                    ${pageStyles}
                    <docs-examples name=${`${tag}-behavior`} .examples=${behavior.examples} .groups=${behavior.groups ?? null}>
                        <docs-menu-stage slot="stage"></docs-menu-stage>
                    </docs-examples>
                `;

            return html`
                ${pageStyles}
                <docs-parts .component=${component} .parts=${parts} .states=${states ?? menuStates} .regions=${regions ?? null}></docs-parts>
            `;
        }
    }

    customElements.define(tag, DocsComponentPage);

    return { text, tabs };
}
