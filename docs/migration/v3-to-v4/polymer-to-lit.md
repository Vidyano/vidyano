# Vidyano Polymer to Lit Migration Guide

## Overview

Vidyano v4 introduces a new Lit-based `WebComponent` as the default, while keeping the Polymer equivalent available for compatibility. This guide covers the complete migration process from Polymer to Lit, including template conversion, property system changes, lifecycle method updates, and advanced patterns.

## Quick Reference

### Before (v3 - Polymer)
Classic Polymer component structure with template and metadata decorators:

```typescript
import { Polymer, WebComponent } from "@vidyano/vidyano";

@WebComponent.register({
    properties: {
        myProp: String,
        myNumber: {
            type: Number,
            value: 42
        }
    }
}, "vi-my-component")
export class MyComponent extends WebComponent {
    static get template() {
        return Polymer.html`<link rel="import" href="my-component.html">`;
    }
}
```

### After (v4 - Lit)
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

> Note: To make `import styles from "./my-component.css";` work with TypeScript, include a declaration file in your project (for example `global.d.ts`) that defines the `*.css` module shape, and ensure it is part of your compilation output:

```typescript
declare module '*.css' {
  const content: string;
  export default content;
}
```

## Lifecycle Methods

### Before (Polymer)
- `ready()` → runs once after the template is stamped.

### After (Lit)
- `firstUpdated(changedProperties)` → single-run hook after the first render; move `ready()` logic here.
- `updated(changedProperties)` → runs after every render; inspect `changedProperties` to react to specific updates.

## Migration Steps

### 1. Update Imports

**Add Lit imports:**

```typescript
import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent } from "@vidyano/vidyano";
```

### 2. Convert Properties

#### Simple Properties

Declare primitives with the `@property` decorator instead of Polymer's `properties` metadata.

**Before:**

```typescript
@WebComponent.register({
    properties: {
        name: String,
        count: Number,
        active: Boolean
    }
}, "vi-my-component")
export class MyComponent extends WebComponent { }
```

**After:**

```typescript
@property({ type: String })
name: string;

@property({ type: Number })
count: number;

@property({ type: Boolean })
active: boolean;
```

#### Properties with Options

Translate `reflectToAttribute`, custom observers, and similar settings into decorator options and helper decorators.

**Before:**

```typescript
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
```

**After - Option 1: Prototype method reference**

```typescript
import { observer } from "@vidyano/vidyano";

@property({ type: String, reflect: true })
@observer(MyComponent.prototype._userIdChanged)
userId: string;

private _userIdChanged(newValue: string, oldValue: string) {
    console.log("User ID changed", newValue);
}
```

**After - Option 2: Inline function**

```typescript
@property({ type: String, reflect: true })
@observer(function(this: MyComponent, newValue: string, oldValue: string) {
    console.log("User ID changed", newValue);
})
userId: string;
```

#### Read-Only Properties (Internal State)

Use Lit's `@state()` decorator for internal fields that should not reflect to attributes.

**Before:**

```typescript
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
```

**After:**

```typescript
import { state } from "lit/decorators.js";

@state()  // Internal state, not exposed as attribute
isLoading: boolean = false;

someMethod() {
    this.isLoading = true;  // Direct assignment
}
```

#### Two-Way Binding with `notify: true`

For two-way data binding, use the `@notify()` decorator:

**Before:**

```typescript
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
```

**After:**

```typescript
import { notify } from "@vidyano/vidyano";

@property({ type: Boolean, reflect: true })
@notify()  // Automatically dispatches "checked-changed" event
checked: boolean = false;

toggle() {
    this.checked = !this.checked;  // Event is automatically dispatched
}
```

**Note:** The `@notify()` decorator dispatches a `<propertyName>-changed` event after the property change has been processed (computed properties updated, observers executed) but before the component has re-rendered.

### 3. Convert Template

Polymer components use external HTML template files. Lit-based components define templates inline using the `render()` method with template literals.

**Before:**

