import * as Polymer from "polymer"
import type { Icon } from "./icon"
import DOMPurify from "dompurify";

const icons: Record<string, Icon> = {};
const pendingFetches: Record<string, Promise<Icon>> = {};

export function load(name: string): Icon {
    return icons[name] || icons[Object.keys(icons).find(key => !!icons[key].aliases && icons[key].aliases.some(a => a === name))];
}

export function exists(name: string): boolean {
    return !!load(name);
}

export function fetchIcon(name: string): Promise<Icon> {
    const existing = load(name);
    if (existing)
        return Promise.resolve(existing);

    if (pendingFetches[name])
        return pendingFetches[name];

    // Create a placeholder and register it immediately.
    // This makes `exists(name)` return true right away.
    const placeholder = document.createElement("vi-icon") as Icon;
    placeholder.name = name;
    add(placeholder);

    const promise = (async (): Promise<Icon> => {
        try {
            const response = await fetch(`https://icons.vidyano.com/${name.replace(":", "/")}.svg`);
            if (!response.ok) {
                throw new Error(`Failed to fetch icon '${name}': ${response.statusText}`);
            }

            const svgText = await response.text();
            const sanitizedSvg = DOMPurify.sanitize(svgText);
            const parser = new DOMParser();
            const doc = parser.parseFromString(sanitizedSvg, "image/svg+xml");
            let svgEl: Element = doc.documentElement;

            if (svgEl.nodeName.toLowerCase() !== "svg") {
                const container = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                container.appendChild(svgEl.cloneNode(true));
                svgEl = container;
            }

            // Populate the placeholder that's already in the registry.
            placeholder.appendChild(svgEl);
            return placeholder;
        } catch (err) {
            console.error(err);
            // If fetching fails, un-register the placeholder.
            delete icons[name];
            return null;
        } finally {
            delete pendingFetches[name];
        }
    })();

    return pendingFetches[name] = promise;
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