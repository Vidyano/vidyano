# Vidyano v3 to v4 Compatibility Migration

## Overview

This guide helps you quickly update your Vidyano v3 components to work with v4 while maintaining your existing Polymer-based implementation. This is the fastest migration path that requires minimal code changes—perfect when you need v4 compatibility but aren't ready for a full component rewrite.

## Migration Steps

### 1. Update Package Dependencies

Ensure you're using Vidyano v4:

```bash
npm install @vidyano/vidyano@^4.0.0
```

### 2. Change Imports to Polymer Namespace

Update your imports to use the `Polymer` namespace instead of importing `WebComponent` directly:

```typescript
// Before (v3)
import { WebComponent } from "@vidyano/vidyano";

// After (v4 compatibility)
import { Polymer } from "@vidyano/vidyano";
```

### 3. Update Base Class

Change your component to extend `Polymer.WebComponent` instead of `WebComponent`:

```typescript
// Before (v3)
export class MyComponent extends WebComponent {
    // Your existing code
}

// After (v4 compatibility)
export class MyComponent extends Polymer.WebComponent {
    // Your existing code - no other changes needed
}
```

### 4. Update Registration Decorators

Use the `@Polymer.WebComponent.register()` decorator instead of `@WebComponent.register()`:

```typescript
// Before (v3)
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
    // Your existing Polymer code
}

// After (v4 compatibility)
@Polymer.WebComponent.register({
    properties: {
        myProp: String,
        myNumber: {
            type: Number,
            value: 42
        }
    }
}, "vi-my-component")
export class MyComponent extends Polymer.WebComponent {
    // Your existing Polymer code - no other changes needed
}
```