```typescript
static get template() {
    return Polymer.html`<link rel="import" href="my-component.html">`;
}
```

**After:**

```typescript
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

#### Template Syntax Reference

Lit differentiates between attribute values, DOM properties, boolean attributes, and event listeners. Use the appropriate prefix so bindings behave as expected at runtime.

##### Property Binding

Use the `.` prefix to set DOM properties instead of string attributes.

**Before:**

```html
<div>[[propertyName]]</div>
<input value="{{propertyName}}">
```

**After:**

```html
<div>${this.propertyName}</div>
<input .value=${this.propertyName} @input=${this._handleInput}>
```

##### Attribute Binding

Use plain attributes when stringifying values is sufficient.

**Before:**

```html
<div class$="[[className]]" aria-label$="[[label]]">Content</div>
```

**After:**

```html
<div class=${this.className} aria-label=${this.label}>Content</div>
```

**Note:** The `hidden` attribute is no longer available. Use conditional rendering instead:

**Before:**

```html
<div hidden$="[[isHidden]]">Content</div>
```

**After:**

```html
${!this.isHidden ? html`<div>Content</div>` : nothing}
```

##### Boolean Attribute Binding

Use the `?` prefix for boolean attributes so Lit adds or removes the attribute instead of setting string values.

**Before:**

```html
<button disabled$="[[isDisabled]]">Save</button>
```

**After:**

```html
<button ?disabled=${this.isDisabled}>Save</button>
```

Boolean bindings omit the attribute entirely when the value is falsy.

##### Event Binding

Use the `@` prefix to attach event listeners, pairing it with `.property` bindings when you need access to element values.

**Before:**

```html
<button on-click="_handleClick">
```

**After:**

```html
<button @click=${this._handleClick}>
```

Use the `@` prefix to add event listeners. Combine `@event` with `.property` bindings as needed—for example, `@input=${this._handleInput}` alongside `.value=${this.value}`.

##### Conditional Rendering

Use ternary expressions or the `nothing` directive to control whether blocks render.

**Before:**

```html
<template is="dom-if" if="[[showContent]]">
    <div>Content</div>
</template>
```

**After:**

```html
${this.showContent ? html`
    <div>Content</div>
` : nothing}
```

##### Repeating Templates

Map over arrays (or use Lit directives like `repeat`) to render lists declaratively.

**Before:**

```html
<template is="dom-repeat" items="[[items]]">
    <div>[[item.name]]</div>
</template>
```

**After:**

```html
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

#### Handling Layout Utility Classes

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

### 4. Convert Styles

Move styles out of HTML imports and into module-backed stylesheets you can import from TypeScript.

**Before:**

```typescript
static get template() {
    return Polymer.html`<link rel="import" href="my-component.html">`;
}
```

**After:**

```typescript
import styles from "./my-component.css";

export class MyComponent extends WebComponent {
    static styles = unsafeCSS(styles);
}
```

### 5. Update Registration

Register Lit components with `customElements.define` instead of Polymer's decorator.

**Before:**

```typescript
@Polymer.WebComponent.register({
    properties: { /* ... */ }
}, "vi-my-component")
export class MyComponent extends Polymer.WebComponent { }
```

**After:**

```typescript
export class MyComponent extends WebComponent {
    // ... class definition
}

customElements.define("vi-my-component", MyComponent);
```

### 6. Convert Observers

#### Property Observers

The `@observer()` decorator replicates Polymer's property watchers and supports two usage patterns:

1. **Property observation** - Observes a single property by decorating the property itself
2. **Method observation** - Observes multiple properties by decorating a method

**Two syntax options for property observation:**
1. **Prototype method reference**: Reference a class method using `ClassName.prototype.methodName`
2. **Inline function**: Use an inline function with explicit `this` typing

**Before - single property observer:**

```typescript
@WebComponent.register({
    properties: {
        userId: {
            type: String,
            observer: "_userIdChanged"
        }
    }
}, "vi-my-component")
export class MyComponent extends WebComponent {
    private _userIdChanged(newValue: string, oldValue: string) {
        console.log("User ID changed", newValue);
    }
}
```

