import { MenuGroup, html } from "../../index.js";

const { badge, defineComponentPage } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu-group";
export const tag = "docs-menu-group";
export const order = 3;

export const { text, tabs } = defineComponentPage({
    tag,
    component: "vi-menu-group",
    text: "A group of items in a program unit, which its line opens and closes. Groups can hold groups.",
    behavior: {
        examples: [
            {
                id: "counts",
                title: "After the title",
                text: "How many items each group holds.",
                reveal: stage => stage.reveal("Attributes"),
                apply: () => MenuGroup.extend("end", (menu, group) => html`<small style="${badge}">${group.items.length}</small>`)
            }
        ]
    },
    states: [
        { id: "open", label: "Open", open: true },
        { id: "closed", label: "Closed", open: false },
        { id: "searching", label: "Searching", searching: true, open: true }
    ],
    regions: MenuGroup,
    parts: [
        { name: "group", text: "The group's line." },
        { name: "group-toggle", text: "The chevron that shows whether the group is open." },
        { name: "group-title", text: "The group's title, with the search matches highlighted." },
        { name: "group-match", text: "A match of the search in the title.", when: "Only while searching." },
        { name: "group-start", text: "The box of MenuGroup.extend(\"start\"), before the title." },
        { name: "group-end", text: "The box of MenuGroup.extend(\"end\"), before the chevron." },
        { name: "group-children", text: "The items and groups in the group.", when: "Only while the group is open." }
    ]
});
