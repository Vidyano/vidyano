---
description: Migrate a PersistentObjectAttribute component from Polymer to Lit
args: <attribute-component-file.ts>
---

You are helping migrate a Vidyano PersistentObjectAttribute component from Polymer to Lit.

## Step 1: Read the General Lit Migration Command
First, read `.claude/commands/lit.md` and apply all patterns from that guide.

**Important:** Pay special attention to the "Handle layout classes" section - convert all `class="flex"`, `class="layout horizontal"`, etc. to proper CSS in the SCSS file.

## Step 2: Apply Attribute-Specific Patterns

These patterns OVERRIDE the general patterns for attribute components:

### Base Class
Extend `PersistentObjectAttribute`, not `WebComponent`:
```typescript
import { PersistentObjectAttribute } from "components/persistent-object-attribute/persistent-object-attribute";

export class PersistentObjectAttributeXxx extends PersistentObjectAttribute {
```

### Styles - Inherit Parent Styles
Always include parent styles:
```typescript
static styles = [super.styles, unsafeCSS(styles)];
```

### Rendering - Use renderDisplay() and renderEdit()
Do NOT use `render()`. Instead override these two methods and call `super` with the inner template:

```typescript
protected renderDisplay() {
    return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
}

protected renderEdit() {
    return super.renderEdit(html`
        <vi-sensitive ?disabled=${!this.sensitive}>
            <input
                .value=${this.value || ""}
                @input=${(e: InputEvent) => this.value = (e.target as HTMLInputElement).value}
                ?readonly=${this.readOnly}
                ?disabled=${this.frozen}>
        </vi-sensitive>
        ${!this.readOnly ? html`
            <button slot="right" @click=${this._someAction} tabindex="-1">
                <vi-icon source="SomeIcon"></vi-icon>
            </button>
        ` : nothing}
    `);
}
```

The base class automatically wraps:
- `renderDisplay()` content in `<vi-sensitive ?disabled=${!this.sensitive}>`
- `renderEdit()` content in `<vi-persistent-object-attribute-edit .attribute=${this.attribute}>`

**CRITICAL: Check Original Template for Wrappers**

Before blindly calling `super.renderDisplay()` or `super.renderEdit()`, check the original Polymer template to see if it actually used these wrappers:

1. **Check renderDisplay()**: Look at the `<dom-if if="[[!editing]]">` section
   - If it has `<vi-sensitive>` wrapper: use `super.renderDisplay(html`...`)`
   - If NO wrapper: return the template directly without calling super

2. **Check renderEdit()**: Look at the `<dom-if if="[[editing]]">` section
   - If it has `<vi-persistent-object-attribute-edit>` wrapper: use `super.renderEdit(html`...`)`
   - If NO wrapper: return the template directly without calling super
   - If editing mode shows display content when sensitive: `if (this.sensitive) return this.renderDisplay();`

**Example - Boolean attribute** (original template had NO vi-persistent-object-attribute-edit wrapper):
```typescript
protected renderDisplay() {
    // Original had vi-sensitive wrapper, so call super
    return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
}

protected renderEdit() {
    // When sensitive, show display mode (with vi-sensitive)
    if (this.sensitive)
        return this.renderDisplay();

    // Original had NO wrappers when not sensitive, so DON'T call super
    return this.isCheckbox ? html`
        <vi-checkbox .checked=${this.value} ...></vi-checkbox>
    ` : html`
        <vi-toggle .toggled=${this.value} ...></vi-toggle>
    `;
}
```

**Example - String attribute** (original template had both wrappers):
```typescript
protected renderDisplay() {
    return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
}

protected renderEdit() {
    return super.renderEdit(html`
        <vi-sensitive ?disabled=${!this.sensitive}>
            <input .value=${this.value} ...>
        </vi-sensitive>
    `);
}
```

### Registration
Register with BOTH customElements and PersistentObjectAttributeRegister:
```typescript
import * as PersistentObjectAttributeRegister from "components/persistent-object-attribute/persistent-object-attribute-register";

customElements.define("vi-persistent-object-attribute-xxx", PersistentObjectAttributeXxx);
PersistentObjectAttributeRegister.add("TypeName", PersistentObjectAttributeXxx);
```

### Handling Type Hints
Override `_attributeChanged()` to read type hints:
```typescript
protected _attributeChanged() {
    super._attributeChanged();

    if (this.attribute instanceof Vidyano.PersistentObjectAttribute)
        this.autocomplete = this.attribute.getTypeHint("Autocomplete");
}
```

### Inline Computed and Observer Functions
Always inline `@computed` and `@observer` functions directly in the decorator:

