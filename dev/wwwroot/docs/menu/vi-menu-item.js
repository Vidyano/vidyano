import { Menu, MenuItem, WebComponent, html, nothing } from "../../index.js";

const { compact, defineComponentPage } = await import(`./_stage.js${new URL(import.meta.url).search}`);

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

/** The pin toggle on an item's line. */
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
                <div style="display: flex; align-items: center; gap: var(--vi-menu-item-gap); padding-left: var(--vi-menu-item-padding-left); margin-bottom: var(--theme-h5); line-height: var(--vi-menu-item-height); font-weight: 600; text-transform: uppercase">
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

export const title = "vi-menu-item";
export const tag = "docs-menu-item";
export const order = 4;

export const { text, tabs } = defineComponentPage({
    tag,
    component: "vi-menu-item",
    text: "A leaf of the tree: a query, persistent object or url, which links to its page.",
    behavior: {
        examples: [
            {
                id: "pins",
                title: "State of your own",
                text: "A pin on every item, and the pinned items above the tree. State the menu doesn't know about belongs in a component of your own, which renders again when that state changes: here <docs-pin> and <docs-pinned> share a small store.",
                apply: () => {
                    const pins = MenuItem.extend("end", (menu, item) => html`<docs-pin .item=${item}></docs-pin>`);
                    const list = Menu.extend("before-items", menu => compact(menu) ? nothing : html`<docs-pinned></docs-pinned>`);

                    return () => { pins(); list(); };
                }
            },
            {
                id: "new",
                title: "Before the icon",
                text: "A dot marks the items whose title starts with \"Select\".",
                reveal: stage => stage.reveal("Components", "Query Grid"),
                apply: () => MenuItem.extend("start", (menu, item) => item.title?.startsWith("Select") ? html`
                    <small title="New" style="width: 7px; height: 7px; border-radius: 50%; background: #4FC3F7; flex-shrink: 0"></small>
                ` : nothing)
            }
        ]
    },
    states: [
        { id: "default", label: "Default" },
        { id: "searching", label: "Searching", searching: true }
    ],
    regions: MenuItem,
    parts: [
        { name: "item", text: "The item's line." },
        { name: "item-icon", text: "The item's icon, for an item that has one." },
        { name: "item-title", text: "The item's title, with the search matches highlighted." },
        { name: "item-match", text: "A match of the search in the title.", when: "Only while searching." },
        { name: "item-start", text: "The box of MenuItem.extend(\"start\"), before the icon." },
        { name: "item-end", text: "The box of MenuItem.extend(\"end\"), after the title." }
    ]
});
