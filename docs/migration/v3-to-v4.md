# Migrating from Vidyano v3 to v4

This guide helps you migrate your custom Vidyano web components from v3 to v4.

## Overview

Vidyano v4 ships a new Lit-based `WebComponent` while keeping the Polymer equivalent available. The default `WebComponent` export now points to the Lit implementation, and the previous Polymer version lives under `Polymer.WebComponent`. You can keep your Polymer components running with a small import change, or adopt Lit to take advantage of the new features.

```typescript
// v3 (Polymer-based WebComponent)
import { WebComponent } from "@vidyano/vidyano";  // Was Polymer-based

export class MyComponent extends WebComponent { }

// v4 (Lit-based WebComponent)
import { WebComponent } from "@vidyano/vidyano";  // Now Lit-based!

export class MyComponent extends WebComponent { }

// v4 (Polymer compatibility)
import { Polymer } from "@vidyano/vidyano";

export class MyComponent extends Polymer.WebComponent { }  // Polymer-based
```

The Lit-based default brings:

- **Modern standards**: Lit follows current Web Component best practices
- **Better performance**: Smaller bundle sizes and faster rendering
- **Active development**: Lit is actively maintained by Google
- **Improved DX**: Better TypeScript support and debugging experience

## Choose Your Path

- **Path 1 – Keep using Polymer (Compatibility Mode):** Update your imports to `Polymer.WebComponent` and continue working exactly as before. You can ignore the Lit-specific guidance until you're ready to migrate.
- **Path 2 – Adopt Lit-based Web Components:** Switch to the Lit `WebComponent` for better performance and tooling. The remainder of this document walks through the full migration.

## Path 1: Continue with Polymer (Compatibility Mode)

If you aren't ready to migrate from Polymer to Lit yet, follow these steps:

1. Import `Polymer` from `@vidyano/vidyano`.
2. Extend `Polymer.WebComponent` instead of `WebComponent`.
3. Use the `@Polymer.WebComponent.register()` decorator when registering the element.

That's all—your existing Polymer code, templates, and behaviours continue to work for now. You can revisit Path 2 whenever you decide to move to Lit.

```typescript
// Before (v3)
import { WebComponent } from "@vidyano/vidyano";

@WebComponent.register({
    properties: { /* ... */ }
}, "vi-my-component")
export class MyComponent extends WebComponent {
    // Your existing Polymer code
}

// After (v4)
import { Polymer } from "@vidyano/vidyano";

@Polymer.WebComponent.register({
    properties: { /* ... */ }
}, "vi-my-component")
export class MyComponent extends Polymer.WebComponent {
    // Your existing Polymer code - no other changes needed
}
```

> Note: The compatibility API is a short-term bridge. Future major versions will eventually remove Polymer support.

## Path 2: Adopt Lit-based Web Components

The following sections cover the full Lit migration flow.

### Quick Reference

#### Before (v3 - Polymer)
Classic Polymer component structure with template and metadata decorators:

```typescript
import { Polymer, WebComponent } from "@vidyano/vidyano"; 

@WebComponent.register()
export class MyComponent extends WebComponent {
    static get template() {
        return Polymer.html`<link rel="import" href="my-component.html">`;
    }

    static get properties() {
        return {
            myProp: String,
            myNumber: {
                type: Number,
                value: 42
            }
        };
    }
}
```

#### After (v4 - Lit)
Lit-based equivalent that inlines the template and styles inside the component:

```typescript
import { html, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent } from "@vidyano/vidyano";
import styles from "./my-component.css";

export class MyComponent extends WebComponent {
    static styles = unsafeCSS(styles);

    @property({ type: String })
    myProp: string;

    @property({ type: Number })
    myNumber: number = 42;

    render() {
        return html`
            <!-- Your template here -->
        `;
    }
}

customElements.define("vi-my-component", MyComponent);
```

> Note: To make `import styles from "./my-component.css";` work with TypeScript, include a declaration file in your project (for example `global.d.ts`) that defines the `*.css` module shape, and ensure it is part of your compilation output.

