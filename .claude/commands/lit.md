---
description: Migrate a Polymer web component to Lit
args: <component-file.ts>
---

You are helping migrate a Vidyano Polymer web component to Lit. Follow these steps carefully:

## Step 1: Read Migration Guide and Component
1. Read the migration guide: `docs/migration/v3-to-v4/polymer-to-lit.md`
2. Read the TypeScript component file provided by the user
3. Find and read the associated `.html` template file (same directory, same name)
4. Find and read the associated `.scss` or `.css` file (same directory, same name)

## Step 2: Create Migration Plan
Create a plan file at `plans/migrate-[component-name]-YYYYMMDD-plan.md` with these sections:

```markdown
# Plan: Migrate [ComponentName] from Polymer to Lit

## Investigation
- [ ] Read component TypeScript file
- [ ] Read component HTML template
- [ ] Read component styles
- [ ] Identify properties, observers, and computed properties
- [ ] Check for layout utility classes in template
- [ ] Check for listeners and event bindings

## Migration Tasks
- [ ] Update imports (add Lit, remove Polymer)
- [ ] Convert properties to @property/@state decorators
- [ ] Convert observers to @observer decorator
- [ ] Convert computed properties to @computed decorator or getters
- [ ] Convert template from HTML file to inline render() method
- [ ] Handle layout utility classes (create semantic names)
- [ ] Convert styles (move to TypeScript import)
- [ ] Update custom element registration
- [ ] Convert lifecycle methods (ready → firstUpdated)
- [ ] Convert event listeners to @listener decorator

## Validation
- [ ] Build the project: `npm run build`
- [ ] Check for TypeScript errors
- [ ] Verify all template syntax converted correctly
- [ ] Check for missing layout styles
- [ ] Delete the old .html template file

## Notes
[Add findings here]
```

## Step 3: Migration Implementation

For each task in the plan:

### Imports
Replace:
```typescript
import { Polymer, WebComponent } from "@vidyano/vidyano";
```

With:
```typescript
import { html, nothing, unsafeCSS } from "lit";
import { property } from "lit/decorators.js";
import { WebComponent } from "components/web-component/web-component";
import styles from "./component-name.css";
```

**IMPORTANT**: Import patterns for this codebase:
- Import `WebComponent` from `"components/web-component/web-component"` (mapped path in tsconfig)
- Import decorators (`observer`, `computed`, `notify`, `listener`) from the same module - they're re-exported:
  ```typescript
  import { notify, observer, WebComponent } from "components/web-component/web-component";
  ```
- Only import from `lit` what you actually use (`html` is always needed, `nothing` for conditionals, `unsafeCSS` for styles)
- Do NOT use `@vidyano/vidyano` package imports or relative paths like `../../vidyano/`

### Properties
Convert from:
```typescript
@WebComponent.register({
    properties: {
        myProp: String,
        myNum: { type: Number, value: 42 }
    }
}, "vi-my-component")
```

To:
```typescript
@property({ type: String })
myProp: string;

@property({ type: Number })
myNum: number = 42;
```

### Observers
Convert property observers from:
```typescript
properties: {
    userId: {
        type: String,
        observer: "_userIdChanged"
    }
}
```

To:
```typescript
import { observer, WebComponent } from "components/web-component/web-component";

@property({ type: String })
@observer(MyComponent.prototype._userIdChanged)
userId: string;

private _userIdChanged(newValue: string, oldValue: string) {
    // ...
}
```

### Computed Properties
Convert from:
```typescript
properties: {
    fullName: {
        type: String,
        computed: "_computeFullName(firstName, lastName)"
    }
}
```

To:
```typescript
import { computed, WebComponent } from "components/web-component/web-component";

@property({ type: String })
@computed(function(this: MyComponent, firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`;
}, "firstName", "lastName")
declare readonly fullName: string;
```

### Template Conversion
1. Convert template method to render():
   - Remove `static get template()` method
   - Add `render()` method returning `html`...``
   - Copy HTML from `.html` file into the template literal

2. Convert template syntax:
   - `[[property]]` → `${this.property}`
   - `{{property}}` → `${this.property}`
   - `on-click` → `@click`
   - `class$="[[className]]"` → `class=${this.className}`
   - `disabled$="[[disabled]]"` → `?disabled=${this.disabled}`
   - `value="{{value}}"` → `.value=${this.value}`
   - `<template is="dom-if" if="[[condition]]">...</template>` → `${this.condition ? html`...` : nothing}`
   - `<template is="dom-repeat" items="[[items]]">...</template>` → `${this.items?.map(item => html`...`)}`

3. Handle layout classes:
   - Find all `class="layout horizontal"`, `class="layout vertical"`, `class="flex"`, etc.
   - Create semantic class names in SCSS (e.g., `.container`, `.content`, `.header`)
   - Add flexbox styles to SCSS:
     - `layout horizontal` → `display: flex; flex-direction: row;`
     - `layout vertical` → `display: flex; flex-direction: column;`
     - `flex` → `flex: 1; min-width: 0;` (for row) or `flex: 1; min-height: 0;` (for column)
   - Important: Always add `min-width: 0` (row) or `min-height: 0` (column) when using `flex: 1` to prevent overflow issues
   - Update template to use semantic names or remove classes entirely if styling the element directly

### Styles
1. Move styles from HTML to CSS/SCSS file
2. Import and apply in TypeScript:
```typescript
import styles from "./component-name.css";

export class MyComponent extends WebComponent {
    static styles = unsafeCSS(styles);
}
```

### Registration
Replace:
```typescript
@WebComponent.register({ properties: {...} }, "vi-my-component")
export class MyComponent extends WebComponent { }
```

With:
```typescript
export class MyComponent extends WebComponent {
    // class body
}

customElements.define("vi-my-component", MyComponent);
```

### Lifecycle Methods
- `ready()` → `firstUpdated(changedProperties: Map<PropertyKey, unknown>)`
- Add `super.firstUpdated(changedProperties);` at the start

### Event Listeners
Convert from:
```typescript
@WebComponent.register({
    listeners: {
        "my-event": "_handleEvent"
    }
})
```

To:
```typescript
import { listener, WebComponent } from "components/web-component/web-component";

@listener("my-event")
private _handleEvent(e: CustomEvent) { ... }
```

## Step 4: Build and Validate
After migration:
1. Run `npm run build`
2. Check for errors
3. Delete the old `.html` template file (no longer needed since template is now inline)
4. Mark tasks complete in plan
5. Report any issues to user

## Important Notes
- Use `"components/web-component/web-component"` for WebComponent and decorator imports (mapped path in tsconfig)
- All decorators (`observer`, `computed`, `notify`, `listener`) are re-exported from the WebComponent module
- Keep template conversion accurate - don't skip any bindings
- Always create semantic class names for layout utilities (`.container`, `.content`, etc.)
- Test that observers and computed properties work correctly
- Preserve all functionality from original component
- Clean up: Delete the old `.html` template file after migration
