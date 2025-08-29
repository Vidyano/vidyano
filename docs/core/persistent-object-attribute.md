# Persistent object attributes

## Attribute types

Vidyano exposes attributes in three broad categories. The following sections explain the concepts, then show practical code.

### 1. Standard attributes

Regular data fields such as strings, numbers, dates, and booleans.

```ts
// Examples of standard attribute types
const firstName = person.getAttribute('FirstName');     // String (Required)
const birthDate = person.getAttribute('BirthDate');     // Date (Required)
const isActive = person.getAttribute('IsActive');       // Boolean (Required)
const phoneNumber = person.getAttribute('PhoneNumber'); // String (Required)
const email = person.getAttribute('Email');             // String (Required, IsEmail)
const gender = person.getAttribute('Gender');           // Enum (Required)
```

### 2. Reference attributes (`PersistentObjectAttributeWithReference`)

Many‑to‑one relationships where this object references another object.

```ts
// Example: A Person has a reference to their EmergencyContact (another Person)
const emergencyContactRef = person.getAttribute('EmergencyContact');
if (emergencyContactRef instanceof PersistentObjectAttributeWithReference) {
    console.log(`Referenced person ID: ${emergencyContactRef.objectId}`);
    console.log(`Display value: ${emergencyContactRef.value}`);
}
```

### 3. Detail attributes (`PersistentObjectAttributeAsDetail`)

One‑to‑many relationships where the object owns a collection of child objects.

```ts
// Example: A Person has multiple Languages (PersonLanguage records)
const languagesAttr = person.getAttribute('Languages');
if (languagesAttr instanceof PersistentObjectAttributeAsDetail) {
    console.log(`Number of languages: ${languagesAttr.objects.length}`);
}
```

## Working with standard attributes

### Read values

There are two ways to read values—directly, or by accessing the attribute for metadata.

```ts
// Method 1: Direct value access from Person entity
const firstName = person.getAttributeValue('FirstName');
const email = person.getAttributeValue('Email');
const isActive = person.getAttributeValue('IsActive');
const fullName = person.getAttributeValue('FullName'); // ReadOnly computed field

// Method 2: Get the attribute object for more information
const emailAttr = person.getAttribute('Email');
if (emailAttr) {
    console.log(`Value: ${emailAttr.value}`);
    console.log(`Label: ${emailAttr.label}`);
    console.log(`Type: ${emailAttr.type}`);
    console.log(`Is required: ${emailAttr.isRequired}`);  // true for Email
    console.log(`Is read-only: ${emailAttr.isReadOnly}`);
    console.log(`Rules: ${emailAttr.rules}`);  // "Required;IsEmail"
}
```

### Modify values

Enter edit mode, set values, and save.

```ts
// Get a Person object to edit
const person = await service.getPersistentObject(null, "Person", "1");

// Enter edit mode
person.beginEdit();

// Method 1: Using setAttributeValue with Person attributes
await person.setAttributeValue('FirstName', 'John');
await person.setAttributeValue('LastName', 'Smith');
await person.setAttributeValue('Email', 'john.smith@example.com');
await person.setAttributeValue('IsActive', true);
await person.setAttributeValue('ContactPreference', 'Email');

// Method 2: Direct property assignment
const phoneAttr = person.getAttribute('PhoneNumber');
if (phoneAttr && !phoneAttr.isReadOnly) {
    phoneAttr.value = '+1-555-0123';
}

// Date values - pass Date objects directly
await person.setAttributeValue('BirthDate', new Date('1990-01-01'));

// Save changes
await person.save();
```

### Data type notes

A few examples across common types.

```ts
// String attributes from Person entity
await person.setAttributeValue('FirstName', 'Jane');
await person.setAttributeValue('LastName', 'Doe');
await person.setAttributeValue('Email', 'jane.doe@example.com');
await person.setAttributeValue('PhoneNumber', '+1-555-0123');

// Boolean attributes
await person.setAttributeValue('IsActive', true);

// Date attributes - use Date objects
await person.setAttributeValue('BirthDate', new Date('1985-03-15'));

// Enum attributes from Person model
await person.setAttributeValue('Gender', 'Female');
await person.setAttributeValue('ContactPreference', 'Phone');

// Note: FullName is ReadOnly and computed server-side
// It cannot be set directly
```

### Attribute state

