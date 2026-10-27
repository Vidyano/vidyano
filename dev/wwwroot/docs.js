// The documentation site at http://docs.localhost:5000/: one page that keeps scrolling through every section, with a
// sidebar that follows it. A section is a module in docs/<name>.js that exports its title, the tag of the element that
// renders it and optionally an order; /<name>/ opens the page at that section.
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
 * JavaScript as a <code> element: highlighted once highlight.js is there, plain text until then or without it.
 */
export function highlight(code) {
    const element = document.createElement("code");
    if (!hljs) {
        element.textContent = code;
        return element;
    }

    element.className = "hljs language-javascript";
    // highlight.js escapes the code itself; the markup is its own
    element.innerHTML = hljs.highlight(code, { language: "javascript" }).value;
    return element;
}

/** An example's source, as a page shows it: the body of its apply function. */
function source(example) {
    const lines = example.apply.toString().replace(/^\(\)\s*=>\s*/, "").replace(/^\{\n?|\}$/g, "").split("\n");
    const indent = Math.min(...lines.slice(1).filter(line => line.trim()).map(line => line.match(/^\s*/)[0].length));

    return [lines[0], ...lines.slice(1).map(line => line.slice(indent))].join("\n").trim();
}

const everything = {
    id: "everything",
    title: "Everything",
    text: "All examples at once."
};

