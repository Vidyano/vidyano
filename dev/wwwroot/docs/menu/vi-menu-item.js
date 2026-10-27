const { defineComponentPage, style } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu-item";
export const tag = "docs-menu-item";
export const order = 4;

defineComponentPage({
    tag,
    component: "vi-menu-item",
    text: "A leaf of the tree: a query, persistent object or url, which links to its page.",
    parts: [
        ["item", "The item's line. item is on every line of the tree; program-unit and group tell those apart."],
        ["icon", "The item's icon, when it has one."],
        ["title", "The item's title, with the search matches highlighted."],
        ["item-start, item-end", "The boxes of Menu.extend(\"item-start\") and Menu.extend(\"item-end\"), when an extension shows something there."]
    ],
    examples: [
        {
            id: "titles",
            title: "Titles",
            text: "Lighter titles on every line of the tree, items and program units alike.",
            apply: stage => style(stage, `
                vi-menu::part(title) { font-weight: 300; }
            `)
        },
        {
            id: "icons",
            title: "Icons",
            text: "Icons in the theme's light color.",
            apply: stage => style(stage, `
                vi-menu::part(icon) { fill: #7ea8cb; }
            `)
        }
    ]
});
