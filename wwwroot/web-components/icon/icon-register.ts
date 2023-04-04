import * as Polymer from "../../libs/polymer/polymer.js"
import type { Icon } from "./icon.js"

const icons: Record<string, Icon> = {};

export function load(name: string): Icon {
    return icons[name] || icons[Object.keys(icons).find(key => !!icons[key].aliases && icons[key].aliases.some(a => a === name))];
}

export function exists(name: string): boolean {
    return !!load(name);
}

export function add(icon: Element);
export function add(strings: TemplateStringsArray);
export function add(template: HTMLTemplateElement);
export function add(icon_or_string_or_template: Element | HTMLTemplateElement | TemplateStringsArray) {
    if (icon_or_string_or_template instanceof Element && icon_or_string_or_template.tagName === "VI-ICON") {
        const icon = icon_or_string_or_template as Icon;
        icons[icon.name] = icon;
        return;
    }

    if (Array.isArray(icon_or_string_or_template))
        icon_or_string_or_template = Polymer.html(<TemplateStringsArray>icon_or_string_or_template);

    Array.from((<HTMLTemplateElement>icon_or_string_or_template).content.querySelectorAll("vi-icon")).forEach((icon: Icon) => {
        document.body.appendChild(icon);
        icons[icon.name] = icon;
        document.body.removeChild(icon);
    });
}

export function all() {
    return Object.keys(icons);
}