### Lifecycle Methods

#### Before (Polymer)
- `ready()` → runs once after the template is stamped.

#### After (Lit)
- `firstUpdated(changedProperties)` → single-run hook after the first render; move `ready()` logic here.
- `updated(changedProperties)` → runs after every render; inspect `changedProperties` to react to specific updates.

### Migration Steps to Lit

#### 1. Update Imports

**Add Lit imports:**

```typescript
import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent } from "@vidyano/vidyano";
```

#### 2. Change Base Class

Switch every component to extend the new Lit-based `WebComponent`.

```typescript
// Before
export class MyComponent extends Polymer.WebComponent {

// After
export class MyComponent extends WebComponent {
```

#### 3. Convert Properties

##### Simple Properties

Declare primitives with the `@property` decorator instead of Polymer's `properties` metadata.

```typescript
// Before
@WebComponent.register({
    properties: {
        name: String,
        count: Number,
        active: Boolean
    }
}, "vi-my-component")
export class MyComponent extends WebComponent { }

// After
@property({ type: String })
name: string;

@property({ type: Number })
count: number;

@property({ type: Boolean })
active: boolean;
```

##### Properties with Options

Translate `reflectToAttribute`, custom observers, and similar settings into decorator options and helper decorators.

```typescript
// Before
@WebComponent.register({
    properties: {
        userId: {
            type: String,
            reflectToAttribute: true,
            observer: "_userIdChanged"
        }
    }
}, "vi-my-component")
export class MyComponent extends WebComponent { }

// After
import { observe } from "@vidyano/vidyano";

@property({ type: String, reflect: true })
@observe("_userIdChanged")
userId: string;

private _userIdChanged(newValue: string, oldValue: string) {
    console.log("User ID changed", newValue);
}
```

##### Read-Only Properties (Internal State)

Use Lit's `@state()` decorator for internal fields that should not reflect to attributes.

```typescript
// Before
@WebComponent.register({
    properties: {
        isLoading: {
            type: Boolean,
            readOnly: true  // Creates _setIsLoading() setter
        }
    }
}, "vi-my-component")
export class MyComponent extends WebComponent {
    readonly isLoading: boolean; private _setIsLoading: (val: boolean) => void;

    someMethod() {
        this._setIsLoading(true);
    }
}

// After - use @state() for internal-only properties
import { state } from "lit/decorators.js";

@state()  // Internal state, not exposed as attribute
isLoading: boolean = false;

someMethod() {
    this.isLoading = true;  // Direct assignment
}
```

##### Two-Way Binding with `notify: true`

For two-way data binding, use the `@notify()` decorator:

```typescript
// Before
@WebComponent.register({
    properties: {
        checked: {
            type: Boolean,
            reflectToAttribute: true,
            notify: true  // Automatically fires "checked-changed" event
        }
    }
}, "vi-my-component")
export class MyComponent extends WebComponent {
    checked: boolean;

    toggle() {
        this.checked = !this.checked;  // Auto-fires event
    }
}

// After - use @notify() decorator
import { notify } from "@vidyano/vidyano";

@property({ type: Boolean, reflect: true })
@notify()  // Automatically dispatches "checked-changed" event
checked: boolean = false;

toggle() {
    this.checked = !this.checked;  // Event is automatically dispatched
}
```

**Note:** The `@notify()` decorator dispatches a `<propertyName>-changed` event after the property change has been processed and the component has re-rendered.

#### 4. Convert Template

Polymer components use external HTML template files. Lit-based components define templates inline using the `render()` method with template literals.

```typescript
// Before
static get template() {
    return Polymer.html`<link rel="import" href="my-component.html">`;
}

// After
render() {
    return html`
        <!-- Convert your HTML template here -->
        <!-- Replace [[property]] with ${this.property} -->
        <!-- Replace on-event with @event -->
        <!-- etc. -->
    `;
}
```

**Important:** You cannot directly import and use the old Polymer HTML template. You must manually convert it to Lit's template syntax.

##### Template Syntax Reference