/**
 * The examples of a page: its live demo, which the page puts in the "stage" slot, the code of the selected example
 * and a floating list to pick one. An example is { id, title, text, apply }, where apply() turns it on and returns
 * the function that turns it off again. "Everything" turns them all on. The selection survives a reload.
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

        this.#select(this.examples.find(e => e.id === id) ?? everything);

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
        this.#disposers = (example === everything ? this.examples : [example]).map(e => e.apply());
        this.selected = example;

        try {
            sessionStorage.setItem(this.#storageKey, example.id);
        }
        catch { }
    }

    #renderChoice(example) {
        return html`<button class="choice" aria-pressed=${String(this.selected === example)} @click=${() => this.#select(example)}>${example.title}</button>`;
    }

    render() {
        if (!this.selected)
            return nothing;

        const code = this.selected === everything ? this.examples.map(source).join("\n\n") : source(this.selected);

        return html`
            <link rel="stylesheet" href=${highlightTheme}>
            <style>
                :host { display: grid; grid-template-columns: max-content minmax(0, 1fr) 230px; gap: 28px; align-items: start; }
                h2 { font-size: 17px; font-weight: 600; margin: 0; }
                p { margin: 0; color: #46545c; }
                /* As tall as the stage at most: the row takes its height from the stage, the code scrolls within */
                .detail { display: flex; flex-direction: column; gap: 10px; min-width: 0; align-self: stretch; contain: size; }
                pre { margin: 0; border-radius: 8px; overflow-y: auto; flex: 0 1 auto; min-height: 0; background: #0d1117; }
                /* Wrapped instead of scrolling sideways; also overrides the scrolling and background of the theme's .hljs */
                pre code, pre code.hljs { display: block; padding: 14px 16px; font: 12.5px/1.6 ui-monospace, Consolas, monospace; color: #e6edf3; white-space: pre-wrap; overflow-wrap: anywhere; overflow: visible; background: none; }
                /* Never taller than the window, so every choice is reachable while it sticks */
                .rail { position: sticky; top: 24px; max-height: calc(100vh - 48px); overflow-y: auto; box-sizing: border-box; overscroll-behavior: contain; background: #fff; border-radius: 10px; padding: 14px 10px; box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06); }
                .rail h3 { font: 600 10.5px/1 "Open Sans", sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #6b7a82; margin: 14px 10px 6px; }
                .choice { display: block; width: 100%; text-align: left; border: 0; background: none; border-radius: 6px; padding: 6px 10px; font: 13px "Open Sans", sans-serif; color: #33434b; cursor: pointer; }
                .choice:hover { background: #f0f3f5; color: #1f2a30; }
                .choice[aria-pressed="true"] { background: #e8f0f7; color: #1d4f7a; font-weight: 600; box-shadow: inset 2px 0 #4682B4; border-radius: 0 6px 6px 0; }
                @media (max-width: 1300px) { :host { grid-template-columns: max-content minmax(0, 1fr); } .rail { grid-column: 1 / -1; grid-row: 1; position: static; display: flex; flex-wrap: wrap; gap: 4px; } .rail h3 { display: none; } .choice { width: auto; } }
                @media (max-width: 900px) { :host { grid-template-columns: minmax(0, 1fr); } .detail { contain: none; } pre { max-height: 640px; } }
            </style>
            <slot name="stage"></slot>
            <div class="detail">
                <h2>${this.selected.title}</h2>
                <p>${this.selected.text}</p>
                <pre>${highlight(code)}</pre>
            </div>
            <nav class="rail" aria-label="Examples">
                ${this.#renderChoice(everything)}
                ${(this.groups ?? [{ examples: this.examples }]).map(group => html`
                    ${group.title ? html`<h3>${group.title}</h3>` : nothing}
                    ${group.examples.map(example => this.#renderChoice(example))}
                `)}
            </nav>
        `;
    }
}

customElements.define("docs-examples", DocsExamples);


const reloadScrollKey = "docs:reload-scroll";

class Docs extends WebComponent {
    static properties = {
        pages: { type: Array },
        sections: { state: true },
        current: { state: true },
        error: { state: true }
    };

    #observer;
    #popstate = () => this.#scrollTo(this.#fromPath(), "auto");

    // Not as class fields: those would shadow the reactive accessors
    constructor() {
        super();

        this.pages = [];
        this.sections = [];
        this.current = null;
        this.error = null;
    }

    connectedCallback() {
        super.connectedCallback();

        window.addEventListener("popstate", this.#popstate);
        this.#load();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        window.removeEventListener("popstate", this.#popstate);
        this.#observer?.disconnect();
    }

    async #load() {
        try {
            await ready;
            if (!app.service.application)
                throw new Error("The Dev service gave no application, so the live examples cannot run.");

            // Past the browser's cache, so an edited page shows after the reload
            const version = Date.now();
            const modules = await Promise.all(this.pages.map(name => import(`./docs/${name}.js?v=${version}`)));
            this.sections = this.pages
                .map((name, index) => ({ name, module: modules[index], element: document.createElement(modules[index].tag) }))
                .sort((a, b) => (a.module.order ?? Infinity) - (b.module.order ?? Infinity) || a.name.localeCompare(b.name));

            await this.updateComplete;
            this.#observe();

            const scrollY = this.#takeReloadScroll();
            if (scrollY != null)
                window.scrollTo(0, scrollY);
            else
                this.#scrollTo(this.#fromPath(), "auto");

            this.#watch();
        }
        catch (e) {
            this.error = String(e?.message ?? e);
        }
    }

    // Reloads when a script the page runs changes, such as a rebuilt index.js, and comes back at the same scroll position
    async #watch() {
        const urls = ["/index.js", "/docs.js", ...this.pages.map(name => `/docs/${name}.js`)];
        const version = () => Promise.all(urls.map(url => fetch(url, { method: "HEAD", cache: "no-store" }).then(r => r.headers.get("etag") ?? r.headers.get("last-modified"), () => null))).then(tags => tags.join());

        const loaded = await version();
        let previous = loaded;
        while (this.isConnected) {
            await new Promise(resolve => setTimeout(resolve, 1000));

            const current = await version();
            // Wait until it holds still for a second, so a build that writes in steps reloads once, when it's done
            if (current !== loaded && current === previous && !current.split(",").includes("")) {
                try {
                    sessionStorage.setItem(reloadScrollKey, String(window.scrollY));
                }
                catch { }

                location.reload();
                return;
            }

            previous = current;
        }
    }

    #takeReloadScroll() {
        try {
            const value = sessionStorage.getItem(reloadScrollKey);
            sessionStorage.removeItem(reloadScrollKey);

            return value != null ? Number(value) : null;
        }
        catch {
            return null;
        }
    }

    #fromPath() {
        const name = location.pathname.split("/").filter(Boolean)[0];
        return this.sections.some(s => s.name === name) ? name : this.sections[0]?.name;
    }

    // The section at the top of the viewport is the current one; the sidebar and the address follow it
    #observe() {
        const visible = new Set();
        this.#observer = new IntersectionObserver(entries => {
            entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target.id) : visible.delete(entry.target.id));

            const current = this.sections.find(s => visible.has(s.name))?.name;
            if (!current || current === this.current)
                return;

            this.current = current;
            history.replaceState(null, "", `/${current}/`);
            document.title = `${this.sections.find(s => s.name === current).module.title} · Documentation`;
        }, { rootMargin: "0px 0px -70% 0px" });

        this.renderRoot.querySelectorAll("main > section").forEach(section => this.#observer.observe(section));
    }

    #scrollTo(name, behavior) {
        this.renderRoot.querySelector(`section#${CSS.escape(name ?? "")}`)?.scrollIntoView({ behavior, block: "start" });
    }

    #navigate(e, name) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0)
            return;

        e.preventDefault();
        history.pushState(null, "", `/${name}/`);
        this.#scrollTo(name, "smooth");
    }

    render() {
        return html`
            <style>
                /* The Dev app's theme, which the live demos inherit */
                :host {
                    display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: 100vh; font: 14px/1.55 "Open Sans", system-ui, sans-serif; color: #1f2a30; background: #F4F6F8;
                    --color: #4682B4; --color-dark: #396992; --color-light: #7ea8cb; --colors-blue-grey-900: #263238; --theme-foreground: #333;
                    --theme-h1: 40px; --theme-h2: 32px; --theme-h3: 22px; --theme-h4: 12px; --theme-h5: 6px;
                    --theme-color-error: #a80511; --theme-color-notice: #48545e; --theme-color-ok: #339f7b; --theme-color-warning: #e5a300;
                }
                nav { background: #1f2a30; color: #e8edf0; padding: 24px 0; position: sticky; top: 0; height: 100vh; box-sizing: border-box; overflow-y: auto; }
                nav > span { display: block; padding: 0 20px 18px; color: #fff; font-size: 17px; font-weight: 600; }
                nav ul { list-style: none; margin: 0; padding: 0; }
                nav li a { display: block; padding: 8px 20px; color: #c9d3d8; text-decoration: none; }
                nav li a:hover { background: rgba(255,255,255,.06); color: #fff; }
                nav li a[aria-current="true"] { background: rgba(255,255,255,.1); color: #fff; box-shadow: inset 3px 0 #4682B4; }
                main { padding: 40px 48px; min-width: 0; }
                main > section { scroll-margin-top: 24px; padding-bottom: 64px; }
                main > section + section { border-top: 1px solid #dde3e7; padding-top: 40px; }
                .muted { color: #5b6a72; }
                .error { color: #b3261e; }
                @media (max-width: 720px) {
                    :host { grid-template-columns: minmax(0, 1fr); }
                    nav { position: static; height: auto; padding: 16px 0 8px; }
                    main { padding: 24px 16px; }
                }
            </style>
            <nav aria-label="Sections">
                <span>Documentation</span>
                <ul>
                    ${this.sections.map(s => html`
                        <li><a href="/${s.name}/" aria-current=${this.current === s.name ? "true" : nothing} @click=${e => this.#navigate(e, s.name)}>${s.module.title}</a></li>
                    `)}
                </ul>
            </nav>
            <main>
                ${this.error ? html`<p class="error">${this.error}</p>` : !this.sections.length ? html`<p class="muted">Loading…</p>` : nothing}
                ${this.sections.map(s => html`<section id=${s.name}>${s.element}</section>`)}
            </main>
            <vi-alert></vi-alert>
        `;
    }
}

customElements.define("vi-docs", Docs);
