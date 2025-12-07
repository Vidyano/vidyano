# Generate Component E2E Tests with Backend

You are tasked with generating test infrastructure for a Vidyano web component that requires a backend with PersistentObject support.

## Input
The user will provide a component path, for example:
```
src/vidyano/web-components/persistent-object-presenter/persistent-object-presenter.ts
```

## Your Task

1. **Parse Component Information**
   - Extract component name from path (e.g., `persistent-object-presenter`)
   - Determine the component tag (e.g., `vi-persistent-object-presenter`)
   - Identify what PersistentObject configuration the component needs

2. **Read the Source Component**
   - Understand what properties the component expects
   - Identify what PersistentObject/Query data it works with
   - Note any special configuration needed

3. **Generate Test Directory Structure**
   Create `tests/vidyano/{component-name}/` with:
   - `{component-name}.spec.ts` - Playwright test file
   - `{component-name}.cs` - Backend mock file

4. **Generate Backend File**
   Create `tests/vidyano/{component-name}/{component-name}.cs`:

   ```csharp
   #:sdk Microsoft.NET.Sdk.Web
   #:property PublishAot=false
   #:package Vidyano@6.0.*

   using Vidyano.Core.Services;
   using Vidyano.Service;
   using Vidyano.Service.Repository;

   var builder = WebApplication.CreateBuilder(args);

   builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
       .WithDefaultAdmin()
       .WithDefaultUser("Admin")
       .WithSchemaRights()
       .WithMenuItem(nameof(MockContext.Items))
       .WithModel(builder =>
       {
           var po = builder.GetOrCreatePersistentObject(nameof(Mock_Item));

           // Configure attributes as needed
           var name = po.GetOrCreateAttribute(nameof(Mock_Item.Name));
           name.DataType = "String";
       })
   );

   var app = builder.Build();

   app.UseVidyano(app.Environment, app.Configuration);

   app.Run();

   public class MockContext : NullTargetContext
   {
       private static readonly List<Mock_Item> items = [];

       public MockContext()
       {
           Register(items);
       }

       public IQueryable<Mock_Item> Items => Query<Mock_Item>();

       public static Mock_Item GetOrCreateItem(string objectId)
       {
           var item = items.FirstOrDefault(a => a.Id == objectId);

           if (item == null)
               items.Add(item = new Mock_Item { Id = objectId });

           return item;
       }

       public override void AddObject(PersistentObject obj, object entity)
       {
           if (entity is Mock_Item item)
               item.Id ??= (items.Count + 1).ToString();

           base.AddObject(obj, entity);
       }
   }

   public class MockWeb: CustomApiController
   {
       public override void GetWebsiteContent(WebsiteArgs args)
       {
           base.GetWebsiteContent(args);

           var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
           if (!string.IsNullOrEmpty(frontEndUrl))
               args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
       }
   }

   public class Mock_ItemActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Item>(context)
   {
       public override Mock_Item? GetEntity(PersistentObject obj)
       {
           if (string.IsNullOrEmpty(obj.ObjectId))
               throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

           return MockContext.GetOrCreateItem(obj.ObjectId);
       }
   }

   public class Mock_Item
   {
       public string Id { get; set; } = null!;
       public string? Name { get; set; } = "Test";
   }
   ```

