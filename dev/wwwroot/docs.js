// The documentation site at http://docs.localhost:5000/: a sidebar with every page, and one page at a time at its own
// address, /<name>[/<tab>]. A page is a module in docs/<name>.js that exports its title, the tag of the element that
// renders it and optionally an order, its text and its tabs.
import { Vidyano, WebComponent, html, nothing } from "./index.js";

/**
 * Stands in for vi-app, so the live examples run against the Dev service without the whole app: what would navigate
 * or open a dialog shows as a toast in the bottom right instead.
 */
class DocsApp extends EventTarget {
    service = new Vidyano.Service("/");
    isTracking = false;
    sensitive = false;
    configuration = { getSetting: (_key, defaultValue) => defaultValue };

    /** Shows a toast in the bottom right, as vi-app does. */
    showAlert(notification, type = "Notice", duration = 3000) {
        document.querySelector("vi-docs")?.shadowRoot?.querySelector("vi-alert")?.log(notification, type, duration);
    }

    log(message) {
        this.showAlert(message);
    }

    changePath(path) { this.log(`app.changePath("${path}")`); }
    getUrlForPersistentObject(id, objectId) { return `PersistentObject.${id}/${objectId}`; }
    cacheRemove() { }
    redirectToSignIn() { this.log("app.redirectToSignIn()"); }
    redirectToSignOut() { this.log("app.redirectToSignOut()"); }
    showDialog() { this.log("app.showDialog(…)"); return Promise.resolve(); }
    showMessageDialog(options) { this.log(`app.showMessageDialog("${options?.title ?? ""}")`); return Promise.resolve(); }
}

const app = new DocsApp();
window[Symbol.for("Vidyano.App")] = app;
const ready = app.service.initialize();

const highlightJs = "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1";

/** The highlight.js theme, for a page to link in its shadow root. */
export const highlightTheme = `${highlightJs}/styles/github-dark.min.css`;

let hljs = null;

/**
 * Resolves once highlight.js loaded from the CDN, with the JavaScript grammar plus XML for the HTML in html``
 * templates, or once it failed to: the code then stays plain.
 */
export const highlighter = (async () => {
    try {
        const [core, javascript, xml] = await Promise.all([
            import(`${highlightJs}/es/core.min.js`),
            import(`${highlightJs}/es/languages/javascript.min.js`),
            import(`${highlightJs}/es/languages/xml.min.js`)
        ]);

        core.default.registerLanguage("javascript", javascript.default);
        core.default.registerLanguage("xml", xml.default);
        hljs = core.default;
    }
    catch (e) {
        console.warn("Code blocks stay plain: highlight.js did not load.", e);
    }
})();

/**
 * Code as a <code> element: highlighted once highlight.js is there, plain text until then or without it.
 */
export function highlight(code) {
    const element = document.createElement("code");
    if (!hljs) {
        element.textContent = code;
        return element;
    }

    element.className = `hljs language-javascript`;
    // highlight.js escapes the code itself; the markup is its own
    element.innerHTML = hljs.highlight(code, { language: "javascript" }).value;
    return element;
}

/** An example's source, as a page shows it: the body of its apply function. */
function source(example) {
    const lines = example.apply.toString().replace(/^(\(\)|\w+)\s*=>\s*/, "").replace(/^\{\n?|\}$/g, "").split("\n");
    const indent = Math.min(...lines.slice(1).filter(line => line.trim()).map(line => line.match(/^\s*/)[0].length));

    return [lines[0], ...lines.slice(1).map(line => line.slice(indent))].join("\n").trim();
}

const none = {
    id: "none",
    title: "None",
    text: "No example: the component as it is built in. Pick one from the list to turn it on."
};

const everything = {
    id: "everything",
    title: "Everything",
    text: "All examples at once."
};