**After - Option 1: Prototype method reference**

```typescript
import { observer } from "@vidyano/vidyano";

@property({ type: String })
@observer(MyComponent.prototype._userIdChanged)
userId: string;

private _userIdChanged(newValue: string, oldValue: string) {
    console.log("User ID changed", newValue);
}
```

**After - Option 2: Inline function**

```typescript
@property({ type: String })
@observer(function(this: MyComponent, newValue: string, oldValue: string) {
    console.log("User ID changed", newValue);
})
userId: string;
```

**Before - multi-property observer:**

```typescript
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
```

**After:**

```typescript
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

#### Deep Property Path Observer

Observe nested paths directly—no `forwardObservers` list required.

**Before:**

```typescript
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
```

**After:**

```typescript
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

#### Observers vs. `updated()` - Avoiding Infinite Loops

Keep business logic in observers and move DOM-oriented side effects into Lit's lifecycle hooks.

**Avoid using observers for DOM manipulation** - this can cause infinite update loops. Instead, use the `updated()` lifecycle method for DOM side effects.

**Wrong - causes infinite update loop:**

```typescript
@property({ type: String, reflect: true })
@observer(MyComponent.prototype._updateColor)
color: string;

private _updateColor(color: string) {
    this.style.setProperty("--my-color", color);  // Triggers re-render!
}
```

**Correct - use updated() for DOM side effects:**

```typescript
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

### 7. Convert Computed Properties

#### Using `@computed` decorator (for properties that need reflection or external access)

When the computed value must stay reactive (or reflect to attributes), use the `@computed()` decorator to describe its dependencies.

**Two syntax options for `@computed()`:**
1. **Inline function**: Use an inline function with explicit `this` typing (recommended for simple computations)
2. **Prototype method reference**: Reference a class method using `ClassName.prototype.methodName` (recommended for complex computations)

**Before:**

```typescript
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
```

**After - Option 1: Inline function (recommended for simple computations)**

```typescript
import { computed } from "@vidyano/vidyano";

@property({ type: String })
firstName: string;

@property({ type: String })
lastName: string;

