import { Menu, WebComponent, html, nothing } from "../index.js";

// Shared with the component pages, at the version this page was loaded at, so all of them share one module
const { compact, pageStyles } = await import(`./menu/_stage.js${new URL(import.meta.url).search}`);

export const title = "Menu";
export const tag = "docs-menu";
export const text = html`
    <p><code>Menu.extend(region, render, { before })</code> adds content to a region of every <code>vi-menu</code>, after its built-in content unless <code>before</code> is set. <code>Menu.replace(region, render)</code> swaps the built-in content out and gets it as <code>original</code>, to wrap or leave out; the last replacement decides. Both return a function that undoes them.</p>
    <p>A render function gets the menu, so it can follow <code>collapsed</code>, <code>hovering</code>, <code>filter</code> and <code>activeProgramUnit</code>. The rows of the tree have regions of their own, through <code>MenuProgramUnit.extend</code>, <code>MenuGroup.extend</code> and <code>MenuItem.extend</code>: the pages under Menu show those, and the parts of each component.</p>
`;

// The column of the program units' icons: what a row puts in it lines up with them, and its text with their titles
const row = "display: flex; align-items: center; gap: var(--vi-menu-item-gap); padding-left: var(--vi-menu-item-padding-left)";
const iconColumn = "width: var(--vi-menu-program-unit-icon-size); flex-shrink: 0; display: flex; justify-content: center";
const pill = "border: 1px solid rgba(255,255,255,.3); background: none; color: inherit; border-radius: 12px; padding: 3px 10px; font: 12px 'Open Sans', sans-serif; cursor: pointer";

/**
 * The examples: each turns one capability on and returns the function that turns it off again.
 * The page shows the source of the selected one.
 */