Inspect state and validation on an attribute.

```ts
// Check state on Person attributes
const emailAttr = person.getAttribute('Email');

// Check various states
console.log(`Is read-only: ${emailAttr.isReadOnly}`);        // false
console.log(`Is required: ${emailAttr.isRequired}`);         // true
console.log(`Is visible: ${emailAttr.isVisible}`);
console.log(`Is value changed: ${emailAttr.isValueChanged}`);
console.log(`Rules: ${emailAttr.rules}`);                    // "Required;IsEmail"

// Check validation on the Email field
if (emailAttr.validationError) {
    console.error(`Email validation error: ${emailAttr.validationError}`);
}

// FullName is a special case - it's ReadOnly
const fullNameAttr = person.getAttribute('FullName');
console.log(`FullName is read-only: ${fullNameAttr.isReadOnly}`); // true
```

## Reference attributes (many‑to‑one)

Establish relationships by referencing another object.

### Understand reference attributes

```ts
import { PersistentObjectAttributeWithReference } from '@vidyano/core';

// Get the EmergencyContact reference attribute from Person
const emergencyContactRef = person.getAttribute('EmergencyContact');

if (emergencyContactRef instanceof PersistentObjectAttributeWithReference) {
    // Access reference properties
    console.log(`Referenced person ID: ${emergencyContactRef.objectId}`);
    console.log(`Display value: ${emergencyContactRef.value}`);
    console.log(`Display attribute: ${emergencyContactRef.displayAttribute}`);
    
    // Check capabilities
    console.log(`Can add new: ${emergencyContactRef.canAddNewReference}`);
    console.log(`Select in place: ${emergencyContactRef.selectInPlace}`);
}
```

### Work with lookup queries

Reference attributes expose a lookup query for selection.

```ts
const emergencyContactRef = person.getAttribute('EmergencyContact');

if (emergencyContactRef instanceof PersistentObjectAttributeWithReference) {
    // Access the lookup query for selecting another Person
    const lookupQuery = emergencyContactRef.lookup;
    if (lookupQuery) {
        console.log(`Lookup query: ${lookupQuery.name}`);
        
        // Search for available people
        await lookupQuery.search();
        const items = await lookupQuery.getItemsByIndex(0, 10);
        
        // Display available options
        items.forEach(item => {
            console.log(`Person: ${item.values['FullName']} (ID: ${item.id})`);
        });
    }
}
```

### Change references

```ts
// Method 1: Set EmergencyContact by person ID
await person.setAttributeValue('EmergencyContact', 'person-2');

// Method 2: Using changeReference with query result items
const emergencyContactRef = person.getAttribute('EmergencyContact');
if (emergencyContactRef instanceof PersistentObjectAttributeWithReference) {
    // Get people from lookup query
    const lookupQuery = emergencyContactRef.lookup;
    await lookupQuery.search();
    const firstPerson = await lookupQuery.items.atAsync(0);
    
    // Change the reference - accepts array of QueryResultItem or string IDs
    if (firstPerson) {
        await emergencyContactRef.changeReference([firstPerson]);
    }
}

// Method 3: Clear a reference by passing empty array
await emergencyContactRef.changeReference([]);
// Or use setAttributeValue with null
await person.setAttributeValue('EmergencyContact', null);
```

### Add new references

Some references allow creating a new target on the fly.

```ts
const emergencyContactRef = person.getAttribute('EmergencyContact');

if (emergencyContactRef instanceof PersistentObjectAttributeWithReference) {
    if (emergencyContactRef.canAddNewReference) {
        // Add a new EmergencyContact reference
        // This will cause service.hooks.onOpen to be called with the new persistent object
        await emergencyContactRef.addNewReference();
    }
}
```

### Reference options

A reference can also have predefined options instead of a lookup.

```ts
// Some reference attributes may have predefined options
// For Person, Gender and ContactPreference are enums with options
const genderAttr = person.getAttribute('Gender');

if (genderAttr.options && genderAttr.options.length > 0) {
    console.log('Available gender options:');
    genderAttr.options.forEach(option => {
        console.log(`  ${option}`);
    });
    
    // Set to one of the options
    await person.setAttributeValue('Gender', 'Male');
}

// ContactPreference is another enum with options
await person.setAttributeValue('ContactPreference', 'Email');
```

