import { Menu, WebComponent, html, nothing } from "../index.js";

// Shared with the component pages, at the version this page was loaded at, so all of them share one module
const { compact, pageStyles } = await import(`./menu/_stage.js${new URL(import.meta.url).search}`);

export const title = "Menu";
export const tag = "docs-menu";

const badge = "font: 600 11px/1 'Open Sans', sans-serif; background: #F5A623; color: #1d1d1d; border-radius: 9px; padding: 3px 7px; text-transform: none; flex-shrink: 0";
const pill = "border: 1px solid rgba(255,255,255,.3); background: none; color: inherit; border-radius: 12px; padding: 3px 10px; font: 12px 'Open Sans', sans-serif; cursor: pointer";

/** The pinned items, by name: a small store that tells its components when it changes. */
const pinned = new class extends EventTarget {
    items = new Map();

    has(item) {
        return this.items.has(item.name);
    }

    toggle(item) {
        this.items.delete(item.name) || this.items.set(item.name, item);
        this.dispatchEvent(new Event("change"));
    }
};

/** Renders again when the pinned items change, so the menu never has to. */
class PinnedComponent extends WebComponent {
    #changed = () => this.requestUpdate();

    connectedCallback() {
        super.connectedCallback();
        pinned.addEventListener("change", this.#changed);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        pinned.removeEventListener("change", this.#changed);
    }
}

/** The pin toggle on a row. */
class DocsPin extends PinnedComponent {
    static properties = { item: { type: Object } };

    #toggle() {
        pinned.toggle(this.item);
    }

    render() {
        const on = pinned.has(this.item);

        return html`
            <button aria-label=${`Pin ${this.item.title}`} aria-pressed=${String(on)} @click=${this.#toggle}
                style="display: block; width: var(--vi-menu-item-icon-size); padding: 0; border: 0; background: none; cursor: pointer; text-align: center; font-size: 13px; color: ${on ? "#F5C542" : "rgba(255,255,255,.35)"}">${on ? "★" : "☆"}</button>
        `;
    }
}

/** The pinned items, styled like a program unit and its items from the menu's own custom properties. */
class DocsPinned extends PinnedComponent {
    render() {
        if (!pinned.items.size)
            return nothing;

        return html`
            <div style="margin: var(--vi-menu-program-unit-spacing) 0">
                <div style="display: flex; align-items: center; gap: var(--vi-menu-item-gap); padding-left: var(--vi-menu-item-padding-left); line-height: var(--vi-menu-item-height); font-weight: 600; text-transform: uppercase">
                    <span style="width: var(--vi-menu-program-unit-icon-size); flex-shrink: 0; display: flex; justify-content: center"><span style="font-size: 1.25em; color: #F5C542">★</span></span>Pinned
                </div>
                ${[...pinned.items.values()].map(item => html`
                    <a href=${item.path} style="display: block; line-height: var(--vi-menu-item-height); padding-left: calc(var(--vi-menu-item-padding-left) + var(--vi-menu-program-unit-icon-size) + var(--vi-menu-item-gap)); color: inherit; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">${item.title}</a>
                `)}
            </div>
        `;
    }
}

