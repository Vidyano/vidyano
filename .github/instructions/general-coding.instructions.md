
---
applyTo: "*.ts"
---
 
## 1. General Coding Style

* Always use four spaces for indentation.
* Use double quotes for strings.
* Use semicolons at the end of statements.
* Place curly braces on the same line as the control statement (e.g., `if`, `for`, etc.).
* Use blank lines to separate logical blocks of code (e.g., between methods, between import groups, before return statements in longer methods).

## 2. Naming Conventions

* Classes: `PascalCase` (e.g., `PersistentObjectAttributeGroup`, `ServiceObject`).
* Interfaces & Type Aliases: `PascalCase` (e.g., `PersistentObjectAttributeOption`, `KeyValuePair`).
* Methods & Functions: `camelCase` (e.g., `notifyPropertyChanged`, `getValue`).
* Instance Variables (Fields):
  * Private Fields: Use ECMAScript private fields with a hash prefix: `#camelCase` (e.g., `#attributes`, `#serviceValue`).
  * Protected-like Fields (by convention): Use an underscore prefix: `_camelCase` (e.g., `_shouldRefresh`). These are   intended for internal use within the class or by derived classes.
  * Public Fields: `camelCase` (e.g., `index` in `PersistentObjectAttributeGroup`).
* Constants & Enums (if applicable): `UPPER_SNAKE_CASE` (not prominently featured in the provided snippets, but a common standard).
* DTO Namespaces: `PascalCase` for namespaces referring to DTOs (e.g., `Dto.PersistentObjectAttribute`).

  

## 3. Class Design

**Structure Order**
1. Private instance fields (`#field`)
2. Protected-like instance fields (`_field`)
3. Public instance fields
4. Constructor
5. Getters and Setters (for public properties, often wrapping private fields)
6. Public methods
7. Protected-like methods (`_methodName`)
8. Private methods (`#methodName`)

**Constructors:**
* Call `super()` as the first statement if inheriting.
* Initialize all necessary fields.
* Parameters are `camelCase`.

**Private Members (`#`):** Use for true encapsulation where members should not be accessible outside the class.

**Protected-like Members (`_`):** Use an underscore prefix for methods or properties intended for use by derived classes or closely related "friend" classes within the same module/framework (e.g., `_refreshFromResult`, `_toServiceObject`).

**Getters and Setters:**
* Used to control access to private fields and to trigger side effects like `notifyPropertyChanged`.
* Getter names match the conceptual property name (e.g., `get attributes()`).
* Setter names match the conceptual property name (e.g., `set attributes(value)`).

**Readonly Properties:** Use `readonly` keyword for fields that should only be set during initialization (e.g., `readonly #id: string;`).
  
## 4. Comments and Documentation

**JSDoc:** Use JSDoc comments for:
* Classes (`/** ... */`)
* Methods (`/** ... */`)
* Properties (getters/setters) (`/** ... */`)
* Parameters (`@param service - The service instance.`)
* Return values (`@returns A promise resolving to the updated value.`)
* Inheritance documentation (`@inheritdoc`)
* Inline Comments: Use `//` for brief explanations of complex or non-obvious code sections.
* Combined Getter/Setter Documentation:
  * Always keep a property's getter and setter together, with the getter first.
  * When a property has both a getter and a setter, document it with a single JSDoc comment above the getter only.
  * Use the phrase: Gets or sets ... to describe the property.