## Detail attributes (one‑to‑many)

Represent collections of child objects that belong to the parent.

### Understand detail attributes

```ts
import { PersistentObjectAttributeAsDetail } from '@vidyano/core';

// Get the Languages detail attribute from Person
const languagesAttr = person.getAttribute('Languages');

if (languagesAttr instanceof PersistentObjectAttributeAsDetail) {
    // Access the child PersonLanguage objects
    const languages = languagesAttr.objects;
    console.log(`Person knows ${languages.length} languages`);
    
    // Iterate through PersonLanguage records
    languages.forEach((language, index) => {
        console.log(`Language ${index + 1}:`);
        console.log(`  Language: ${language.getAttributeValue('Language')}`);
        console.log(`  Proficiency: ${language.getAttributeValue('ProficiencyLevel')}`);
        console.log(`  Is Native: ${language.getAttributeValue('IsNative')}`);
        console.log(`  Can Speak: ${language.getAttributeValue('CanSpeak')}`);
    });
}
```

### Work with detail objects

```ts
const languagesAttr = person.getAttribute('Languages');

if (languagesAttr instanceof PersistentObjectAttributeAsDetail) {
    // Access individual PersonLanguage objects
    const languages = languagesAttr.objects;
    
    // Parent must be in edit mode to modify detail objects
    person.beginEdit();
    // When parent enters edit mode, all detail objects automatically enter edit mode too
    
    if (languages.length > 0) {
        const firstLanguage = languages[0];
        // Detail objects are automatically in edit mode when parent is editing
        await firstLanguage.setAttributeValue('Language', 'English');
        await firstLanguage.setAttributeValue('ProficiencyLevel', 'Fluent');
        await firstLanguage.setAttributeValue('CanSpeak', true);
        await firstLanguage.setAttributeValue('CanRead', true);
        await firstLanguage.setAttributeValue('CanWrite', true);
        await firstLanguage.setAttributeValue('YearsStudied', 10);
    }
    
    // Save parent saves all detail changes
    await person.save();
}
```

### Add new detail objects

```ts
const languagesAttr = person.getAttribute('Languages');

if (languagesAttr instanceof PersistentObjectAttributeAsDetail) {
    // Create a new PersonLanguage detail object
    // This uses the "New" action from the details query
    const newLanguage = await languagesAttr.newObject();
    
    if (newLanguage) {
        // The parent must be in edit mode for detail objects
        if (!person.isEditing)
            person.beginEdit();
            
        // Set values on the new PersonLanguage record
        await newLanguage.setAttributeValue('Language', 'Spanish');
        await newLanguage.setAttributeValue('ProficiencyLevel', 'Intermediate');
        await newLanguage.setAttributeValue('CanSpeak', true);
        await newLanguage.setAttributeValue('CanRead', true);
        await newLanguage.setAttributeValue('CanWrite', false);
        await newLanguage.setAttributeValue('IsNative', false);
        await newLanguage.setAttributeValue('YearsStudied', 3);
        
        // Add to the objects collection
        languagesAttr.objects.push(newLanguage);
        
        // Mark as changed to trigger parent dirty state
        languagesAttr.isValueChanged = true;
        person.triggerDirty();
        
        console.log(`Person now knows ${languagesAttr.objects.length} languages`);
    }
}
```

### Work with detail queries

Manage the collection via an associated detail query.

```ts
// Languages is an AsDetail attribute with a details query
const languagesAttr = person.getAttribute('Languages');

if (languagesAttr instanceof PersistentObjectAttributeAsDetail) {
    // Access the detail query
    const detailQuery = languagesAttr.details;
    
    if (detailQuery) {
        console.log(`Detail query: ${detailQuery.name}`);
        
        // The query has actions like New, Delete, etc.
        // newObject() internally uses the "New" action from this query
        const newAction = detailQuery.actions["New"];
        if (newAction) {
            // languagesAttr.newObject() is the preferred way
            // It handles the execution and setup automatically
            const newLanguage = await languagesAttr.newObject();
        }
    }
}
```

### Edit behavior

Detail objects follow their parent’s edit state.