```typescript
// GOOD - inline the function
@property({ type: String })
@computed(function(this: MyComponent, options: string[]): string {
    return options && options.length > 0 ? options[0] || "\u2014" : "\u2014";
}, "attribute.options")
declare readonly friendlyName: string;

// BAD - separate method
@computed(MyComponent.prototype._computeFriendlyName, "attribute.options")
declare readonly friendlyName: string;

private _computeFriendlyName(options: string[]): string {
    return options && options.length > 0 ? options[0] || "\u2014" : "\u2014";
}
```

If a `_compute*` or `_*Changed` method only contains a single function call, and that called function is not used elsewhere, inline the entire logic.

### Available Base Properties
These are already available from `PersistentObjectAttribute`:
- `attribute`, `value`, `editing`, `readOnly`, `sensitive`, `frozen`, `placeholder`, `readOnlyTabIndex`

## Reference Examples
- `src/vidyano/web-components/persistent-object-attribute/attributes/persistent-object-attribute-user/persistent-object-attribute-user.ts`
- `src/vidyano/web-components/persistent-object-attribute/attributes/persistent-object-attribute-string/persistent-object-attribute-string.ts`

## Migration Checklist
Verify all items before considering migration complete:

### Structure
- [ ] Extends `PersistentObjectAttribute` (not `WebComponent` or `Polymer.PersistentObjectAttribute`)
- [ ] No `@WebComponent.register` or `@Polymer.WebComponent.register` decorator
- [ ] No `static get template()` method
- [ ] `.html` template file deleted

### Styles
- [ ] `static styles = [super.styles, unsafeCSS(styles)]` inherits parent styles
- [ ] All layout classes (`class="flex"`, `layout horizontal`, etc.) converted to SCSS
- [ ] CSS import uses correct path: `import styles from "./component-name.css"`

### Rendering
- [ ] Uses `renderDisplay()` and `renderEdit()` methods (not `render()`)
- [ ] Verified original template for wrappers - only calls super if original had wrappers
- [ ] `renderDisplay()` matches original `<dom-if if="[[!editing]]">` structure
- [ ] `renderEdit()` matches original `<dom-if if="[[editing]]">` structure
- [ ] No `<dom-if>` or `<template>` elements remain
- [ ] No `<dom-repeat>` elements (use `.map()` instead)

### Bindings
- [ ] All `[[property]]` converted to `${this.property}`
- [ ] All `{{property}}` two-way bindings converted to property + event listener
- [ ] All `on-tap`/`on-click` converted to `@click`
- [ ] All `on-input`/`on-blur`/`on-focus` converted to `@input`/`@blur`/`@focus`
- [ ] All `$=` attribute bindings converted (e.g., `disabled$=` → `?disabled=`)
- [ ] All boolean attributes use `?` prefix (`?disabled`, `?readonly`, `?hidden`)
- [ ] Property bindings use `.` prefix (`.value=`, `.attribute=`)

**Two-way binding conversion:**
Polymer's `property="{{value}}"` becomes property binding + event listener:
- `checked="{{value}}"` → `.checked=${this.value} @checked-changed=${(e: CustomEvent) => this.value = e.detail.value}`
- `toggled="{{value}}"` → `.toggled=${this.value} @toggled-changed=${(e: CustomEvent) => this.value = e.detail.value}`
- Pattern: `property="{{x}}"` → `.property=${this.x} @property-changed=${(e: CustomEvent) => this.x = e.detail.value}`

### Properties & Decorators
- [ ] Properties use `@property()` or `@state()` decorators
- [ ] Computed properties use `@computed()` decorator with `declare readonly`
- [ ] Observers use `@observer()` decorator
- [ ] No Polymer-style `properties` object
- [ ] All `@computed` functions inlined (no separate `_compute*` methods)
- [ ] All `@observer` functions inlined (no separate `_*Changed` methods unless complex)
- [ ] Single-statement wrapper functions fully inlined

### Registration
- [ ] `customElements.define("vi-component-name", ClassName)` at end of file
- [ ] `PersistentObjectAttributeRegister.add("TypeName", ClassName)` for attribute registration

### Type Hints & Lifecycle
- [ ] Type hints read in `_attributeChanged()` with `super._attributeChanged()` call
- [ ] `instanceof Vidyano.PersistentObjectAttribute` check before reading type hints
- [ ] `ready()` converted to `firstUpdated()` if present

### Imports
- [ ] No `import * as Polymer from "polymer"`
- [ ] Lit imports: `html`, `nothing` (if needed), `unsafeCSS`
- [ ] Decorators from `"lit/decorators.js"` or `"components/web-component/web-component"`

### Build
- **DO NOT run `npm run build`** - the development environment uses watchers that automatically rebuild on file changes