Lit differentiates between attribute values, DOM properties, boolean attributes, and event listeners. Use the appropriate prefix so bindings behave as expected at runtime.

###### Property Binding

Use the `.` prefix to set DOM properties instead of string attributes.
```html
<!-- Before -->
<div>[[propertyName]]</div>
<input value="{{propertyName}}">

<!-- After -->
<div>${this.propertyName}</div>
<input .value=${this.propertyName} @input=${this._handleInput}>
```

###### Attribute Binding

Use plain attributes when stringifying values is sufficient.
```html
<!-- Before -->
<div class$="[[className]]" aria-label$="[[label]]">Content</div>

<!-- After -->
<div class=${this.className} aria-label=${this.label}>Content</div>
```

**Note:** The `hidden` attribute is no longer available. Use conditional rendering instead:
```html
<!-- Before -->
<div hidden$="[[isHidden]]">Content</div>

<!-- After - use conditional rendering -->
${!this.isHidden ? html`<div>Content</div>` : nothing}
```

###### Boolean Attribute Binding

Use the `?` prefix for boolean attributes so Lit adds or removes the attribute instead of setting string values.
```html
<!-- Before -->
<button disabled$="[[isDisabled]]">Save</button>

<!-- After -->
<button ?disabled=${this.isDisabled}>Save</button>
```

Boolean bindings omit the attribute entirely when the value is falsy.

###### Event Binding

Use the `@` prefix to attach event listeners, pairing it with `.property` bindings when you need access to element values.
```html
<!-- Before -->
<button on-click="_handleClick">

<!-- After -->
<button @click=${this._handleClick}>
```

Use the `@` prefix to add event listeners. Combine `@event` with `.property` bindings as needed—for example, `@input=${this._handleInput}` alongside `.value=${this.value}`.

###### Conditional Rendering

Use ternary expressions or the `nothing` directive to control whether blocks render.
```html
<!-- Before -->
<template is="dom-if" if="[[showContent]]">
    <div>Content</div>
</template>

<!-- After -->
${this.showContent ? html`
    <div>Content</div>
` : nothing}
```

###### Repeating Templates

Map over arrays (or use Lit directives like `repeat`) to render lists declaratively.
```html
<!-- Before -->
<template is="dom-repeat" items="[[items]]">
    <div>[[item.name]]</div>
</template>

<!-- After -->
${this.items?.map(item => html`
    <div>${item.name}</div>
`)}
```

Or with the `repeat` directive for better performance:

```typescript
import { repeat } from "lit/directives/repeat.js";

${repeat(this.items, (item) => item.id, (item) => html`
    <div>${item.name}</div>
`)}
```

##### Handling Layout Utility Classes

⚠️ **IMPORTANT:** Layout utility classes like `layout horizontal`, `layout vertical`, and `flex` are not available in Lit-based components. You must manually add these styles to your component's SCSS file.

**Check your HTML template for these layout classes:**
- `class="layout horizontal"` or `class="layout vertical"`
- `class="flex"`
- `class="layout center"`, `class="layout center-center"`
- `class="layout wrap"`
- Any other `layout` or flexbox utility classes

**If found, follow these steps:**

1. Identify which layout classes are used in your HTML template
2. **Replace with semantic class names** - We recommend using meaningful names like `.container`, `.content`, `.header` instead of keeping utility class names like `.layout.horizontal` or `.flex`. This makes your code more maintainable and easier to understand.
3. Add the flexbox styles to your component's SCSS file using your chosen semantic names
4. Update the HTML template to use the new semantic class names

**Example - Before:**
```html
<div class="layout horizontal center">
    <div class="flex">Content</div>
    <button>Action</button>
</div>
```

**Example - After:**

In `component.scss` (create semantic class names):
```scss
.container {
    display: flex;
    flex-direction: row;
    align-items: center;

    > .content {
        flex: 1;
        min-height: 0;
        min-width: 0;
    }
}
```

In TypeScript `render()` (use semantic names):

```typescript
render() {
    return html`
        <div class="container">
            <div class="content">Content</div>
            <button>Action</button>
        </div>
    `;
}
```

