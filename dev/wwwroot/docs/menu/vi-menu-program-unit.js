const { defineComponentPage, style } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu-program-unit";
export const tag = "docs-menu-program-unit";
export const order = 2;

defineComponentPage({
    tag,
    component: "vi-menu-program-unit",
    text: "A program unit: the top-level line with its icon, and below it the groups and items it holds. It opens for the active program unit.",
    parts: [
        ["item program-unit", "The program unit's line. program-unit is on its line only; item is on every line of the tree."],
        ["icon", "The program unit's icon."],
        ["title", "The program unit's title, with the search matches highlighted."],
        ["item-start, item-end", "The boxes of Menu.extend(\"item-start\") and Menu.extend(\"item-end\"), when an extension shows something there."],
        ["children", "The groups and items below the line."]
    ],
    examples: [
        {
            id: "line",
            title: "Line and hover",
            text: "An accent bar on the hovered program unit; pseudo-classes such as :hover work on parts too.",
            apply: stage => style(stage, `
                vi-menu::part(program-unit) { border-left: 3px solid transparent; }
                vi-menu::part(program-unit):hover { border-left-color: #F5A623; background: rgba(255, 255, 255, .06); }
            `)
        },
        {
            id: "children",
            title: "Children",
            text: "A guide line along the groups and items of a program unit.",
            apply: stage => style(stage, `
                vi-menu::part(children) { box-shadow: inset 1px 0 rgba(255, 255, 255, .15); margin-left: 22px; }
            `)
        }
    ]
});