/**
 * The examples of a page: a card with its live demo, which the page puts in the "stage" slot, and the code of the
 * selected example, next to the list to pick one from. An example is { id, title, text, apply }, where apply(stage)
 * turns it on and returns the function that turns it off again; stage is the element the page put in the "stage" slot.
 * Optionally, reveal(stage) brings what the example changes into view, without being part of its code, and alone keeps
 * it out of Everything when it competes with another.
 * "None", the default, turns none on and "Everything", last in the list, all of them. The selection survives a reload.
 *
 *     <docs-examples name="menu" .examples=${examples} .groups=${groups}>
 *         <div slot="stage">…the live demo…</div>
 *     </docs-examples>
 *
 * groups, optional, lists the examples under headings: [{ title, examples }].
 */
class DocsExamples extends WebComponent {
    static properties = {
        name: { type: String },
        examples: { type: Array },
        groups: { type: Array },
        selected: { state: true }
    };

    #disposers = [];

    // Not as class fields: those would shadow the reactive accessors
    constructor() {
        super();

        this.name = "";
        this.examples = [];
        this.groups = null;
        this.selected = null;
    }

    get #storageKey() {
        return `docs:${this.name}:selected`;
    }

    connectedCallback() {
        super.connectedCallback();

        let id = null;
        try {
            id = sessionStorage.getItem(this.#storageKey);
        }
        catch { }

        // None to start with, so a page shows the component as it is built in
        this.#select([none, ...this.examples, everything].find(e => e.id === id) ?? none);

        // The code shows plain until highlight.js is there
        highlighter.then(() => this.requestUpdate());
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.#clear();
    }

    #clear() {
        this.#disposers.forEach(dispose => dispose());
        this.#disposers = [];
    }

    #select(example) {
        this.#clear();
        const stage = this.querySelector("[slot=stage]");
        const examples = example === everything ? this.examples.filter(e => !e.alone) : example === none ? [] : [example];
        this.#disposers = examples.flatMap(e => [e.apply(stage), e.reveal?.(stage)]).filter(Boolean);
        this.selected = example;

        try {
            sessionStorage.setItem(this.#storageKey, example.id);
        }
        catch { }
    }

    async #copy(code) {
        try {
            await navigator.clipboard.writeText(code);
            app.showAlert("Copied the code", "OK", 1500);
        }
        catch {
            app.showAlert("The browser did not allow copying", "Warning");
        }
    }

    #renderChoice(example) {
        return html`<li><button class="choice" aria-pressed=${String(this.selected === example)} @click=${() => this.#select(example)}>${example.title}</button></li>`;
    }

    render() {
        if (!this.selected)
            return nothing;

        const code = this.selected === everything ? this.examples.filter(e => !e.alone).map(source).join("\n\n") : this.selected === none ? null : source(this.selected);

        return html`
            <link rel="stylesheet" href=${highlightTheme}>
            <style>
                /* The layout of a Styling tab: the stage, and next to it the choices and the chosen one's code */
                :host { display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; }
                .stage { flex-shrink: 0; }
                /* Takes the rest of the width, so the code shows whole */
                .legend { flex: 1; min-width: 280px; display: flex; flex-direction: column; gap: 16px; position: sticky; top: 24px; }
                *:focus { outline: none; }
                nav { display: flex; flex-direction: column; gap: 12px; }
                .group { display: flex; flex-direction: column; gap: 6px; }
                h3 { font: 600 11px/1 "Open Sans", sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #5b6b73; margin: 0; }
                ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
                .choice { padding: 4px 12px; border: 1px solid #dce2e6; border-radius: 16px; background: #fff; font: 12.5px "Open Sans", sans-serif; color: #1f2a30; cursor: pointer; }
                .choice:hover { border-color: #b8c4cb; }
                .choice[aria-pressed="true"] { border-color: #F5A623; background: #fff6e6; }
                .about { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; background: #fff; border: 1px solid #e3e8eb; border-radius: 10px; }
                header { display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; }
                h2 { font: 600 14px "Open Sans", sans-serif; margin: 0; }
                p { margin: 0; color: #46545c; font-size: 13px; }
                .copy { flex-shrink: 0; border: 1px solid #dce2e6; background: #fff; border-radius: 6px; padding: 3px 10px; font: 12px "Open Sans", sans-serif; color: #3e4c53; cursor: pointer; }
                .copy:hover { border-color: #4682B4; color: #1d4f7a; }
                /* Scrolls within, so the page doesn't */
                pre { margin: 0; max-height: 360px; overflow: auto; border-radius: 6px; background: #0d1117; }
                /* Unwrapped, so the indentation holds; also overrides the scrolling and background of the theme's .hljs */
                pre code, pre code.hljs { display: inline-block; min-width: 100%; box-sizing: border-box; padding: 10px 14px; font: 12.5px/1.6 ui-monospace, Consolas, monospace; color: #e6edf3; white-space: pre; overflow: visible; background: none; }
            </style>
            <div class="stage"><slot name="stage"></slot></div>
            <div class="legend">
                <nav aria-label="Examples">
                    ${(this.groups ?? [{ examples: this.examples }]).map((group, index) => html`
                        <div class="group">
                            ${group.title ? html`<h3>${group.title}</h3>` : nothing}
                            <ol>
                                ${index === 0 ? this.#renderChoice(none) : nothing}
                                ${group.examples.map(example => this.#renderChoice(example))}
                                ${this.groups ? nothing : this.#renderChoice(everything)}
                            </ol>
                        </div>
                    `)}
                    ${this.groups ? html`<div class="group"><h3>All</h3><ol>${this.#renderChoice(everything)}</ol></div>` : nothing}
                </nav>
                <div class="about">
                    <header>
                        <h2>${this.selected.title}</h2>
                        ${code != null ? html`<button class="copy" @click=${() => this.#copy(code)}>Copy</button>` : nothing}
                    </header>
                    <p>${this.selected.text}</p>
                    ${code != null ? html`<pre>${highlight(code)}</pre>` : nothing}
                </div>
            </div>
        `;
    }
}

customElements.define("docs-examples", DocsExamples);

/**
 * The documentation site: a sidebar with every page, and the one page the address names, /<page>[/<tab>]. A page with
 * tabs gets them under its title; its element gets the open one as tab.
 */
class Docs extends WebComponent {
    static properties = {
        pages: { type: Array },
        sections: { state: true },
        current: { state: true },
        tab: { state: true },
        filter: { state: true },
        error: { state: true }
    };

    #addressChanged = () => this.#show();

    // Not as class fields: those would shadow the reactive accessors
    constructor() {
        super();

        this.pages = [];
        this.sections = [];
        this.current = null;
        this.tab = null;
        this.filter = "";
        this.error = null;
    }

    connectedCallback() {
        super.connectedCallback();

        window.addEventListener("popstate", this.#addressChanged);
        this.#load();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        window.removeEventListener("popstate", this.#addressChanged);
    }

    async #load() {
        try {
            await ready;
            if (!app.service.application)
                throw new Error("The Dev service gave no application, so the live examples cannot run.");

            // Past the browser's cache, so an edited page shows after the reload
            const version = Date.now();
            const modules = await Promise.all(this.pages.map(name => import(`./docs/${name}.js?v=${version}`)));
            const sections = this.pages.map((name, index) => ({ name, parent: name.includes("/") ? name.split("/")[0] : null, module: modules[index], element: null }));

            // Each page, followed by its sub-pages; both in their order, else by name
            const byOrder = (a, b) => (a.module.order ?? Infinity) - (b.module.order ?? Infinity) || a.name.localeCompare(b.name);
            this.sections = sections.filter(s => !s.parent).sort(byOrder).flatMap(top => [top, ...sections.filter(s => s.parent === top.name).sort(byOrder)]);

            this.#show();
            this.#watch();
        }
        catch (e) {
            this.error = String(e?.message ?? e);
        }
    }

    // Reloads when a script the page runs changes, such as a rebuilt index.js; the address keeps the page
    async #watch() {
        // The bundle, this shell, and every docs module the pages loaded, shared ones included
        const loadedModules = performance.getEntriesByType("resource").map(entry => new URL(entry.name)).filter(url => url.origin === location.origin && url.pathname.startsWith("/docs/") && url.pathname.endsWith(".js")).map(url => url.pathname);
        const urls = [...new Set(["/index.js", "/docs.js", ...this.pages.map(name => `/docs/${name}.js`), ...loadedModules])];
        const version = () => Promise.all(urls.map(url => fetch(url, { method: "HEAD", cache: "no-store" }).then(r => r.headers.get("etag") ?? r.headers.get("last-modified"), () => null))).then(tags => tags.join());

        const loaded = await version();
        let previous = loaded;
        while (this.isConnected) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const current = await version();
            // Wait until it holds still for a second, so a build that writes in steps reloads once, when it's done
            if (current !== loaded && current === previous && !current.split(",").includes("")) {
                location.reload();
                return;
            }

            previous = current;
        }
    }

    /** The page the address names, a sub-page (/menu/vi-menu-group) or a page (/menu), and the tab after it; else the first page. */
    #fromAddress() {
        const segments = location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
        for (const length of [2, 1]) {
            const name = segments.slice(0, length).join("/");
            if (segments.length >= length && this.sections.some(s => s.name === name))
                return { name, tab: segments[length] ?? null };
        }

        return { name: this.sections[0]?.name, tab: null };
    }

    #show() {
        const { name, tab } = this.#fromAddress();
        const section = this.sections.find(s => s.name === name);
        if (!section)
            return;

        // Made once, the first time it shows; only the page that shows is in the document, with its live demos
        section.element ??= document.createElement(section.module.tag);
        const tabs = section.module.tabs ?? [];
        this.tab = tabs.find(t => t.id === tab)?.id ?? tabs[0]?.id ?? null;
        section.element.tab = this.tab;
        this.current = section;

        const title = tabs.length ? `${section.module.title} · ${tabs.find(t => t.id === this.tab).title}` : section.module.title;
        document.title = `${title} · Documentation`;
    }

    #address(name, tab) {
        return `/${name}${tab ? `/${tab}` : ""}`;
    }

    #navigate(e, name, tab = null) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0)
            return;

        e.preventDefault();
        history.pushState(null, "", this.#address(name, tab));
        this.#show();
        window.scrollTo(0, 0);
    }

    #matches(section) {
        const filter = this.filter.trim().toLowerCase();
        return !filter || section.module.title.toLowerCase().includes(filter);
    }

    #renderLink(section) {
        return html`<a class="link" href=${this.#address(section.name)} aria-current=${this.current === section ? "page" : nothing} @click=${e => this.#navigate(e, section.name)}>${section.module.title}</a>`;
    }

    #renderNav() {
        return this.sections.filter(s => !s.parent).map(top => {
            const children = this.sections.filter(s => s.parent === top.name);
            const shown = this.#matches(top) ? children : children.filter(c => this.#matches(c));
            if (!this.#matches(top) && !shown.length)
                return nothing;

            return html`
                <li class="top">
                    ${this.#renderLink(top)}
                    ${shown.length ? html`<ul>${shown.map(child => html`<li>${this.#renderLink(child)}</li>`)}</ul>` : nothing}
                </li>
            `;
        });
    }

    #renderPage(section) {
        const { title, text, tabs = [] } = section.module;
        const parent = section.parent && this.sections.find(s => s.name === section.parent);

        return html`
            <div class="crumbs">
                <span>Documentation</span>
                ${parent ? html`<span aria-hidden="true">/</span><a href=${this.#address(parent.name)} @click=${e => this.#navigate(e, parent.name)}>${parent.module.title}</a>` : nothing}
                <span aria-hidden="true">/</span><span class="here">${title}</span>
            </div>
            <h1 class=${title.startsWith("vi-") ? "code" : ""}>${title}</h1>
            ${text ? html`<div class="text">${typeof text === "string" ? html`<p>${text}</p>` : text}</div>` : nothing}
            ${tabs.length ? html`
                <div class="tabs" role="tablist">
                    ${tabs.map(t => html`<a role="tab" href=${this.#address(section.name, t.id)} aria-selected=${String(this.tab === t.id)} @click=${e => this.#navigate(e, section.name, t.id)}>${t.title}</a>`)}
                </div>
            ` : nothing}
            ${section.element}
        `;
    }

    render() {
        return html`
            <style>
                *:focus { outline: none; }
                /* The Dev app's theme, which the live demos inherit */
                :host {
                    display: grid; grid-template-columns: 264px minmax(0, 1fr); min-height: 100vh; font: 14px/1.55 "Open Sans", system-ui, sans-serif; color: #1f2a30; background: #f7f8fa;
                    --color: #4682B4; --color-dark: #396992; --color-light: #7ea8cb; --colors-blue-grey-900: #263238; --theme-foreground: #333;
                    --theme-h1: 40px; --theme-h2: 32px; --theme-h3: 22px; --theme-h4: 12px; --theme-h5: 6px;
                    --theme-color-error: #a80511; --theme-color-notice: #48545e; --theme-color-ok: #339f7b; --theme-color-warning: #e5a300;
                }
                nav { position: sticky; top: 0; height: 100vh; overflow-y: auto; box-sizing: border-box; display: flex; flex-direction: column; gap: 20px; padding: 24px 16px; background: #fff; border-right: 1px solid #e3e8eb; }
                .brand { display: flex; align-items: center; gap: 10px; padding: 0 8px; color: inherit; text-decoration: none; font-weight: 700; font-size: 15px; }
                .brand span { width: 28px; height: 28px; border-radius: 7px; background: #263238; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; }
                .search { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border: 1px solid #dce2e6; border-radius: 8px; color: #5b6b73; }
                .search:focus-within { border-color: #4682B4; }
                .search input { border: 0; outline: 0; font: inherit; color: #1f2a30; flex: 1; min-width: 0; background: none; }
                nav ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
                nav li.top + li.top { margin-top: 8px; }
                .link { display: block; padding: 6px 8px; border-radius: 6px; color: #3e4c53; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .link:hover { background: #f0f3f5; color: #1f2a30; }
                .top > .link { font-weight: 600; color: #1f2a30; }
                li li .link { padding-left: 22px; }
                .link[aria-current="page"] { background: #eaf1f7; color: #1d4f7a; font-weight: 600; box-shadow: inset 2px 0 #4682B4; }
                main { min-width: 0; display: flex; flex-direction: column; gap: 20px; padding: 32px 48px 64px; }
                .crumbs { display: flex; gap: 8px; color: #5b6b73; font-size: 13px; }
                .crumbs a { color: #2f6a9a; text-decoration: none; }
                .crumbs a:hover { text-decoration: underline; }
                .crumbs .here { color: #1f2a30; }
                h1 { margin: -8px 0 0; font-size: 30px; font-weight: 700; line-height: 1.25; }
                h1.code { font-family: ui-monospace, Consolas, monospace; letter-spacing: -.01em; }
                .text { display: flex; flex-direction: column; gap: 10px; max-width: 820px; margin-top: -8px; }
                .text p { margin: 0; color: #46545c; font-size: 15px; }
                .text code { font: 13px ui-monospace, Consolas, monospace; background: #e7ebee; padding: 1px 5px; border-radius: 4px; }
                .tabs { display: flex; gap: 24px; border-bottom: 1px solid #e3e8eb; }
                .tabs a { padding: 10px 0; color: #5b6b73; text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -1px; }
                .tabs a:hover { color: #1f2a30; }
                .tabs a[aria-selected="true"] { color: #1d4f7a; font-weight: 600; border-bottom-color: #4682B4; }
                .muted { color: #5b6a72; }
                .error { color: #b3261e; }
                @media (max-width: 720px) {
                    :host { grid-template-columns: minmax(0, 1fr); }
                    nav { position: static; height: auto; padding: 16px; }
                    main { padding: 24px 16px; }
                }
            </style>
            <nav aria-label="Pages">
                <a class="brand" href="/" @click=${e => this.#navigate(e, this.sections[0]?.name)}><span>Vi</span>Vidyano docs</a>
                <label class="search">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M20 20l-4.5-4.5"></path></svg>
                    <input type="search" aria-label="Filter the pages" placeholder="Filter" .value=${this.filter} @input=${e => this.filter = e.target.value}>
                </label>
                <ul>${this.#renderNav()}</ul>
            </nav>
            <main>
                ${this.error ? html`<p class="error">${this.error}</p>` : !this.current ? html`<p class="muted">Loading…</p>` : this.#renderPage(this.current)}
            </main>
            <vi-alert></vi-alert>
        `;
    }
}

customElements.define("vi-docs", Docs);
