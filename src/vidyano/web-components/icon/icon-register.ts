import { html } from "@polymer/polymer"
import type { Icon } from "./icon"
import DOMPurify from "dompurify";

const icons: Record<string, Icon> = {};
const pendingFetches: Record<string, Promise<Icon>> = {};

export function load(name: string): Icon {
    return icons[name] || icons[Object.keys(icons).find(key => !!icons[key].aliases && icons[key].aliases.some(a => a === name))];
}

export function exists(name: string): boolean {
    return !!load(name) || name?.indexOf(":") >= 0; // Remote icons are considered to exist
}

export function fetchIcon(name: string): Promise<Icon> {
    // Check if we're already fetching this icon
    if (pendingFetches[name])
        return pendingFetches[name];

    // Check if we already have this icon loaded and populated
    const existing = load(name);
    if (existing?.children.length > 0)
        return Promise.resolve(existing);

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

            // Store the SVG as innerHTML so it can be safely cloned multiple times
            // We need to preserve the SVG for future cloning operations
            placeholder.innerHTML = svgEl.outerHTML;
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
        // Create a plain div to avoid vi-icon initialization issues
        const wrapper = document.createElement("div") as any;
        wrapper.name = arg;
        wrapper.innerHTML = DOMPurify.sanitize(maybeInnerHTML);
        icons[wrapper.name] = wrapper;
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
        arg = html(<TemplateStringsArray>arg);

    // For HTMLTemplateElement overload: extract all <vi-icon> elements
    Array.from((<HTMLTemplateElement>arg).content.querySelectorAll("vi-icon")).forEach((iconElement: Element) => {
        const name = iconElement.getAttribute("name");
        if (!name) return;

        // Create a plain div wrapper to store the icon content
        // Don't use the actual vi-icon element as it will initialize with shadow DOM
        const wrapper = document.createElement("div") as any;
        wrapper.name = name;

        // Copy the innerHTML from the template's vi-icon element
        wrapper.innerHTML = iconElement.innerHTML;

        icons[wrapper.name] = wrapper;
    });
}

export function all() {
    return Object.keys(icons);
}