const examples = [
    {
        id: "logo",
        title: "Before the header",
        text: "Content before the built-in title, here a logo that shrinks with the collapsed menu.",
        apply: () => Menu.extend("header", menu => html`
            <div style="display: flex; justify-content: center; padding: ${compact(menu) ? "calc(var(--vi-menu-collapsed-width) + 8px) 0 8px" : "12px 0 0"}">
                <div style="width: ${compact(menu) ? 26 : 36}px; height: ${compact(menu) ? 26 : 36}px; border-radius: 8px; background: #FAFAFA; color: var(--color-dark); display: flex; align-items: center; justify-content: center; font: 700 13px/1 'Open Sans', sans-serif">Vi</div>
            </div>
        `, { before: true })
    },
    {
        id: "environment",
        title: "After the header",
        text: "Content after the built-in title, here an environment tag that hides in the collapsed menu.",
        apply: () => Menu.extend("header", menu => compact(menu) ? nothing : html`
            <div style="padding-bottom: 10px; line-height: normal">
                <span style="display: inline-block; font: 600 10px/1 'Open Sans', sans-serif; letter-spacing: .1em; background: #F5A623; color: #1d1d1d; padding: 4px 8px; border-radius: 10px">STAGING</span>
            </div>
        `)
    },
    {
        id: "quick-links",
        title: "Under the search box",
        text: "Quick links that hide while the user searches, since the render function sees menu.filter.",
        apply: () => Menu.extend("search", menu => menu.filter || compact(menu) ? nothing : html`
            <div style="display: flex; gap: 6px; padding: 0 var(--vi-menu-search-margin) var(--vi-menu-search-margin); line-height: normal">
                <button style=${pill} @click=${() => menu.app.changePath("Home/People")}>+ Person</button>
                <button style=${pill} @click=${() => menu.app.changePath("Home/Orders")}>+ Order</button>
            </div>
        `)
    },
    {
        id: "help",
        title: "After the tree",
        text: "Links below the program units.",
        apply: () => Menu.extend("after-items", menu => compact(menu) ? nothing : html`
            <div style="margin-top: 8px; padding: 8px 0; border-top: 1px solid rgba(255,255,255,.1); line-height: var(--vi-menu-item-height)">
                <a href="https://www.vidyano.com" target="_blank" rel="external noopener" style="${row}; color: #cfe0ee; text-decoration: none"><span style=${iconColumn}>?</span>Help center</a>
                <a href="https://github.com/Vidyano/vidyano" target="_blank" rel="external noopener" style="${row}; color: #cfe0ee; text-decoration: none"><span style=${iconColumn}>↗</span>What's new</a>
            </div>
        `)
    },
    {
        id: "status",
        title: "Above the user bar",
        text: "The footer region sits between the footer slot and the user bar. This line follows the menu's state.",
        apply: () => Menu.extend("footer", menu => compact(menu) ? nothing : html`
            <div style="${row}; padding-block: 6px; font-size: 12px; line-height: normal; opacity: .85">
                <span style=${iconColumn}><span style="width: 8px; height: 8px; border-radius: 50%; background: #66BB6A"></span></span>
                ${menu.filter ? `Searching "${menu.filter}"` : menu.collapsed ? "Collapsed, hovering" : "Expanded"}
            </div>
        `)
    },
    {
        id: "tenant",
        title: "Replace the header",
        text: "Menu.replace swaps out the built-in content. Extensions of the region stay around the replacement.",
        alone: true,
        // Collapsed, it keeps the room of the collapse button, which sits on top of it
        apply: () => Menu.replace("header", menu => compact(menu) ? html`<div style="height: var(--vi-menu-collapsed-width)"></div>` : html`
            <div style="${row}; padding-block: 14px; text-align: left; line-height: normal">
                <span style=${iconColumn}><div style="width: 32px; height: 32px; border-radius: 50%; background: #FAFAFA; color: var(--color-dark); display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0">NB</div></span>
                <div style="display: flex; flex-direction: column"><b>Northwind BV</b><span style="font-size: 12px; opacity: .8">Switch tenant ▾</span></div>
            </div>
        `)
    },
    {
        id: "command",
        title: "Replace the search box",
        text: "The search region replaced by a button that could open a command palette.",
        alone: true,
        apply: () => Menu.replace("search", menu => compact(menu) ? html`
            <button aria-label="Search everything" title="Search everything" @click=${() => menu.app.showMessageDialog({ title: "Command palette" })}
                style="display: flex; align-items: center; justify-content: center; width: var(--vi-menu-collapsed-width); height: var(--vi-menu-collapsed-width); border: 0; background: none; color: inherit; cursor: pointer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="6"></circle><path d="M20 20l-4.5-4.5"></path></svg>
            </button>
        ` : html`
            <button style="margin: var(--vi-menu-search-margin); width: calc(100% - 2 * var(--vi-menu-search-margin)); text-align: left; border: 1px solid rgba(255,255,255,.25); background: rgba(0,0,0,.15); color: inherit; border-radius: 4px; padding: 8px 10px; font: 13px 'Open Sans', sans-serif; cursor: pointer"
                @click=${() => menu.app.showMessageDialog({ title: "Command palette" })}>⌘K  Search everything…</button>
        `)
    },
    {
        id: "user",
        title: "Replace the user bar",
        text: "A user card instead of vi-user, from the signed-in user of the service.",
        apply: () => Menu.replace("user", menu => {
            const name = menu.service?.application?.friendlyUserName || menu.service?.application?.userName || "Guest";
            const initials = name.split(/[\s.@\\]+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("");

            // A collapsed menu hides its footer, the user bar included, until hovered
            return compact(menu) ? nothing : html`
                <div style="${row}; padding-block: 8px; line-height: normal">
                    <span style=${iconColumn}><div style="width: 30px; height: 30px; border-radius: 50%; background: #5C8DB8; display: flex; align-items: center; justify-content: center; font: 600 11px 'Open Sans', sans-serif; flex-shrink: 0">${initials}</div></span>
                    <b style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">${name}</b>
                </div>
            `;
        })
    },
    {
        id: "toggle",
        title: "Replace the collapse button",
        text: "The toggle region holds the collapse button in the top right corner; collapsed, it sits on top of the menu.",
        apply: () => Menu.replace("toggle", menu => html`
            <button aria-label=${menu.collapsed ? "Expand menu" : "Collapse menu"} @click=${() => menu.collapsed = !menu.collapsed}
                style="width: var(--vi-menu-collapsed-width); height: var(--vi-menu-collapsed-width); border: 0; background: ${menu.collapsed ? "var(--color-dark)" : "transparent"}; color: #FAFAFA; font: 16px 'Open Sans', sans-serif; cursor: pointer">${menu.collapsed ? "»" : "«"}</button>
        `)
    },
    {
        id: "wrap-search",
        title: "Wrap the search box",
        text: "A replacement gets what it replaces as original: wrap it instead of rebuilding it. The built-in search box keeps working inside the frame.",
        apply: () => Menu.replace("search", (menu, original) => compact(menu) ? original : html`
            <div style="margin: var(--vi-menu-search-margin); padding: 4px; border-radius: 8px; background: rgba(0,0,0,.25)">
                ${original}
                <div style="padding: 2px 8px 4px; font-size: 11px; opacity: .7; line-height: normal; text-align: left">Enter searches everything</div>
            </div>
        `)
    }
];

const groups = [
    { title: "Menu.extend", examples: examples.filter(e => !e.apply.toString().includes("Menu.replace")) },
    { title: "Menu.replace", examples: examples.filter(e => e.apply.toString().includes("Menu.replace")) }
];

class DocsMenu extends WebComponent {
    render() {
        return html`
            ${pageStyles}
            <docs-examples name="menu" .examples=${examples} .groups=${groups}>
                <docs-menu-stage slot="stage"></docs-menu-stage>
            </docs-examples>
        `;
    }
}

customElements.define(tag, DocsMenu);
