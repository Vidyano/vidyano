const { defineComponentPage } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu";
export const tag = "docs-menu-vi-menu";
export const order = 1;

export const { text, tabs } = defineComponentPage({
    tag,
    component: "vi-menu",
    text: "The menu itself: the header with the application's label, the search, the program units and the footer with the user bar. It renders a vi-menu-program-unit for every program unit. Its regions are on the Menu page.",
    parts: [
        { name: "header", text: "The top of the menu: the label and the search box." },
        { name: "label", text: "The application's label, or what the label slot holds.", when: "Not while the menu shows only icons." },
        { name: "search", text: "The search box; only its button while the menu shows only icons." },
        { name: "instant-search", text: "The instant search results.", when: "Only while searching, in an application with instant search." },
        { name: "items", text: "The scrolling area with the program units." },
        { name: "footer", text: "The bottom of the menu: the footer slot and the user bar.", when: "Not while the menu shows only icons." },
        { name: "toggle", text: "The collapse button in the top right corner." },
        { name: "resizer", text: "The edge on the right that resizes the menu.", when: "It has no width until the pointer is on it." }
    ]
});
