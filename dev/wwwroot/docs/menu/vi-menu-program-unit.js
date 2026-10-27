import { MenuProgramUnit, html, nothing } from "../../index.js";

const { badge, compact, defineComponentPage } = await import(`./_stage.js${new URL(import.meta.url).search}`);

export const title = "vi-menu-program-unit";
export const tag = "docs-menu-program-unit";
export const order = 2;

export const { text, tabs } = defineComponentPage({
    tag,
    component: "vi-menu-program-unit",
    text: "A program unit: the top-level line with its icon, and below it the groups and items it holds. It opens for the active program unit.",
    behavior: {
        examples: [
            {
                id: "counts",
                title: "After the title",
                text: "How many items each program unit holds; collapsed, a dot on its icon.",
                apply: () => MenuProgramUnit.extend("end", (menu, unit) => {
                    if (!unit.items?.length)
                        return nothing;

                    if (compact(menu))
                        // On the icon's top right corner; the region lies over the whole line while the menu shows only icons
                        return html`<small style="position: absolute; top: 3px; right: 7px; width: 8px; height: 8px; border-radius: 50%; background: #F5A623; box-shadow: 0 0 0 2px var(--colors-blue-grey-900)"></small>`;

                    return html`<small style="${badge}">${unit.items.length}</small>`;
                })
            }
        ]
    },
    states: [
        { id: "open", label: "Open", open: true },
        { id: "closed", label: "Closed", open: false },
        { id: "collapsed", label: "Collapsed", collapsed: true, open: true },
        { id: "searching", label: "Searching", searching: true, open: true }
    ],
    regions: MenuProgramUnit,
    parts: [
        { name: "program-unit", text: "The program unit's line." },
        { name: "program-unit-icon", text: "The program unit's icon." },
        { name: "program-unit-title", text: "The program unit's title, with the search matches highlighted.", when: "Not while the menu shows only icons." },
        { name: "program-unit-match", text: "A match of the search in the title.", when: "Only while searching." },
        { name: "program-unit-start", text: "The box of MenuProgramUnit.extend(\"start\"), before the icon.", when: "Not while the menu shows only icons." },
        { name: "program-unit-end", text: "The box of MenuProgramUnit.extend(\"end\"), after the title.", when: "Not while the menu shows only icons." },
        { name: "program-unit-children", text: "The groups and items below the line.", when: "Only while the program unit is open." }
    ]
});