customElements.define("docs-pin", DocsPin);
customElements.define("docs-pinned", DocsPinned);

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
                <span style="font: 600 10px/1 'Open Sans', sans-serif; letter-spacing: .1em; background: #F5A623; color: #1d1d1d; padding: 4px 8px; border-radius: 10px">STAGING</span>
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
        id: "pins",
        title: "State of your own",
        text: "A pin on every item, and the pinned items above the tree. State the menu doesn't know about belongs in a component of your own, which renders again when that state changes: here <docs-pin> and <docs-pinned> share a small store.",
        apply: () => {
            const pins = Menu.extend("item-end", (menu, item) => item.items ? nothing : html`<docs-pin .item=${item}></docs-pin>`);
            const list = Menu.extend("before-items", menu => compact(menu) ? nothing : html`<docs-pinned></docs-pinned>`);

            return () => { pins(); list(); };
        }
    },
    {
        id: "counts",
        title: "After a row's title",
        text: "item-end runs for every row of the tree. Here groups show how many items they hold; collapsed, the program units show a dot.",
        apply: () => Menu.extend("item-end", (menu, item) => {
            if (!item.items?.length)
                return nothing;

            if (compact(menu))
                // On the icon's top right corner; the region lies over the whole row while the menu shows only icons
                return html`<small style="position: absolute; top: 3px; right: 7px; width: 8px; height: 8px; border-radius: 50%; background: #F5A623; box-shadow: 0 0 0 2px var(--colors-blue-grey-900)"></small>`;

            // Centered on the column of the pins and chevrons, however wide the count makes it
            return html`<small style="${badge}; transform: translateX(calc(50% - var(--vi-menu-item-icon-size) / 2))">${item.items.length}</small>`;
        })
    },
    {
        id: "new",
        title: "Before a row's icon",
        text: "item-start runs for every row of the tree. Here a dot marks the items whose title starts with \"Select\".",
        apply: () => Menu.extend("item-start", (menu, item) => item.title?.startsWith("Select") ? html`
            <small title="New" style="width: 7px; height: 7px; border-radius: 50%; background: #4FC3F7; flex-shrink: 0"></small>
        ` : nothing)
    },
    {
        id: "help",
        title: "After the tree",
        text: "Links below the program units.",
        apply: () => Menu.extend("after-items", menu => compact(menu) ? nothing : html`
            <div style="margin-top: 8px; padding: 8px var(--theme-h4); border-top: 1px solid rgba(255,255,255,.1); display: flex; flex-direction: column; line-height: var(--theme-h2)">
                <a href="https://www.vidyano.com" target="_blank" rel="external noopener" style="color: #cfe0ee; text-decoration: none">? Help center</a>
                <a href="https://github.com/Vidyano/vidyano" target="_blank" rel="external noopener" style="color: #cfe0ee; text-decoration: none">↗ What's new</a>
            </div>
        `)
    },
    {
        id: "status",
        title: "Above the user bar",
        text: "The footer region sits between the footer slot and the user bar. This line follows the menu's state.",
        apply: () => Menu.extend("footer", menu => compact(menu) ? nothing : html`
            <div style="display: flex; align-items: center; gap: 8px; padding: 6px var(--theme-h4); font-size: 12px; line-height: normal; opacity: .85">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #66BB6A"></span>
                ${menu.filter ? `Searching "${menu.filter}"` : menu.collapsed ? "Collapsed, hovering" : "Expanded"}
            </div>
        `)
    },
    {
        id: "tenant",
        title: "Replace the header",
        text: "Menu.replace swaps out the built-in content. Extensions of the region stay around the replacement.",
        apply: () => Menu.replace("header", menu => compact(menu) ? nothing : html`
            <div style="display: flex; align-items: center; gap: 10px; padding: 14px 16px; text-align: left; line-height: normal">
                <div style="width: 32px; height: 32px; border-radius: 50%; background: #FAFAFA; color: var(--color-dark); display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0">NB</div>
                <div style="display: flex; flex-direction: column"><b>Northwind BV</b><span style="font-size: 12px; opacity: .8">Switch tenant ▾</span></div>
            </div>
        `)
    },
    {
        id: "command",
        title: "Replace the search box",
        text: "The search region replaced by a button that could open a command palette.",
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
                <div style="display: flex; align-items: center; gap: 10px; padding: 8px var(--theme-h4); line-height: normal">
                    <div style="width: 30px; height: 30px; border-radius: 50%; background: #5C8DB8; display: flex; align-items: center; justify-content: center; font: 600 11px 'Open Sans', sans-serif; flex-shrink: 0">${initials}</div>
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
                style="width: var(--vi-menu-collapsed-width); height: var(--vi-menu-collapsed-width); border: 0; background: ${menu.collapsed ? "var(--color-dark)" : "transparent"}; color: #FAFAFA; font-size: 16px; cursor: pointer">${menu.collapsed ? "»" : "«"}</button>
        `)
    },
    {
        id: "wrap-search",
        title: "Wrap the search box",
        text: "A replacement gets what it replaces as original: wrap it instead of rebuilding it. The built-in search box keeps working inside the frame.",
        apply: () => Menu.replace("search", (menu, original) => compact(menu) ? original : html`
            <div style="margin: var(--vi-menu-search-margin); padding: 4px; border-radius: 8px; background: rgba(0,0,0,.25)">
                ${original}
                <div style="padding: 2px 8px 4px; font-size: 11px; opacity: .7; line-height: normal">Enter searches everything</div>
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
            <div class="intro">
                <h1>Menu</h1>
                <p><code>Menu.extend(region, render, { before })</code> adds content to a region of every <code>vi-menu</code>, after its built-in content unless <code>before</code> is set. <code>Menu.replace(region, render)</code> swaps the built-in content out and gets it as <code>original</code>, to wrap or leave out; the last replacement decides. Both return a function that undoes them.</p>
                <p>A render function gets the menu, so it can follow <code>collapsed</code>, <code>hovering</code>, <code>filter</code> and <code>activeProgramUnit</code>; <code>item-start</code> and <code>item-end</code> also get the row's item. The pages under Menu show how to style each of its components.</p>
            </div>
            <docs-examples name="menu" .examples=${examples} .groups=${groups}>
                <docs-menu-stage slot="stage"></docs-menu-stage>
            </docs-examples>
        `;
    }
}

customElements.define(tag, DocsMenu);
