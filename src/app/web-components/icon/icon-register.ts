import * as Polymer from "polymer"
import type { Icon } from "./icon"
import DOMPurify from "dompurify";

const icons: Record<string, Icon> = {};

export function load(name: string): Icon {
    return icons[name] || icons[Object.keys(icons).find(key => !!icons[key].aliases && icons[key].aliases.some(a => a === name))];
}

export function exists(name: string): boolean {
    return !!load(name);
}
export function add(icon: Element): void;
export function add(strings: TemplateStringsArray): void;
export function add(template: HTMLTemplateElement): void;
export function add(name: string, innerHTML: string): void;

export function add(arg: Element | HTMLTemplateElement | TemplateStringsArray | string, maybeInnerHTML?: string) {
    // add(name, innerHTML)
    if (typeof arg === "string" && typeof maybeInnerHTML === "string") {
        const icon = document.createElement("vi-icon") as Icon;
        icon.name = arg;
        icon.innerHTML = DOMPurify.sanitize(maybeInnerHTML);
        icons[icon.name] = icon;
        return;
    }
    
    // add(Element) for where the element is a <vi-icon>
    if (arg instanceof Element && arg.tagName === "VI-ICON") {
        const icon = arg as Icon;
        icons[icon.name] = icon;
        return;
    }
    
    // For TemplateStringsArray overload
    if (Array.isArray(arg))
        arg = Polymer.html(<TemplateStringsArray>arg);

    // For HTMLTemplateElement overload: extract all <vi-icon> elements
    Array.from((<HTMLTemplateElement>arg).content.querySelectorAll("vi-icon")).forEach((icon: Icon) => {
        document.body.appendChild(icon);
        icons[icon.name] = icon;
        document.body.removeChild(icon);
    });
}

export function all() {
    return Object.keys(icons);
}