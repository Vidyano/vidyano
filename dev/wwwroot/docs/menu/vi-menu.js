const { defineComponentPage, style } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu";
export const tag = "docs-menu-vi-menu";
export const order = 1;

defineComponentPage({
    tag,
    component: "vi-menu",
    text: "The menu itself: the header with the application's label, the search, the program units and the footer with the user bar. It renders a vi-menu-program-unit for every program unit.",
    parts: [
        ["header", "The top of the menu: the label and the search box."],
        ["label", "The application's label, or what the label slot holds."],
        ["search", "The search box."],
        ["instant-search", "The instant search results, while searching."],
        ["items", "The scrolling area with the program units."],
        ["footer", "The bottom of the menu: the footer slot and the user bar."],
        ["toggle", "The collapse button in the top right corner."],
        ["resizer", "The edge that resizes the menu."]
    ],
    examples: [
        {
            id: "label",
            title: "Label",
            text: "A lighter, spaced-out label.",
            apply: stage => style(stage, `
                vi-menu::part(label) { font-weight: 300; letter-spacing: .2em; text-transform: uppercase; }
            `)
        },
        {
            id: "search",
            title: "Search box",
            text: "A rounded search box on a lighter ground.",
            apply: stage => style(stage, `
                vi-menu::part(search) { border-radius: 16px; background: rgba(255, 255, 255, .08); }
            `)
        },
        {
            id: "footer-resizer",
            title: "Footer and resizer",
            text: "An accent line above the footer, and a resizer that shows where to drag.",
            apply: stage => style(stage, `
                vi-menu::part(footer) { border-top: 2px solid #F5A623; }
                vi-menu::part(resizer) { background: rgba(245, 166, 35, .5); opacity: 1; }
            `)
        }
    ]
});