@property({ type: String })
@computed(function(this: MyComponent, firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`;
}, "firstName", "lastName")
declare readonly fullName: string;
```

**After - Option 2: Prototype method reference (recommended for complex computations)**

```typescript
@property({ type: String })
@computed(MyComponent.prototype._computeFullName, "firstName", "lastName")
declare readonly fullName: string;

private _computeFullName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`;
}
```

**Note:** The `@computed` decorator will NOT calculate the computed property when any dependency is `undefined`. `null` values are allowed. To allow `undefined` values, use `{ allowUndefined: true }` as the last parameter:

```typescript
@property({ type: String })
@computed(function(this: MyComponent, firstName: string | undefined, lastName: string | undefined): string {
    return `${firstName ?? ''} ${lastName ?? ''}`.trim();
}, "firstName", "lastName", { allowUndefined: true })
declare readonly fullName: string;
```

**Best Practices:**
- Always declare computed properties as `declare readonly` to make their immutable nature clear
- Use inline functions for simple computations to keep logic colocated with the property
- Use prototype method references for complex computations with multiple lines of logic
- Always include explicit `this` typing for better IDE support and type checking

#### Using getters (for reactive component properties only)

For simple computations based on component properties, you can use getters.

**Important:** Only use getters when all dependencies are reactive component properties (decorated with `@property` or `@state`). Use `@computed` when:
- Dependencies are observable Vidyano objects (PersistentObject, Query, etc.)
- Dependencies include deep property paths (e.g., `query.totalItems`)
- The computed value needs to be reflected to an attribute

This is because changes to Vidyano objects won't automatically trigger Lit's update cycle, but the `@computed` decorator watches those objects for changes.

**Before:**

```typescript
@WebComponent.register({
    properties: {
        error: String,
        hasError: {
            type: Boolean,
            computed: "_computeHasError(error)"
        }
    }
}, "vi-my-component")
export class MyComponent extends WebComponent {

private _computeHasError(error: string): boolean {
    return !String.isNullOrEmpty(error);
}
```

**After - use a getter:**

```typescript
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

## Advanced Patterns

### Accessing Shadow DOM Elements

```typescript
// Both versions support the $ property
const element = this.$.myElement;

// Equivalent to
const element = this.shadowRoot.getElementById('myElement');
```

### Dispatching Custom Events

**Before:**

```typescript
this.fire('my-event', { detail: data });
```

**After:**

```typescript
this.dispatchEvent(new CustomEvent('my-event', {
    detail: data,
    bubbles: true,
    composed: true
}));
```

### Event Listeners

For listening to events on the component itself or its children:

**Before:**

```typescript
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
```

**After - use @listener() decorator:**

```typescript
import { listener } from "@vidyano/vidyano";

export class MyComponent extends WebComponent {
    @listener("app-route-activate")
    private _activate(e: CustomEvent) { ... }

    @listener("app-route-deactivate")
    private _deactivate(e: CustomEvent) { ... }
}
```

### Keyboard Shortcuts

For binding keyboard shortcuts to component methods, use the `@keybinding()` decorator:

```typescript
import { keybinding } from "@vidyano/vidyano";

export class MyComponent extends WebComponent {
    @keybinding("escape")
    private _handleEscape(e: KeyboardEvent) {
        // Handle Escape key
        this.close();
    }

    @keybinding("ctrl+s")
    private _handleSave(e: KeyboardEvent) {
        e.preventDefault();  // Prevent browser's default save
        this.save();
    }

    @keybinding("alt+shift+k")
    private _handleComplexShortcut(e: KeyboardEvent) {
        // Handle Alt+Shift+K combination
    }
}
```

**Keybinding format:**
- Single keys: `"escape"`, `"enter"`, `"delete"`, `"f1"`, etc.
- With modifiers: `"ctrl+s"`, `"alt+k"`, `"shift+enter"`
- Multiple modifiers: `"ctrl+alt+shift+s"`
- Case insensitive: `"Ctrl+S"` is the same as `"ctrl+s"`

**Important notes:**
- Keybindings listen for `keydown` events on the component element
- The keyboard event is passed to your handler method
- Use `e.preventDefault()` to prevent default browser behavior
- Modifier order in the binding string doesn't matter (normalized internally)

### Waiting for Rendering

**Before:**

```typescript
Polymer.flush();  // Force synchronous render
```

**After:**

```typescript
await this.updateComplete;  // Wait for async render to complete
```

### Clearing Child Elements (Light DOM)

**Before:**

```typescript
this.empty();  // Clears all light DOM child elements
```

**After:**

```typescript
this.innerHTML = "";  // Clears all light DOM child elements
```

## Troubleshooting

### Common Issues

**Template not rendering:**
- Ensure you have a `render()` method that returns `html` template
- Check that all template expressions use `${this.property}` syntax
- Verify imports include `html` from `lit`

**Properties not updating:**
- Confirm properties are decorated with `@property()` or `@state()`
- Check that property types match the decorator configuration
- Ensure observers are using correct decorator syntax

**Styles not applying:**
- Verify CSS is imported and assigned to `static styles`
- Check that `unsafeCSS()` is used for CSS imports
- Ensure CSS selectors target the correct elements

**Events not firing:**
- Confirm event bindings use `@event` syntax
- Check that event handlers are properly bound methods
- Verify custom events use correct `CustomEvent` constructor

**Layout broken:**
- Look for missing layout utility classes in template
- Add equivalent flexbox styles to component CSS
- Use semantic class names instead of utility classes

### Performance Considerations

- Use `@state()` for internal properties that don't need attribute reflection
- Consider using `repeat()` directive for large lists
- Avoid complex computations in `render()` method
- Use `updated()` lifecycle method sparingly to avoid performance issues