```ts
const languagesAttr = person.getAttribute('Languages');

// When parent enters edit mode, all detail objects automatically enter edit mode
person.beginEdit();
// All PersonLanguage objects in languagesAttr.objects are now in edit mode

// When parent saves, all detail changes are saved together
await person.save();
// All language changes are committed with the parent

// When parent cancels edit, all detail changes are reverted
person.cancelEdit();
// All language changes are discarded

// Note: Detail objects follow their parent's edit state automatically
// This is handled by the PersistentObjectAttributeAsDetail constructor
```

## Attribute metadata and properties

### Core properties

Every attribute exposes identity, behavior flags, state, and positioning info.

```ts
const attr = person.getAttribute('Email');

// Identity and structure
console.log(`ID: ${attr.id}`);
console.log(`Name: ${attr.name}`);
console.log(`Type: ${attr.type}`);
console.log(`Label: ${attr.label}`);

// Behavior flags
console.log(`Is read-only: ${attr.isReadOnly}`);
console.log(`Is required: ${attr.isRequired}`);
console.log(`Is visible: ${attr.isVisible}`);
console.log(`Is system: ${attr.isSystem}`);
console.log(`Is sensitive: ${attr.isSensitive}`);

// State
console.log(`Is value changed: ${attr.isValueChanged}`);
console.log(`Validation error: ${attr.validationError}`);

// UI positioning
console.log(`Group: ${attr.group?.label}`);
console.log(`Tab: ${attr.tab?.label}`);
console.log(`Column: ${attr.column}`);
console.log(`Column span: ${attr.columnSpan}`);
console.log(`Offset: ${attr.offset}`);
```

### Display values

Attributes maintain both raw and display values.

```ts
const birthDateAttr = person.getAttribute('BirthDate');

// Raw value (Date object)
const rawDate = birthDateAttr.value;
console.log(`Raw value: ${rawDate}`); // Date object

// Display value (formatted string)
const displayDate = birthDateAttr.displayValue;
console.log(`Display value: ${displayDate}`); // e.g., "March 15, 1985"

// For reference attributes
const managerRef = person.getAttribute('Manager');
console.log(`Object ID: ${managerRef.objectId}`); // e.g., "emp-456"
console.log(`Display: ${managerRef.value}`); // e.g., "John Smith"
```

## Validation and errors

### Handle validation errors

Validation happens server‑side during save.

```ts
// Get a Person object
const person = await service.getPersistentObject(null, "Person", "1");
person.beginEdit();

// Set an invalid email (violates IsEmail rule)
await person.setAttributeValue('Email', 'invalid-email');

// Try to clear a required field
await person.setAttributeValue('FirstName', null);

try {
    await person.save();
} catch (error) {
    // Check attribute-level validation errors
    const emailAttr = person.getAttribute('Email');
    if (emailAttr.validationError) {
        console.error(`Email validation failed: ${emailAttr.validationError}`);
    }
    
    const firstNameAttr = person.getAttribute('FirstName');
    if (firstNameAttr.validationError) {
        console.error(`FirstName validation failed: ${firstNameAttr.validationError}`);
    }
    
    // Check all attributes for errors
    person.attributes.forEach(attr => {
        if (attr.validationError) {
            console.error(`${attr.label}: ${attr.validationError}`);
        }
    });
    
    // Check object-level notification
    if (person.notification) {
        console.log(`${person.notificationType}: ${person.notification}`);
    }
}
```

### Validation rules

Rules are defined server‑side and surfaced on the attribute.

```ts
// Check validation rules on Person attributes
const emailAttr = person.getAttribute('Email');
console.log(`Email rules: ${emailAttr.rules}`);  // "Required;IsEmail"

const firstNameAttr = person.getAttribute('FirstName');
console.log(`FirstName rules: ${firstNameAttr.rules}`);  // "Required"

const phoneNumberAttr = person.getAttribute('PhoneNumber');
console.log(`PhoneNumber rules: ${phoneNumberAttr.rules}`);  // "Required"
```

## Refresh and dependencies

### Attributes that trigger refresh

Attributes with the `triggersRefresh` flag enabled trigger a server-side callback when changed. This allows the server to update dependent attributes based on business logic.

