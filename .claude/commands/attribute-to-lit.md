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
protected override _attributeChanged() {
    super._attributeChanged(); // ALWAYS call super first!

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

### ⚠️ DO NOT Redefine Base Properties

**CRITICAL:** The following properties are managed by `PersistentObjectAttribute` base class. **NEVER** redefine these in your child class - doing so will break the inheritance chain and computed property system:

**Core Properties:**
- `attribute` - The PersistentObjectAttribute model (has observer)
- `value` - The current value (has observer + @notify)
- `editing` - Computed from `attribute.parent.isEditing` (readonly)
- `nonEdit` - Force display mode even when editing
- `disabled` - Disabled state

**State Properties (computed, readonly):**
- `readOnly` - Computed from `attribute.isReadOnly`, `disabled`, and `sensitive`
- `readOnlyTabIndex` - Computed from `readOnly` ("-1" when read-only, null otherwise)
- `frozen` - Computed from `attribute.parent.isFrozen`
- `required` - Computed from `attribute.isRequired`
- `sensitive` - Computed from `attribute.isSensitive` and app settings
- `placeholder` - Computed from type hint
- `validationError` - Computed from `attribute.validationError` (readonly, has @notify)
- `hasError` - Computed from `validationError` (readonly)

**Other Properties:**
- `options` - Getter (not a decorator property) that returns `attribute.options`
- `gridArea` - Grid area string (has observer that sets style.gridArea)

**You can only:**
- ✅ Add NEW properties with `@property()` or `@state()`
- ✅ Override methods (see next section)
- ❌ NEVER redefine any property listed above

### Overrideable Methods Reference

**Protected methods you CAN override** (use `protected override` keyword):

⚠️ **IMPORTANT:** When overriding lifecycle methods (`_attributeChanged`, `_valueChanged`, `_attributeValueChanged`, `_editingChanged`, `_optionsChanged`), **DO NOT** add `@observer()` decorators. The base class already has the observers set up. Simply use the `override` keyword - the overridden method will automatically be called by the base class observer.

**Lifecycle & Synchronization:**
```typescript
// Called when attribute property changes
protected override _attributeChanged() {
    super._attributeChanged(); // ALWAYS call super first!

    if (this.attribute instanceof Vidyano.PersistentObjectAttribute) {
        // Read type hints, initialize component-specific state
        this.unitBefore = this.attribute.getTypeHint("unit");
    }
}

// Called when attribute.value changes (syncs model → component)
protected override _attributeValueChanged() {
    super._attributeValueChanged(); // Default: this.value = this.attribute.value

    // Override if you need value transformation (e.g., decimal separators)
    // See "Circular Update Prevention" section below!
}

// Called when this.value changes (syncs component → model)
protected override _valueChanged(newValue: any, oldValue: any): void | Promise<void> {
    // Default: this.attribute.setValue(newValue, false)

    // Override if you need validation or transformation
    // See "Circular Update Prevention" section below!
}

// Called when editing state changes
protected override _editingChanged() {
    super._editingChanged(); // Currently a noop in base

    // Override if you need to react to editing state changes
}

// Called when options change
protected override _optionsChanged(options: string[] | Vidyano.PersistentObjectAttributeOption[]) {
    super._optionsChanged(options); // Currently a noop in base

    // Override if you need to react to options changes
}
```

**Rendering:**
```typescript
protected override renderDisplay(innerTemplate?: TemplateResult) {
    return super.renderDisplay(html`<span>${this.attribute?.displayValue}</span>`);
}

protected override renderEdit(innerTemplate?: TemplateResult) {
    return super.renderEdit(html`
        <input .value=${this.value} @input=${this._onInput}>
    `);
}
```

**Focus Management:**
```typescript
// Override if custom focus behavior needed
override focus() {
    this.shadowRoot?.querySelector("input")?.focus();
}
```

### Understanding PersistentObject Editing Lifecycle

When working with PersistentObject attributes, it's important to understand how the editing state behaves:

**Edit Mode Requirement:**
- **CRITICAL:** You cannot set attribute values unless the parent PersistentObject is in edit mode
- Attempting to call `attribute.setValue()` will throw an error if:
  - `parent.isEditing` is `false`
  - `parent.isFrozen` is `true`
  - `attribute.isReadOnly` is `true`
- Before setting attribute values, ensure the parent is in edit mode by checking `parent.isEditing`
- If not in edit mode, call `parent.beginEdit()` once before setting any attributes

**Save Behavior:**
- Calling `save()` will **exit edit mode** by default after the save completes
- The object returns to display/read-only mode after saving
- **Exception:** If the PersistentObject's state behavior is set to `StayInEdit`, it remains in edit mode after saving

**Making Subsequent Changes:**
- To make another change after saving, you must call `beginEdit()` on the PersistentObject again
- This transitions the object back into edit mode, allowing modifications

**Impact on Attributes:**
- The `editing` computed property on attributes automatically reflects the parent object's editing state
- When the parent exits edit mode, `_editingChanged()` is called on all attributes
- Attribute components should handle the display ↔ edit transitions through `renderDisplay()` and `renderEdit()`

```typescript
// Example: Making multiple edits
const person = await service.getPersistentObject("Person", "123");

// First edit
await person.beginEdit();
person.getAttribute("Name").setValue("John");
await person.save();
// Object is now in display mode (unless StayInEdit is set)

// Second edit - need to call beginEdit() again
await person.beginEdit();
person.getAttribute("Email").setValue("john@example.com");
await person.save();
```

### Circular Update Prevention Pattern

**CRITICAL for attributes that transform values** (e.g., formatting, decimal separators, date formats):

When you override both `_attributeValueChanged()` and `_valueChanged()`, you can create infinite loops:
```
attribute.value → _attributeValueChanged() → this.value
                → _valueChanged() → attribute.value → ...
```

**Solution:** Use a block flag to prevent circular updates:

```typescript
export class PersistentObjectAttributeNumeric extends PersistentObjectAttribute {
    private _attributeValueChangedBlock: boolean = false;

    protected override _attributeValueChanged() {
        // Block prevents circular updates
        if (this._attributeValueChangedBlock)
            return;

        try {
            this._attributeValueChangedBlock = true;

            // Transform attribute.value for display
            if (this.attribute.value == null) {
                if (this.value !== "")
                    this.value = "";
                return;
            }

            const displayValue = this._formatForDisplay(this.attribute.value);
            if (this.value !== displayValue)
                this.value = displayValue;
        }
        finally {
            this._attributeValueChangedBlock = false;
        }
    }

    protected override async _valueChanged(newValue: string, oldValue: string) {
        if (!this.attribute || newValue === undefined)
            return;

        // Block prevents circular updates
        if (this._attributeValueChangedBlock)
            return;

        // Transform display value back to model value
        const modelValue = this._parseFromDisplay(newValue);

        if (modelValue !== this.attribute.value)
            await this.attribute.setValue(modelValue, false).catch(Vidyano.noop);
    }
}
```

**When to use this pattern:**
- ✅ Number formatting (decimal separators, thousand separators)
- ✅ Date/time formatting
- ✅ Any value transformation between model and display
- ❌ Simple pass-through attributes (default behavior is fine)

### TypeScript Best Practices

**Always use `override` keyword** when overriding base class methods:

```typescript
// GOOD
protected override _attributeChanged() {
    super._attributeChanged();
}

protected override renderEdit() {
    return super.renderEdit(html`...`);
}

// BAD - no override keyword
protected _attributeChanged() {
    super._attributeChanged();
}
```

The `override` keyword:
- Ensures the method actually exists in the base class (compile-time safety)
- Makes it clear you're overriding inherited behavior
- Prevents typos (e.g., `_attributeChange` instead of `_attributeChanged`)

**Always call `super` first in lifecycle methods:**
```typescript
protected override _attributeChanged() {
    super._attributeChanged(); // ← Must be first!

    // Then your logic
    if (this.attribute) {
        // ...
    }
}
```

**Private methods and fields conventions:**

⚠️ **CRITICAL RULE - READ CAREFULLY:**

The `#` syntax for private fields is **ONLY** for truly internal helper methods that are **NEVER** accessed outside the class. Any method that is referenced in a template **MUST** use `private _methodName` (with underscore).

**Why?** Because `#privateMethods` cannot be accessed in templates - they are truly private and inaccessible. Using `@click=${this.#method}` will cause runtime errors because the template cannot access the private field.

```typescript
// ✅ CORRECT - # for internal helpers NEVER used in templates (no underscore)
#formatValue(value: string): string {
    return value.toUpperCase();
}

#calculateSomething(): number {
    return this.someValue * 2;
}

#parseDate(dateString: string): Date {
    // Complex parsing logic only called from other methods
    return new Date(dateString);
}

// ✅ CORRECT - Use 'private _' for ALL event handlers (with underscore)
private _onInput(e: Event) { }     // Can use: @input=${this._onInput}
private _onClick(e: Event) { }     // Can use: @click=${this._onClick}
private _onBlur(e: Event) { }      // Can use: @blur=${this._onBlur}
private _onKeydown(e: Event) { }   // Can use: @keydown=${this._onKeydown}

// ✅ CORRECT - Use 'private _' for methods with decorators (with underscore)
@observer(...)
private _someObserver() { }

// ❌ WRONG - NEVER use # for event handlers or template methods
#onInput(e: Event) { }  // ❌ Cannot use in template: @input=${this.#onInput}
#onClick(e: Event) { }  // ❌ Will fail at runtime!

// ❌ WRONG - NEVER use # for methods with decorators
@observer(...)
#myMethod() { }  // ❌ Cannot use decorators with #
```

**The Simple Rule:**
- **Is the method referenced in `renderDisplay()` or `renderEdit()`?** → Use `private _methodName`
- **Is the method only called from other class methods?** → Use `#methodName`

**Common Template References That Need `private _`:**
- Event handlers: `@click=${this._method}`, `@input=${this._method}`, `@blur=${this._method}`, etc.
- Any method directly referenced in `html\`...\`` templates
- Methods with decorators (`@observer`, `@computed`, etc.)

**Rules:**
- ✅ Use `#methodName` (no underscore) for internal helper methods **ONLY** called from within the class
- ❌ **NEVER** use `#` for methods with decorators (e.g., `@observer`, `@computed`)
- ❌ **NEVER** use `#` for methods referenced in templates (e.g., event handlers like `@click=${this.method}`)
- ✅ Use `private _methodName` (with underscore) for methods with decorators **OR** used in templates

### Understanding @notify() Decorator

The `@notify()` decorator makes a property fire change events that can be observed by parent components.

**Base class uses @notify() on:**
- `value` - Fires `value-changed` event when value changes
- `validationError` - Fires `validation-error-changed` event

**In child classes:**
- ❌ DO NOT add `@notify()` to properties inherited from base class
- ✅ Only use `@notify()` on NEW properties you add that need to notify parents
- ℹ️ Most attribute child classes don't need `@notify()` at all

```typescript
// Base class already has this (don't redefine!)
@property({ type: Object })
@notify()
value: any;

// If you add a new property that needs to notify parents:
@property({ type: String })
@notify()
customProperty: string;
```

## Optimization Patterns

### Type Hints as Computed Properties

Instead of reading type hints in `_attributeChanged()` and storing them in state, make them **computed properties** that derive from `attribute.typeHints`:

**❌ BAD - Manual state management:**
```typescript
@state()
characterCasing: string;

protected override _attributeChanged() {
    super._attributeChanged();
    if (this.attribute instanceof Vidyano.PersistentObjectAttribute) {
        this.characterCasing = this.attribute.getTypeHint("CharacterCasing", "Normal");
    }
}
```

**✅ GOOD - Computed from attribute.typeHints:**
```typescript
@computed(function(this: PersistentObjectAttributeString): string {
    return this.attribute?.getTypeHint("CharacterCasing", "Normal") || "Normal";
}, "attribute.typeHints")
declare readonly characterCasing: string;
```

**Why this is better:**
- ✅ Automatically reactive to type hint changes on refresh
- ✅ Uses `getTypeHint()` with default values consistently
- ✅ Less code in lifecycle methods
- ✅ Single source of truth
- ✅ Observes `attribute.typeHints` to catch changes

**Important:** Always observe `"attribute.typeHints"` (not just `"attribute"`) to ensure changes on refresh trigger recomputation. Then use `this.attribute.getTypeHint()` inside the function.

### Observers as Getters

If an `@observer` function only computes a derived value from another property, use a **getter** instead:

**❌ BAD - Observer updating state:**
```typescript
@state()
@observer(function(this: MyComponent, casing: string) {
    if (casing === "Upper")
        this.editInputStyle = "text-transform: uppercase;";
    else if (casing === "Lower")
        this.editInputStyle = "text-transform: lowercase;";
    else
        this.editInputStyle = undefined;
})
characterCasing: string;

@state()
editInputStyle: string;
```

**✅ GOOD - Getter computed on-demand:**
```typescript
@state()
characterCasing: string;

get editInputStyle(): string | undefined {
    if (this.characterCasing === "Upper")
        return "text-transform: uppercase;";
    if (this.characterCasing === "Lower")
        return "text-transform: lowercase;";
    return undefined;
}
```

**Why this is better:**
- ✅ No redundant state property
- ✅ Computed on-demand when accessed
- ✅ Simpler and more declarative
- ✅ Automatically reactive through Lit's reactive system

### Value Transformation: @input Handler vs _valueChanged

For attributes that transform user input (character casing, formatting), handle the transformation **at the source** (in the `@input` handler) instead of in `_valueChanged`:

**❌ BAD - Transformation in _valueChanged:**
```typescript
protected override _valueChanged(value: any, oldValue: any) {
    if (this.editing && value && this.characterCasing !== "Normal") {
        const transformed = this.characterCasing === "Upper" ? value.toUpperCase() : value.toLowerCase();
        // Complex DOM manipulation, cursor position handling...
        super._valueChanged(transformed, oldValue);
        return;
    }
    super._valueChanged(value, oldValue);
}
```

**✅ GOOD - Transformation in @input handler:**
```typescript
private _onInput(e: InputEvent) {
    const input = e.target as HTMLInputElement;
    let value = input.value;

    // Transform based on character casing
    if (this.editing && this.characterCasing !== "Normal") {
        const transformed = this.characterCasing === "Upper" ? value.toUpperCase() : value.toLowerCase();
        if (transformed !== value) {
            const start = input.selectionStart;
            const end = input.selectionEnd;
            input.value = transformed;
            input.selectionStart = start;
            input.selectionEnd = end;
            value = transformed;
        }
    }

    this.value = value;
}

// renderEdit uses @input=${this._onInput}
```

**Why this is better:**
- ✅ Transformation happens at the input source
- ✅ _valueChanged has single responsibility (sync with attribute)
- ✅ No need to override _valueChanged at all
- ✅ Cleaner separation of concerns
- ✅ No DOM manipulation in lifecycle methods

**When to use each approach:**
- **Use @input handler:** For UI transformations (character casing, input masking)
- **Use _valueChanged override:** For model transformations (decimal separators, date parsing) - see Circular Update Prevention section

### Splitting Complex Render Methods

When `renderEdit()` or `renderDisplay()` becomes complex with multiple conditional branches, extract the different render paths into separate private helper methods:

**❌ BAD - Complex ternary in render method:**
```typescript
protected override renderEdit() {
    if (this.sensitive)
        return this.renderDisplay();

    return this.isCheckbox ? html`
        <vi-checkbox
            .checked=${this.value}
            @checked-changed=${(e: CustomEvent) => this.value = e.detail.value}
            label=${this.attribute?.displayValue || nothing}
            ?disabled=${this.readOnly || this.frozen}>
        </vi-checkbox>
    ` : html`
        <vi-toggle
            .toggled=${this.value}
            @toggled-changed=${(e: CustomEvent) => this.value = e.detail.value}
            label=${this.attribute?.displayValue || nothing}
            ?disabled=${this.readOnly || this.frozen}>
        </vi-toggle>
    `;
}
```

**✅ GOOD - Extract into private helper methods:**
```typescript
protected override renderEdit() {
    if (this.sensitive)
        return this.renderDisplay();

    return this.isCheckbox ? this.#renderCheckbox() : this.#renderToggle();
}

#renderCheckbox() {
    return html`
        <vi-checkbox
            .checked=${this.value}
            @checked-changed=${(e: CustomEvent) => this.value = e.detail.value}
            label=${this.attribute?.displayValue || nothing}
            ?disabled=${this.readOnly || this.frozen}>
        </vi-checkbox>
    `;
}

#renderToggle() {
    return html`
        <vi-toggle
            .toggled=${this.value}
            @toggled-changed=${(e: CustomEvent) => this.value = e.detail.value}
            label=${this.attribute?.displayValue || nothing}
            ?disabled=${this.readOnly || this.frozen}>
        </vi-toggle>
    `;
}
```

**Why this is better:**
- ✅ Each render method has a single, clear purpose
- ✅ Easier to read and maintain
- ✅ Better separation of concerns
- ✅ Simpler to test individual render paths

### Understanding setValue() Parameters

When calling `this.attribute.setValue()`, the second parameter controls whether to trigger a refresh:

```typescript
this.attribute.setValue(newValue, triggerRefresh)
```

**When to use `false` (most common):**
```typescript
protected override _valueChanged(newValue: any, oldValue: any) {
    if (this.attribute && newValue !== this.attribute.value)
        this.attribute.setValue(newValue, false).catch(Vidyano.noop);
}
```
- ✅ String, numeric, date attributes
- ✅ Most text input attributes
- ✅ Attributes that don't affect other fields

**When to use `true` (triggers refresh):**
```typescript
protected override _valueChanged(newValue: any, oldValue: any) {
    if (this.attribute && newValue !== this.attribute.value)
        this.attribute.setValue(newValue, true).catch(Vidyano.noop);
}
```
- ✅ Boolean attributes (checkboxes/toggles)
- ✅ Attributes that control visibility/state of other fields
- ✅ Attributes that affect computed properties elsewhere
- ✅ When dependent UI needs to update immediately

**Rule of thumb:** Check the original Polymer implementation - if it used `true`, keep it. If unsure, use `false` (the base class default).

### Code Organization

Organize class members in this order for better readability:

```typescript
export class PersistentObjectAttributeXxx extends PersistentObjectAttribute {
    static styles = [super.styles, unsafeCSS(styles)];

    // 1. Private fields
    #somethingInternal: string;

    // 2. Reactive properties (@state, @property, @computed)
    @state()
    someState: string;

    @computed(function(this: MyComponent): string {
        return this.attribute?.getTypeHint("Something", "default") || "default";
    }, "attribute.typeHints")
    declare readonly someComputed: string;

    // 3. Getters (computed values without decorators)
    get derivedValue(): string {
        return this.someState.toUpperCase();
    }

    // 4. Lifecycle methods
    protected override _attributeChanged() { }

    // 5. Event handlers
    #onInput(e: InputEvent) { }
    #onBlur() { }

    // 6. Render methods
    protected override renderDisplay() { }
    protected override renderEdit() { }

    // 7. Private render helpers (if needed)
    #renderCheckbox() { }
    #renderToggle() { }
}
```

**Key principle:** Keep reactive properties together, separate from getters and methods. This makes dependencies and data flow clearer.

## Reference Examples
- `src/vidyano/web-components/persistent-object-attribute/attributes/persistent-object-attribute-boolean/persistent-object-attribute-boolean.ts` - Boolean attribute with split render methods, computed type hints, and setValue(true) for refresh
- `src/vidyano/web-components/persistent-object-attribute/attributes/persistent-object-attribute-string/persistent-object-attribute-string.ts` - String attribute with @input transformations and type hints
- `src/vidyano/web-components/persistent-object-attribute/attributes/persistent-object-attribute-user/persistent-object-attribute-user.ts` - Attribute with type hints
- `src/vidyano/web-components/persistent-object-attribute/attributes/persistent-object-attribute-numeric/persistent-object-attribute-numeric.ts` - Complex attribute with value transformation and circular update prevention

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
- [ ] NO base class properties redefined (`attribute`, `value`, `editing`, `readOnly`, `sensitive`, `frozen`, `placeholder`, `readOnlyTabIndex`, `required`, `validationError`, `hasError`, `options`, `nonEdit`, `disabled`, `gridArea`)
- [ ] Properties use `@property()` or `@state()` decorators
- [ ] Computed properties use `@computed()` decorator with `declare readonly`
- [ ] Observers use `@observer()` decorator
- [ ] No Polymer-style `properties` object
- [ ] All `@computed` functions inlined (no separate `_compute*` methods)
- [ ] All `@observer` functions inlined (no separate `_*Changed` methods unless complex)
- [ ] Single-statement wrapper functions fully inlined
- [ ] NO `@notify()` added to inherited properties (only on NEW properties if needed)

### Registration
- [ ] `customElements.define("vi-component-name", ClassName)` at end of file
- [ ] `PersistentObjectAttributeRegister.add("TypeName", ClassName)` for attribute registration

### Type Hints & Lifecycle
- [ ] Type hints read in `_attributeChanged()` with `super._attributeChanged()` call FIRST
- [ ] `instanceof Vidyano.PersistentObjectAttribute` check before reading type hints
- [ ] `ready()` converted to `firstUpdated()` if present
- [ ] All overridden methods use `override` keyword
- [ ] All lifecycle method overrides call `super` first
- [ ] If overriding both `_attributeValueChanged()` and `_valueChanged()` with transformations, circular update prevention pattern implemented with block flag

### Imports
- [ ] No `import * as Polymer from "polymer"`
- [ ] Lit imports: `html`, `nothing` (if needed), `unsafeCSS`
- [ ] Decorators from `"lit/decorators.js"` or `"components/web-component/web-component"`

### Build
- **DO NOT run `npm run build`** - the development environment uses watchers that automatically rebuild on file changes