5. **Generate Test Spec File**
   Create `tests/vidyano/{component-name}/{component-name}.spec.ts`:

   ```typescript
   import { test, expect, Page, Locator } from '@playwright/test';
   import { setupPage } from '../_helpers/page';
   import { startBackend, stopBackend, BackendProcess } from '../_helpers/backend';

   let backend: BackendProcess | undefined;

   test.describe.serial('{ComponentName}', () => {
       let sharedPage: Page;

       test.beforeAll(async ({ browser }, testInfo) => {
           backend = await startBackend(testInfo);
           sharedPage = await browser.newPage();
           await setupPage(sharedPage, '', backend.port);
       });

       test.afterAll(async () => {
           await sharedPage.close();
           await stopBackend(backend);
       });

       async function setupComponent(options?: { /* component-specific options */ }) {
           const componentId = `component-${Math.random().toString(36).substring(2, 15)}`;

           // Wait for custom element to be defined
           await sharedPage.waitForFunction(
               (tag) => !!customElements.get(tag),
               '{component-tag}',
               { timeout: 10000 }
           );

           await sharedPage.evaluate(async ({ componentId, options }) => {
               // Get PersistentObject from backend
               const po = await (window as any).service.getPersistentObject(
                   null,
                   'Mock_Item',
                   'test-object-id'
               );

               // Create component
               const container = document.getElementById('test-container');
               if (!container)
                   throw new Error('Test container not found');

               const component = document.createElement('{component-tag}');
               component.id = componentId;

               // Set component properties
               // (component as any).persistentObject = po;

               container.appendChild(component);

               // Wait for Lit update cycle
               if (typeof (component as any).updateComplete !== 'undefined')
                   await (component as any).updateComplete;

               // Store reference for later
               if (!(window as any).componentMap)
                   (window as any).componentMap = {};
               (window as any).componentMap[componentId] = { component, po };
           }, { componentId, options });

           return sharedPage.locator(`#${componentId}`);
       }

       // Helper to get component ID with proper typing
       async function getComponentId(component: Locator): Promise<string> {
           return await component.getAttribute('id') as string;
       }

       async function beginEdit(component: Locator) {
           const componentId = await getComponentId(component);
           await sharedPage.evaluate((id) => {
               const { po } = (window as any).componentMap[id];
               po.beginEdit();
           }, componentId);
       }

       async function cancelEdit(component: Locator) {
           const componentId = await getComponentId(component);
           await sharedPage.evaluate((id) => {
               const { po } = (window as any).componentMap[id];
               po.cancelEdit();
           }, componentId);
       }

       async function freeze(component: Locator) {
           const componentId = await getComponentId(component);
           await sharedPage.evaluate((id) => {
               const { po } = (window as any).componentMap[id];
               po.freeze();
           }, componentId);
       }

       async function unfreeze(component: Locator) {
           const componentId = await getComponentId(component);
           await sharedPage.evaluate((id) => {
               const { po } = (window as any).componentMap[id];
               po.unfreeze();
           }, componentId);
       }

       // Tests
       test('renders correctly', async () => {
           const component = await setupComponent();
           await expect(component).toBeVisible();
       });

       // Add more tests...
   });
   ```

6. **Helper Functions**
   If the component needs PersistentObject lifecycle helpers (beginEdit, save, etc.),
   these should be added to the test file locally or to `tests/vidyano/_helpers/persistent-object.ts`.

## Backend Configuration Patterns

### Required Attributes
Use `Rules` (not `DataTypeHints`) to make an attribute required:
```csharp
var attr = po.GetOrCreateAttribute(nameof(Mock_Item.RequiredField));
attr.DataType = "String";
attr.Rules = "NotEmpty";  // Makes attribute.isRequired = true
```

### Read-Only Attributes
```csharp
var attr = po.GetOrCreateAttribute(nameof(Mock_Item.ReadOnlyField));
attr.DataType = "String";
attr.IsReadOnly = true;
```

### Type Hints
```csharp
var attr = po.GetOrCreateAttribute(nameof(Mock_Item.Field));
attr.DataType = "String";
attr.DataTypeHints = "nolabel=true";  // or "nonedit=true", "CharacterCasing=Upper", etc.
```

### Hidden Attributes
```csharp
var attr = po.GetOrCreateAttribute(nameof(Mock_Item.HiddenField));
attr.DataType = "String";
attr.Visibility = AttributeVisibility.Never;
```

## Core API Patterns

### Setting Validation Errors
`validationError` is a property, not a method:
```typescript
attribute.validationError = "Error message";  // Set
attribute.validationError = null;              // Clear
```

### Setting Values
```typescript
await attribute.setValue(newValue);  // Async method
```

## Key Differences from Attribute Tests

- **No `setupAttribute` helper** - Components create their own setup
- **Direct PersistentObject access** - Get PO via `service.getPersistentObject()`
- **Custom component map** - Track components via `window.componentMap` instead of `attributeMap`
- **Flexible backend** - Configure PersistentObject structure as needed for the component

## Output

Generate both files and provide:
1. Summary of what was generated
2. The component tag name
3. What PersistentObject configuration was created
4. Instructions for running tests: `npm test -- tests/vidyano/{component-name}`

## Notes

- Read the source component to understand its requirements
- Customize the backend Mock_Item class based on what the component needs
- Keep tests framework-agnostic (works for Polymer and Lit)
- Follow existing patterns from `tests/vidyano/`
- Use `as string` type assertion for `getAttribute('id')` to avoid TypeScript null errors
