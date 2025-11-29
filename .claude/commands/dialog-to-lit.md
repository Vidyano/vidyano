---
description: Migrate a Polymer Dialog component to Lit
args: <dialog-file.ts>
---

You are migrating a Vidyano Polymer Dialog component to Lit.

## Prerequisites
First, read the `/lit` command documentation for general Polymer to Lit migration patterns. This command covers dialog-specific differences only.

## Key Differences for Dialogs

### Base Class
Dialogs extend `Dialog` instead of `WebComponent`:

```typescript
// Before
import * as Polymer from "polymer"

export class MyDialog extends Polymer.Dialog {
    static get template() { return Polymer.Dialog.dialogTemplate(Polymer.html`<link rel="import" href="my-dialog.html">`) }
}

// After
import { Dialog } from "components/dialog/dialog";

export class MyDialog extends Dialog {
    // No static template - use renderContent() instead
}
```

### Template Method
Dialogs implement `renderContent()` instead of `render()`:

```typescript
import { html, TemplateResult } from "lit";

protected renderContent(): TemplateResult {
    return html`
        <header>...</header>
        <main>...</main>
        <footer>...</footer>
    `;
}
```

The base `Dialog` class wraps this content in a `<dialog>` element automatically.

### Styles
Combine parent and child styles using `CSSResultGroup`:

```typescript
import { CSSResultGroup, unsafeCSS } from "lit";
import { Dialog } from "components/dialog/dialog";
import styles from "./my-dialog.css";

export class MyDialog extends Dialog {
    static styles: CSSResultGroup = [Dialog.styles, unsafeCSS(styles)];
}
```

### Close Button
Use the `renderCloseButton()` helper method for the standard close button:

```typescript
protected renderContent(): TemplateResult {
    return html`
        <header>
            <h4>Title</h4>
            ${!this.options.noClose ? this.renderCloseButton() : nothing}
        </header>
        ...
    `;
}
```

This ensures proper event binding. The helper renders:
```html
<vi-button class="close" @click=${() => this.cancel()} icon="Remove"></vi-button>
```

### Focus Management
The `_focusElement` method is available from the `Dialog` base class - no need to implement it.

### Registration
```typescript
customElements.define("vi-my-dialog", MyDialog);
```

## Migration Checklist
- [ ] Change base class from `Polymer.Dialog` to `Dialog`
- [ ] Remove `static get template()` method
- [ ] Implement `renderContent(): TemplateResult`
- [ ] Use `CSSResultGroup` type for combined styles
- [ ] Convert template syntax per `/lit` command
- [ ] Add layout styles to SCSS (no utility classes)
- [ ] Delete the old `.html` template file

## Example

See `src/vidyano/web-components/message-dialog/message-dialog.ts` for a complete migrated dialog example.