#### 5. Convert Styles

Move styles out of HTML imports and into module-backed stylesheets you can import from TypeScript.

```typescript
// Before - styles embedded in HTML file
static get template() {
    return Polymer.html`<link rel="import" href="my-component.html">`;
}

// After - styles in separate CSS file
import styles from "./my-component.css";

export class MyComponent extends WebComponent {
    static styles = unsafeCSS(styles);
}
```

#### 6. Update Registration

Register Lit components with `customElements.define` instead of Polymer's decorator.

```typescript
// Before
@Polymer.WebComponent.register({
    properties: { /* ... */ }
}, "vi-my-component")
export class MyComponent extends Polymer.WebComponent { }

// After
export class MyComponent extends WebComponent {
    // ... class definition
}

customElements.define("vi-my-component", MyComponent);
```

#### 7. Convert Observers

##### Property Observers

Apply the `@observe()` and `@observer()` decorators to replicate Polymer's property watchers.

```typescript
// Before - single property observer
static get properties() {
    return {
        userId: {
            type: String,
            observer: "_userIdChanged"
        }
    };
}

private _userIdChanged(newValue: string, oldValue: string) {
    console.log("User ID changed", newValue);
}

// After
import { observe } from "@vidyano/vidyano";

@property({ type: String })
@observe("_userIdChanged")
userId: string;

private _userIdChanged(newValue: string, oldValue: string) {
    console.log("User ID changed", newValue);
}
```

```typescript
// Before - multi-property observer
@WebComponent.register({
    properties: {
        open: Boolean,
        disabled: Boolean
    },
    observers: [
        "_onStateChanged(open, disabled)"
    ]
})

private _onStateChanged(open: boolean, disabled: boolean) {
    // Handle state change
}

// After
import { observer } from "@vidyano/vidyano";

@property({ type: Boolean })
open: boolean = false;

@property({ type: Boolean })
disabled: boolean = false;

@observer("open", "disabled")
private _onStateChanged(open: boolean, disabled: boolean) {
    // Handle state change
}
```

**Note:** The `@observer` decorator will NOT call the observer method when any dependency is `undefined`. `null` values are allowed. To allow `undefined` values, use `{ allowUndefined: true }`:

```typescript
@observer("firstName", "lastName", { allowUndefined: true })
private _handleNameChange(firstName: string | undefined, lastName: string | undefined) {
    if (firstName === undefined || lastName === undefined) return;
    const fullName = `${firstName} ${lastName}`;
}
```

##### Deep Property Path Observer

Observe nested paths directly—no `forwardObservers` list required.

```typescript
// Before
@WebComponent.register({
    properties: {
        query: Object
    },
    observers: [
        "_updateTitle(query.labelWithTotalItems)"
    ],
    forwardObservers: [
        "query.labelWithTotalItems"
    ]
})

// After - no separate forwardObservers needed
import { observer } from "@vidyano/vidyano";

@property({ type: Object })
query: Query;

@observer("query.labelWithTotalItems")
private _updateTitle(title: string) {
    if (this.query && title !== undefined) {
        // Update title
    }
}
```

##### Observers vs. `updated()` - Avoiding Infinite Loops

Keep business logic in observers and move DOM-oriented side effects into Lit's lifecycle hooks.

**Avoid using observers for DOM manipulation** - this can cause infinite update loops. Instead, use the `updated()` lifecycle method for DOM side effects.

```typescript
// Wrong - causes infinite update loop
@property({ type: String, reflect: true })
@observe("_updateColor")
color: string;

private _updateColor(color: string) {
    this.style.setProperty("--my-color", color);  // Triggers re-render!
}

// Correct - use updated() for DOM side effects
@property({ type: String, reflect: true })
color: string;

updated(changedProperties: Map<PropertyKey, unknown>) {
    super.updated(changedProperties);

    if (changedProperties.has("color") && this.color) {
        this.style.setProperty("--my-color", this.color);
    }
}
```

