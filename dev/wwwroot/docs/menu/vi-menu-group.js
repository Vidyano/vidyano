const { defineComponentPage, style } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu-group";
export const tag = "docs-menu-group";
export const order = 3;

defineComponentPage({
    tag,
    component: "vi-menu-group",
    text: "A group of items in a program unit, which its line opens and closes. Groups can hold groups.",
    parts: [
        ["item group", "The group's line. group is on group lines only; item is on every line of the tree."],
        ["icon", "The chevron that shows whether the group is open."],
        ["title", "The group's title, with the search matches highlighted."],
        ["item-start, item-end", "The boxes of Menu.extend(\"item-start\") and Menu.extend(\"item-end\"), when an extension shows something there."],
        ["children", "The items and groups in the group."]
    ],
    examples: [
        {
            id: "line",
            title: "Group lines",
            text: "Group titles in small capitals, set apart from the items.",
            apply: stage => style(stage, `
                vi-menu::part(group) { font-variant: small-caps; letter-spacing: .04em; opacity: .85; }
            `)
        }
    ]
});
