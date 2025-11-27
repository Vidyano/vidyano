# Generate Unit Tests for Persistent Object Attribute

You are tasked with generating comprehensive unit tests for a Vidyano persistent object attribute component.

## Input
The user will provide a TypeScript file path to the component to test, for example:
```
src/vidyano/web-components/persistent-object-attribute/attributes/persistent-object-attribute-string/persistent-object-attribute-string.ts
```

## Your Task

1. **Parse the Component Information**
   - Extract component name from the file path (e.g., `persistent-object-attribute-string`)
   - Determine the component tag (e.g., `vi-persistent-object-attribute-string`)
   - Infer the attribute type from the component name (e.g., `String`, `Boolean`, `Date`, etc.)

2. **Read the Source Component**
   - Read the TypeScript source file to understand:
     - What elements it renders in non-edit mode (span, div, etc.)
     - What input elements it uses in edit mode (input, textarea, vi-toggle, etc.)
     - Any special attributes or properties the input elements have
     - Any custom sub-components used

3. **Determine Attribute Type and Test Data**
   Based on the component name, infer the .NET type and appropriate test data:

   **String Types:**
   - `String` → `string` → "Test"
   - `MultiLineString` → `string` → "Test line 1\nTest line 2"
   - `MultiString` → `string` → "Test line 1\nTest line 2"
   - `Password` → `string` → "S3cr3T"
   - `CommonMark` → `string` → "**Hello world!**"

   **Numeric Types:**
   - `Byte` → `Byte` → 128
   - `Decimal` → `Decimal` → 1234567890123.456789M
   - `Double` → `Double` → 1234567890123.456789
   - `Single` → `Single` → 123456.7F
   - `Int16` → `Int16` → Int16.MinValue
   - `Int32` → `Int32` → Int32.MinValue
   - `Int64` → `Int64` → -1234567890123456789
   - `SByte` → `SByte` → 127
   - `UInt16` → `UInt16` → UInt16.MaxValue
   - `UInt32` → `UInt32` → UInt32.MaxValue
   - `UInt64` → `UInt64` → 1234567890123456789UL

   **Boolean Types:**
   - `Boolean` → `bool` → true
   - `YesNo` → `bool` → true
   - `NullableBoolean` → `bool?` → null

   **Date/Time Types:**
   - `Date` → `DateTime` → DateTime.Today
   - `DateTime` → `DateTime` → DateTime.Now
   - `DateTimeOffset` → `DateTimeOffset` → DateTimeOffset.Now
   - `Time` → `TimeSpan` → DateTime.Now.TimeOfDay
   - `NullableDate` → `DateTime?` → null
   - `NullableDateTime` → `DateTime?` → null
   - `NullableDateTimeOffset` → `DateTimeOffset?` → null
   - `NullableTime` → `TimeSpan?` → null

   **Reference Types:**
   - `Reference` → `Person` → Context.People.First()
   - `User` → `Guid` → Manager.Current.GetUser("Admin")!.Id
   - `Group` → `Guid` → Manager.Current.GetGroup("Administrators")!.Id

   **Selection Types:**
   - `KeyValueList` → `int` → 1
   - `ComboBox` → `string` → "Bla"
   - `DropDown` → `string` → "Monday"
   - `Enum` → `DayOfWeek` → DayOfWeek.Monday
   - `FlagsEnum` → `AttributeVisibility` → AttributeVisibility.Always

   **Binary Types:**
   - `Image` → `byte[]` → image (from base64)
   - `BinaryFile` → `string` → "Vidyano.png|{base64data}"

4. **Generate Test Spec File**
   Create `tests/vidyano/attributes/{component-name}/{component-name}.spec.ts` with:

   - Import statements (Playwright + _helper utilities)
   - Outer `test.describe.serial()` wrapper
   - Shared backend lifecycle (beforeAll/afterAll)
   - Test suite structure with nested describes for different scenarios:

     **Standard Test Suites (always include):**
     - Non-edit mode tests
       - Display initial value
       - Verify no input elements rendered
     - Edit mode tests
       - Display input with initial value after beginEdit
       - Update value through user interaction
       - Handle frozen/unfrozen states
     - Save and Cancel tests
       - Return to non-edit with new value after save
       - Return to non-edit with original value after cancel
     - ReadOnly variant tests
       - Display disabled input when readonly
     - Required variant tests (if applicable)
       - Show validation error when empty

     **Type-Specific Tests:**
     - Boolean: Test both toggle and checkbox variants
     - String: Test text transforms (upper/lower if applicable)
     - Numeric: Test min/max bounds, decimal places
     - Date/Time: Test date picker interactions, format display
     - Reference: Test lookup dialog, selection behavior
     - Dropdown/Enum: Test option selection, list display

   Use the existing test files as templates:
   - `tests/vidyano/attributes/persistent-object-attribute-boolean/persistent-object-attribute-boolean.spec.ts`
   - `tests/vidyano/attributes/persistent-object-attribute-string/persistent-object-attribute-string.spec.ts`

