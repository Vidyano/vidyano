import { html, nothing, ReactiveController, ReactiveControllerHost, TemplateResult } from "lit";
import type * as Vidyano from "@vidyano/core";
import type { Menu } from "./menu";

/** The parts of vi-menu that Menu.extend adds content to. */
export type MenuRegion = "header" | "toggle" | "search" | "before-items" | "after-items" | "footer" | "user";

/** The parts of vi-menu with built-in content, which Menu.replace swaps for other content. */
export type MenuReplaceableRegion = "header" | "toggle" | "search" | "user";

/** The spots on a row of the menu tree that MenuProgramUnit, MenuGroup and MenuItem.extend add content to: before the row's icon and after its title. */
export type MenuNodeRegion = "start" | "end";

/** The kinds of rows in the menu tree, each extended through its own component. */
export type MenuNodeKind = "program-unit" | "group" | "item";

/** Renders an extension: a Lit template result, an element, a string, or nothing. */
export type MenuRender = (menu: Menu) => unknown;

/** Renders a replacement; original is what it replaces, the built-in content or the replacement before it, to wrap or leave out. */
export type MenuReplaceRender = (menu: Menu, original: unknown) => unknown;

/** Renders a row region extension for one row of the menu tree; the menu is null for a row outside a vi-menu. */
export type MenuNodeRender<TItem = Vidyano.ProgramUnitItem> = (menu: Menu, item: TItem) => unknown;

export interface MenuExtendOptions {
    /** Puts the content before the region's built-in content instead of after it. */
    before?: boolean;
}

const regions = ["header", "toggle", "search", "before-items", "after-items", "footer", "user"];
const nodeRegions = ["start", "end"];
const replaceableRegions = ["header", "toggle", "search", "user"];

type Extension = { render: Function; before: boolean };
type Replacement = { render: Function };

const extensions = new Map<string, Extension[]>();
const replacements = new Map<string, Replacement[]>();

/**
 * Tells the menus and their nodes to render again: "change" when an extension comes or goes,
 * "state" when a menu's state changes, which the item regions on its nodes may follow.
 */
export const menuExtensionEvents = new EventTarget();

function changed() {
    menuExtensionEvents.dispatchEvent(new Event("change"));
}

function remove<T>(list: T[], entry: T) {
    const index = list.indexOf(entry);
    if (index < 0)
        return;

    list.splice(index, 1);
    changed();
}

/**
 * Calls an extension's render function. One that throws is logged and renders nothing, since the registry is
 * shared: it would otherwise break every menu.
 */
function call(render: Function, ...args: unknown[]): unknown {
    try {
        return render(...args);
    }
    catch (e) {
        console.error("A vi-menu extension failed to render.", e);
        return nothing;
    }
}

export function extendMenu(region: string, render: Function, options?: MenuExtendOptions): () => void {
    if (!regions.includes(region))
        throw new Error(`vi-menu has no region "${region}"`);

    const entry: Extension = { render, before: !!options?.before };
    if (!extensions.has(region))
        extensions.set(region, []);

    extensions.get(region).push(entry);
    changed();

    return () => remove(extensions.get(region), entry);
}

export function extendMenuNode(kind: MenuNodeKind, region: string, render: Function): () => void {
    if (!nodeRegions.includes(region))
        throw new Error(`vi-menu-${kind} has no region "${region}"`);

    const key = `${kind}:${region}`;
    const entry: Extension = { render, before: false };
    if (!extensions.has(key))
        extensions.set(key, []);

    extensions.get(key).push(entry);
    changed();

    return () => remove(extensions.get(key), entry);
}

export function replaceMenu(region: string, render: Function): () => void {
    if (!replaceableRegions.includes(region))
        throw new Error(`vi-menu region "${region}" has no built-in content to replace`);

    // An entry of its own, so disposing removes this registration even when the same function was registered again
    const entry: Replacement = { render };
    if (!replacements.has(region))
        replacements.set(region, []);

    replacements.get(region).push(entry);
    changed();

    return () => remove(replacements.get(region), entry);
}

/**
 * Renders a region: its extensions around its content. The content is the built-in one, handed to each replacement
 * in the order they were registered as what it replaces, so the last one decides and may wrap the ones before.
 */
export function renderRegion(region: MenuRegion, menu: Menu, builtIn: () => unknown): TemplateResult {
    const entries = extensions.get(region) ?? [];
    const content = (replacements.get(region) ?? []).reduce((original, replacement) => call(replacement.render, menu, original), builtIn());

    return html`${entries.filter(e => e.before).map(e => call(e.render, menu))}${content}${entries.filter(e => !e.before).map(e => call(e.render, menu))}`;
}

/**
 * Renders a region of one row of the menu tree, with the extensions of that kind of row.
 */
export function renderNodeRegion(kind: MenuNodeKind, region: MenuNodeRegion, menu: Menu, item: Vidyano.ProgramUnitItem): TemplateResult | typeof nothing {
    const entries = extensions.get(`${kind}:${region}`);
    if (!entries?.length)
        return nothing;

    // One box per region, next to the row's link: what an extension puts there never follows the link. Its part is
    // item-start or item-end, as the menu passes the parts of every row up under one name
    return html`<div class=${`item-${region}`} part=${`item-${region}`}>${entries.map(e => call(e.render, menu, item))}</div>`;
}

/**
 * Whether anything extends a row region, so menu state changes need the tree's rows to render again.
 */
export function hasNodeExtensions(): boolean {
    return [...extensions].some(([key, entries]) => key.includes(":") && entries.length > 0);
}

/**
 * Renders the host again when an extension comes or goes, and on menu state changes when `followState` is set.
 */
export class MenuExtensionsController implements ReactiveController {
    #host: ReactiveControllerHost;
    #events: string[];
    #update = () => this.#host.requestUpdate();

    constructor(host: ReactiveControllerHost, followState = false) {
        this.#host = host;
        this.#events = followState ? ["change", "state"] : ["change"];
        host.addController(this);
    }

    hostConnected() {
        this.#events.forEach(name => menuExtensionEvents.addEventListener(name, this.#update));
    }

    hostDisconnected() {
        this.#events.forEach(name => menuExtensionEvents.removeEventListener(name, this.#update));
    }
}
