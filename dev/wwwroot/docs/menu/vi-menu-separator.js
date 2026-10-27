const { defineComponentPage, style } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu-separator";
export const tag = "docs-menu-separator";
export const order = 5;

defineComponentPage({
    tag,
    component: "vi-menu-separator",
    text: "A line between the items of a program unit or group. It hides while the menu filters. In the Dev application there is one in Attributes, right after FlagsEnum.",
    parts: [
        ["separator", "The line."]
    ],
    examples: [
        {
            id: "line",
            title: "Line",
            text: "A thicker line in the accent color.",
            apply: stage => style(stage, `
                vi-menu::part(separator) { height: 2px; background: #F5A623; }
            `)
        }
    ]
});