5. **Generate Backend Test File**
   Create `tests/vidyano/attributes/{component-name}/{component-name}.cs` with:

   ```csharp
   #:sdk Microsoft.NET.Sdk.Web
   #:property PublishAot=false
   #:package Vidyano@6.0.*

   using Vidyano.Service;
   using Vidyano.Service.Repository;

   var builder = WebApplication.CreateBuilder(args);

   builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
       .WithUrls("http://localhost:44355")
       .WithDefaultAdmin()
       .WithSchemaRights()
       .WithMenuItem(nameof(MockContext.Attributes))
       .WithModel(builder =>
       {
           var po = builder.GetOrCreatePersistentObject($"Mock.{nameof(Mock_Attribute)}");

           // Configure ReadOnly variant
           var readOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.{Type}ReadOnly));
           readOnly.IsReadOnly = true;

           // Configure Required variant (if applicable)
           var required = po.GetOrCreateAttribute(nameof(Mock_Attribute.{Type}Required));
           required.AddRule("Required");
       })
   );

   var app = builder.Build();
   app.UseVidyano(app.Environment, app.Configuration);
   app.Run();

   public class MockContext : NullTargetContext
   {
       private static readonly List<Mock_Attribute> attributes = [];

       public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

       public static Mock_Attribute GetOrCreateAttribute(string objectId)
       {
           lock (attributes)
           {
               var attr = attributes.FirstOrDefault(a => a.Id == objectId);
               if (attr == null)
               {
                   attr = new Mock_Attribute { Id = objectId, {Type} = {initialValue} };
                   attributes.Add(attr);
               }
               return attr;
           }
       }
   }

   public class Mock_Attribute
   {
       public string Id { get; set; } = null!;
       public {dotNetType} {Type} { get; set; }
       public {dotNetType} {Type}ReadOnly { get; set; }
       public {dotNetType} {Type}Required { get; set; }
   }
   ```

   Replace `{Type}`, `{dotNetType}`, and `{initialValue}` based on the attribute type.

6. **Framework-Agnostic Tests**
   - Tests must work for both Polymer and Lit components
   - Use standard DOM queries (locator('input'), locator('span'), etc.)
   - Avoid framework-specific APIs
   - Test behavior, not implementation details
   - **Important:** Polymer's `dom-if` doesn't remove DOM elements when the condition becomes false - it adds a `hidden` attribute that sets `display: none`. Lit's conditional rendering actually adds/removes elements from the DOM. When testing visibility:
     - Use `.toBeVisible()` / `.toBeHidden()` to test visibility (works for both)
     - Avoid `.toHaveCount(0)` for hidden elements (will fail in Polymer)
     - The element should be functionally invisible in both cases

7. **Test Patterns to Follow**
   - Use `setupAttribute()` to create component instances
   - Use `beginEdit()`, `cancelEdit()`, `save()` helpers for lifecycle
   - Use `freeze()`, `unfreeze()` helpers for frozen state
   - Each test gets a fresh component instance
   - Use Playwright assertions (`expect(locator).toHaveText()`, etc.)
   - Group related tests in `test.describe()` blocks
   - Share page instances per scenario (not per test)

## Output

Generate both files and save them to the appropriate locations in the `tests/vidyano/attributes/` directory.

After generating the files, provide:
1. A summary of what was generated
2. The component tag name used
3. The attribute type inferred
4. The test scenarios included
5. Instructions for running the tests: `npm test -- tests/vidyano/attributes/{component-name}`

## Important Notes
- Read the source component carefully to understand its structure
- Match the DOM element queries to what the component actually renders
- Use appropriate test values for the attribute type
- Follow existing test patterns from `tests/vidyano/attributes/`
- Ensure tests are comprehensive but not redundant
- Keep tests framework-agnostic
