export * from "@polymer/polymer"
export { DomBind } from "@polymer/polymer/lib/elements/dom-bind"
export { DomIf } from "@polymer/polymer/lib/elements/dom-if"
export { DomRepeat } from "@polymer/polymer/lib/elements/dom-repeat"
export * from "@polymer/polymer/lib/elements/dom-module"
export { mixinBehaviors } from "@polymer/polymer/lib/legacy/class"
export * as Settings from "@polymer/polymer/lib/utils/settings"
export * as Async from "@polymer/polymer/lib/utils/async"
export * as CaseMap from "@polymer/polymer/lib/utils/case-map"
export * as Debounce from "@polymer/polymer/lib/utils/debounce"
export * from "@polymer/polymer/lib/utils/flattened-nodes-observer"
export * from "@polymer/polymer/lib/utils/flush"
export * as Gestures from "@polymer/polymer/lib/utils/gestures"
export * as Render from "@polymer/polymer/lib/utils/render-status"
export * as Url from "@polymer/polymer/lib/utils/resolve-url"
export * as Templatize from "@polymer/polymer/lib/utils/templatize"
export * from "@polymer/polymer/lib/mixins/gesture-event-listeners"
export * from "@polymer/polymer/lib/utils/mixin"
export * from "@polymer/iron-overlay-behavior"
export * from "@polymer/iron-overlay-behavior/iron-focusables-helper"
export { IronListElement } from "@polymer/iron-list"
import "@polymer/iron-media-query"

export { WebComponent } from "components/web-component/polymer/web-component"

declare module "@polymer/polymer/lib/utils/gestures" {
    export interface GestureEvent extends Event {
        x: number;
        y: number;
        sourceEvent: Event;
    }
    
    export interface DownEvent extends GestureEvent {
    }
    
    export interface UpEvent extends GestureEvent {
    }
    
    export interface TapEvent extends GestureEvent {
        model: any;
        detail: {
            sourceEvent: Event;
            x: number;
            y: number;
        }
    }
    
    export interface TrackEvent extends GestureEvent {
        detail: TrackEventDetail;
    }
    
    export interface TrackEventDetail {
        /**
             * state - a string indicating the tracking state:
             * - start - fired when tracking is first detected (finger/button down and moved past a pre-set distance threshold)
             * - track - fired while tracking
         * - end - fired when tracking ends
        */
        state: "start" | "track" | "end";
        /** clientX coordinate for event */
        dx: number;
        /** change in pixels vertically since the first track event */
        dy: number;
        /** change in pixels horizontally since last track event */
        ddx: number;
        /** change in pixels vertically since last track event */
        ddy: number;
        /** a function that may be called to determine the element currently being hovered */
        hover(): Element;
    }
}

export declare module IronFocusablesHelper {
    /**
      * Returns a sorted array of tabbable nodes, including the root node.
      * It searches the tabbable nodes in the light and shadow dom of the chidren,
      * sorting the result by tabindex.
      * @param {!Node} node
      * @return {!Array<!HTMLElement>}
      */
    function getTabbableNodes(node: Node): HTMLElement[];

    /**
      * Returns if a element is focusable.
      * @param {!HTMLElement} element
      * @return {boolean}
      */
    function isFocusable(element: HTMLElement): boolean;

    /**
      * Returns if a element is tabbable. To be tabbable, a element must be
      * focusable, visible, and with a tabindex !== -1.
      * @param {!HTMLElement} element
      * @return {boolean}
      */
    function isTabbable(element: HTMLElement): boolean;
}

export interface FlattenedNodesObserverInfo {
    target: Element;
    addedNodes: Element[];
    removedNodes: Element[];
}