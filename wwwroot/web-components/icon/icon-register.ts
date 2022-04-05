import * as Polymer from "../../libs/polymer/polymer.js"
import type { Icon } from "./icon.js"

const icons: { [key: string]: Icon } = {};

export function load(name: string): Icon {
    return icons[name] || icons[Object.keys(icons).find(key => !!icons[key].aliases && icons[key].aliases.some(a => a === name))];
}

export function exists(name: string): boolean {
    return !!load(name);
}

export function add(strings: TemplateStringsArray);
export function add(template: HTMLTemplateElement);
export function add(stringOrTemplate: HTMLTemplateElement | TemplateStringsArray) {
    if (Array.isArray(stringOrTemplate))
        stringOrTemplate = Polymer.html(<TemplateStringsArray>stringOrTemplate);

    Array.from((<HTMLTemplateElement>stringOrTemplate).content.querySelectorAll("vi-icon")).forEach((icon: Icon) => {
        document.body.appendChild(icon);
        icons[icon.name] = icon;
        document.body.removeChild(icon);
    });
}