const { defineComponentPage } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu-separator";
export const tag = "docs-menu-separator";
export const order = 5;

export const { text, tabs } = defineComponentPage({
    tag,
    component: "vi-menu-separator",
    text: "A line between the items of a program unit or group.",
    states: [{ id: "default", label: "Default" }],
    parts: [
        { name: "separator", text: "The line. It hides while the menu filters." }
    ]
});