**When to use each:**
- **Use `@observer()` decorator for:** Business logic, updating other properties, dispatching events, API calls
- **Use `updated()` lifecycle method for:** DOM manipulation, measuring elements, focus management, any side effects that might trigger re-renders

#### 8. Convert Computed Properties

##### Using `@computed` decorator (for properties that need reflection or external access)

When the computed value must stay reactive (or reflect to attributes), use the `@computed()` decorator to describe its dependencies.

```typescript
// Before
@WebComponent.register({
    properties: {
        firstName: String,
        lastName: String,
        fullName: {
            type: String,
            computed: "_computeFullName(firstName, lastName)"
        }
    }
}, "vi-my-component")
export class MyComponent extends WebComponent {
    private _computeFullName(firstName: string, lastName: string): string {
        return `${firstName} ${lastName}`;
    }
}

// After - use @computed decorator
import { computed } from "@vidyano/vidyano";

@property({ type: String })
firstName: string;

@property({ type: String })
lastName: string;

@property({ type: String })
@computed("_computeFullName(firstName, lastName)")
fullName: string;

private _computeFullName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`;
}
```

**Note:** The `@computed` decorator will NOT calculate the computed property when any dependency is `undefined`. `null` values are allowed. To allow `undefined` values, use `{ allowUndefined: true }` as the second parameter:

```typescript
@property({ type: String })
@computed("_computeFullName(firstName, lastName)", { allowUndefined: true })
fullName: string;

private _computeFullName(firstName: string | undefined, lastName: string | undefined): string {
    return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}
```

##### Using getters (for reactive component properties only)

For simple computations based on component properties, you can use getters.

**Important:** Only use getters when all dependencies are reactive component properties (decorated with `@property` or `@state`). Use `@computed` when:
- Dependencies are observable Vidyano objects (PersistentObject, Query, etc.)
- Dependencies include deep property paths (e.g., `query.totalItems`)
- The computed value needs to be reflected to an attribute

This is because changes to Vidyano objects won't automatically trigger Lit's update cycle, but the `@computed` decorator watches those objects for changes.

```typescript
// Before
@WebComponent.register({
    properties: {
        error: String,
        hasError: {
            type: Boolean,
            computed: "_computeHasError(error)"
        }
    }
})

private _computeHasError(error: string): boolean {
    return !String.isNullOrEmpty(error);
}

// After - use a getter
@property({ type: String })
error: string;

get hasError(): boolean {
    return !String.isNullOrEmpty(this.error);
}

render() {
    return html`
        ${this.hasError ? html`<div>Error: ${this.error}</div>` : nothing}
    `;
}
```

## Common Patterns

### Accessing Shadow DOM Elements

```typescript
// Both versions support the $ property
const element = this.$.myElement;

// Equivalent to
const element = this.shadowRoot.getElementById('myElement');
```

### Dispatching Custom Events

```typescript
// Before
this.fire('my-event', { detail: data });

// After
this.dispatchEvent(new CustomEvent('my-event', {
    detail: data,
    bubbles: true,
    composed: true
}));
```

### Event Listeners

For listening to events on the component itself or its children:

```typescript
// Before
@WebComponent.register({
    listeners: {
        "app-route-activate": "_activate",
        "app-route-deactivate": "_deactivate"
    }
})
export class MyComponent extends Polymer.WebComponent {
    private _activate(e: CustomEvent) { ... }
    private _deactivate(e: CustomEvent) { ... }
}

// After - use @listener() decorator
import { listener } from "@vidyano/vidyano";

export class MyComponent extends WebComponent {
    @listener("app-route-activate")
    private _activate(e: CustomEvent) { ... }

    @listener("app-route-deactivate")
    private _deactivate(e: CustomEvent) { ... }
}
```

### Waiting for Rendering

```typescript
// Before
Polymer.flush();  // Force synchronous render

// After
await this.updateComplete;  // Wait for async render to complete
```

### Clearing Child Elements (Light DOM)

```typescript
// Before
this.empty();  // Clears all light DOM child elements

// After
this.innerHTML = "";  // Clears all light DOM child elements
```