```ts
// Example: Checking for attributes that trigger server-side calculations
const contactPreferenceAttr = person.getAttribute('ContactPreference');
if (contactPreferenceAttr?.triggersRefresh) {
    // This attribute will trigger a server refresh when changed
    await person.setAttributeValue('ContactPreference', 'Phone');
    // After refresh, dependent attributes would be updated
}

// The allowRefresh parameter (defaults to true)
// Use this with caution, as setting it to false can lead to inconsistent state if the backend
// expects to update other attributes based on this change
await person.setAttributeValue('ContactPreference', 'Phone', false); // Explicitly prevents refresh

// Note: Direct property assignment uses default allowRefresh = true
if (contactPreferenceAttr) {
    contactPreferenceAttr.value = 'Phone'; // Equivalent to setValue('Phone', true)
}
```

### Manual refresh

```ts
// Manual refresh can be triggered for any attribute
await person.triggerAttributeRefresh(person.getAttribute('ContactPreference'));

// This sends the current values to the server and updates
// any dependent attributes based on business logic
const fullNameAttr = person.getAttribute('FullName');
await person.triggerAttributeRefresh(fullNameAttr);
```

### Handle pending refreshes

```ts
// If refresh was deferred, you can check if it's needed
const attr = person.getAttribute('ContactPreference');
if (attr._shouldRefresh) {
    // A refresh is pending for this attribute
    await person.triggerAttributeRefresh(attr);
}
```

## Type hints and options

### Type hints

Use type hints to pass extra metadata for UI and validation.

```ts
// Type hints provide metadata for UI and validation
const emailAttr = person.getAttribute('Email');
const phoneAttr = person.getAttribute('PhoneNumber');

// Get a specific type hint
const emailInputType = emailAttr.getTypeHint('inputtype', 'email');
console.log(`Email input type: ${emailInputType}`);

const phoneInputType = phoneAttr.getTypeHint('inputtype', 'tel');
console.log(`Phone input type: ${phoneInputType}`);

// Common type hints in Person model:
// - inputtype: HTML input type (email for Email field, tel for PhoneNumber)
// - maxlength: Maximum string length
// - placeholder: Placeholder text for input fields
```

### Attribute options

Some attributes expose predefined options.

```ts
// Person has enum attributes with predefined options
const genderAttr = person.getAttribute('Gender');
const contactPrefAttr = person.getAttribute('ContactPreference');

// Check Gender options
if (genderAttr.options && genderAttr.options.length > 0) {
    console.log('Available gender options:');
    genderAttr.options.forEach(option => {
        console.log(`  ${option}`);
    });
    
    // Set to one of the options
    await person.setAttributeValue('Gender', 'Female');
}

// Check ContactPreference options
if (contactPrefAttr.options && contactPrefAttr.options.length > 0) {
    console.log('Contact preference options:');
    contactPrefAttr.options.forEach(option => {
        console.log(`  ${option}`);
    });
    
    // Set preference
    await person.setAttributeValue('ContactPreference', 'Email');
}
```

## Event handling

### Monitor attribute changes

```ts
// Monitor a specific attribute
const emailAttr = person.getAttribute('Email');
const disposer = emailAttr.propertyChanged.attach((sender, args) => {
    switch (args.propertyName) {
        case 'value':
            console.log(`Email changed to: ${emailAttr.value}`);
            break;
        case 'validationError':
            if (emailAttr.validationError) {
                console.error(`Validation error: ${emailAttr.validationError}`);
            }
            break;
        case 'isReadOnly':
            console.log(`Read-only state changed to: ${emailAttr.isReadOnly}`);
            break;
    }
});

// Clean up when done
disposer();
```

### Monitor all attributes

```ts
// Monitor all attribute changes on a persistent object
const disposers = person.attributes.map(attr =>
    attr.propertyChanged.attach((sender, args) => {
        if (args.propertyName === 'value') {
            console.log(`${attr.label} changed from ${args.oldValue} to ${args.newValue}`);
        }
    })
);

// Clean up all listeners
disposers.forEach(d => d());
```

### React to detail changes

```ts
const addressesAttr = person.getAttribute('Addresses');

if (addressesAttr instanceof PersistentObjectAttributeAsDetail) {
    // Monitor when objects are added/removed
    const disposer = addressesAttr.propertyChanged.attach((sender, args) => {
        if (args.propertyName === 'objects') {
            const oldCount = args.oldValue?.length || 0;
            const newCount = args.newValue?.length || 0;
            console.log(`Address count changed from ${oldCount} to ${newCount}`);
        }
    });
}
```

## Related topics

* [Persistent Object](./persistent-object.md)
* [Query](./query.md)
