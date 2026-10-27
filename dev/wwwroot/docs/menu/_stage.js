// Shared by the menu's documentation pages: the live menu they demonstrate on, and the shape of a component page.
import { WebComponent, html, nothing } from "../../index.js";

export const app = window[Symbol.for("Vidyano.App")];

/** Whether the menu shows only icons: collapsed, and the mouse not over it. */
export const compact = menu => menu.collapsed && !menu.hovering;

/**
 * Adds CSS next to a live menu, in the scope where vi-menu::part(…) rules reach it.
 * @returns The function that removes it again.
 */
export function style(stage, css) {
    const element = document.createElement("style");
    element.textContent = css;
    stage.append(element);

    return () => element.remove();
}

/**
 * A live vi-menu on the Dev application's program units, next to a stand-in for the app, with Expanded and Collapsed
 * buttons. Clicks that would navigate show as a toast instead. It renders without a shadow root of its own, so the
 * menu sits in the page's scope, where the examples' ::part rules reach it.
 */
class DocsMenuStage extends WebComponent {
    static properties = {
        collapsed: { state: true }
    };

    // Not as class fields: those would shadow the reactive accessors
    constructor() {
        super();

        this.collapsed = false;
    }

    createRenderRoot() {
        return this;
    }

    #click(e) {
        // The menu's own toggle collapses it too; keep the buttons in step
        const menu = this.querySelector("vi-menu");
        menu.updateComplete.then(() => this.collapsed = menu.collapsed);

        const anchor = e.composedPath().find(n => n instanceof HTMLAnchorElement);
        if (!anchor?.hasAttribute("href") || anchor.getAttribute("rel")?.includes("external"))
            return;

        e.preventDefault();
        app.log(`navigates to ${anchor.getAttribute("href")}`);

        const unit = e.composedPath().find(n => n.tagName === "VI-MENU-PROGRAM-UNIT");
        if (unit)
            menu.activeProgramUnit = unit.item;
    }

    render() {
        const programUnits = app.service.application?.programUnits ?? [];

        return html`
            <style>
                docs-menu-stage { display: flex; flex-direction: column; gap: 10px; width: 420px; max-width: 100%; }
                docs-menu-stage .frame { height: 640px; display: flex; border-radius: 8px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.18); background: #f4f6f8; font: 13px "Open Sans", Arial, Helvetica, sans-serif; }
                docs-menu-stage vi-menu { --vi-menu--expand-width: 300px; flex-shrink: 0; }
                docs-menu-stage .app { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 14px; }
                docs-menu-stage .app i { display: block; height: 10px; border-radius: 5px; background: #dde3e7; }
                docs-menu-stage .app i:first-child { height: 26px; background: #4682B4; opacity: .85; border-radius: 4px; margin-bottom: 6px; }
                docs-menu-stage .controls { display: flex; gap: 6px; }
                docs-menu-stage .controls button { flex: 1; border: 1px solid #c5ced3; background: #fff; border-radius: 6px; padding: 5px 10px; font: 13px "Open Sans", sans-serif; cursor: pointer; }
                docs-menu-stage .controls button[aria-pressed="true"] { background: #1f2a30; border-color: #1f2a30; color: #fff; }
            </style>
            <div class="frame" @click=${e => this.#click(e)}>
                <!-- The page decides collapsed, not the menu-collapsed cookie the built-in toggle keeps -->
                <vi-menu .label=${"Dev"} .programUnits=${programUnits} .activeProgramUnit=${programUnits[0]} .collapsed=${this.collapsed}></vi-menu>
                <div class="app" aria-hidden="true"><i></i><i style="width: 70%"></i><i></i><i style="width: 85%"></i><i style="width: 60%"></i><i></i><i style="width: 75%"></i></div>
            </div>
            <div class="controls">
                <button aria-pressed=${String(!this.collapsed)} @click=${() => this.collapsed = false}>Expanded</button>
                <button aria-pressed=${String(this.collapsed)} @click=${() => this.collapsed = true}>Collapsed</button>
            </div>
        `;
    }
}

if (!customElements.get("docs-menu-stage"))
    customElements.define("docs-menu-stage", DocsMenuStage);

/** The styles every menu documentation page shares. */
export const pageStyles = html`
    <style>
        :host { display: block; }
        h1 { font-size: 28px; font-weight: 600; margin: 0 0 8px; }
        h1 code { font: inherit; background: none; padding: 0; }
        h2 { font-size: 19px; font-weight: 600; margin: 8px 0 0; }
        p { margin: 0; color: #46545c; }
        code { font: 12.5px ui-monospace, Consolas, monospace; background: #e7ebee; padding: 1px 5px; border-radius: 4px; }
        .intro { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; max-width: 900px; }
        .parts { border-collapse: collapse; margin: 4px 0 8px; font-size: 13.5px; }
        .parts th { text-align: left; font: 600 11px/1 "Open Sans", sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #6b7a82; padding: 6px 16px 6px 0; }
        .parts td { padding: 6px 16px 6px 0; border-top: 1px solid #dde3e7; vertical-align: top; color: #46545c; }
        .parts td:first-child { white-space: nowrap; }
    </style>
`;

/**
 * Defines the documentation page of one menu component: what it is, then its styling, the parts an outsider restyles
 * with vi-menu::part(…), with live examples. Behavior, the component's extension points, gets a section of its own.
 */
export function defineComponentPage({ tag, component, text, parts, examples }) {
    class DocsComponentPage extends WebComponent {
        render() {
            return html`
                ${pageStyles}
                <div class="intro">
                    <h1><code>${component}</code></h1>
                    <p>${text}</p>
                    <h2>Styling</h2>
                    <p>Its parts, which <code>vi-menu</code> passes on, so <code>vi-menu::part(name)</code> reaches them from outside the menu:</p>
                    <table class="parts">
                        <thead><tr><th>Part</th><th>What it is</th></tr></thead>
                        <tbody>${parts.map(([name, description]) => html`<tr><td><code>${name}</code></td><td>${description}</td></tr>`)}</tbody>
                    </table>
                </div>
                ${examples?.length ? html`
                    <docs-examples name=${tag} .examples=${examples}>
                        <docs-menu-stage slot="stage"></docs-menu-stage>
                    </docs-examples>
                ` : nothing}
            `;
        }
    }

    customElements.define(tag, DocsComponentPage);
}
