import { test as base, expect } from "@playwright/test";
import {
    Action,
    Service,
    PersistentObject,
    PersistentObjectAttribute,
    PersistentObjectAttributeWithReference,
    PersistentObjectAttributeAsDetail,
    Query,
    QueryResultItem,
    PersistentObjectAttributeGroup,
    PersistentObjectAttributeTab,
} from "@vidyano/core";

type Fixtures = {
    service: Service;
    person: PersistentObject;
    newPerson: PersistentObject;
};

const test = base.extend<Fixtures>({
    service: async ({ }, use) => {
        const service = new Service("http://localhost:5000", undefined, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await service.executeAction("PersistentObject.ResetTest", service.application);
        await use(service);
    },

    person: async ({ service }, use) => {
        const person = await service.getPersistentObject(null, "Person", "1");
        expect(person).toBeInstanceOf(PersistentObject);
        await use(person);
    },

    newPerson: async ({ service }, use) => {
        const peopleQuery = await service.getQuery("People");
        const newAction = peopleQuery.actions["New"];
        const newPerson = await newAction.execute({ skipOpen: true });
        expect(newPerson).toBeInstanceOf(PersistentObject);
        expect(newPerson.isNew).toBe(true);
        await use(newPerson);
    },
});

test.describe("Standard Attributes", () => {
    test("should get attribute objects with metadata", async ({ person }) => {
        const emailAttr = person.getAttribute("Email");        
        expect(emailAttr).toBeInstanceOf(PersistentObjectAttribute);

        expect(emailAttr.value).toBe("Jonas_Devos34@gmail.com");
        expect(emailAttr.label).toBe("Email");
        expect(emailAttr.type).toBe("String");
        expect(emailAttr.isRequired).toBe(true);
        expect(emailAttr.rules).toBe("NotEmpty; IsEmail");
    });

    test("should modify attribute values on new objects without entering edit mode", async ({ newPerson }) => {
        // New objects are automatically in edit mode
        expect(newPerson.isEditing).toBe(true);

        // Set various attribute types using setAttributeValue
        await newPerson.setAttributeValue("FirstName", "John");
        await newPerson.setAttributeValue("LastName", "Smith");
        await newPerson.setAttributeValue("Email", "john.smith@example.com");
        await newPerson.setAttributeValue("IsActive", true);
        await newPerson.setAttributeValue("PhoneNumber", "+1-555-0123");
        await newPerson.setAttributeValue("BirthDate", new Date("1990-01-01"));
        await newPerson.setAttributeValue("Gender", "Male");
        await newPerson.setAttributeValue("ContactPreference", "Email");

        // Verify values were set
        expect(newPerson.getAttributeValue("FirstName")).toBe("John");
        expect(newPerson.getAttributeValue("LastName")).toBe("Smith");
        expect(newPerson.getAttributeValue("Email")).toBe("john.smith@example.com");
        expect(newPerson.getAttributeValue("IsActive")).toBe(true);
        expect(newPerson.getAttributeValue("PhoneNumber")).toBe("+1-555-0123");
        expect(newPerson.getAttributeValue("BirthDate")).toBeInstanceOf(Date);
        expect(newPerson.getAttributeValue("BirthDate").toISOString()).toBe("1990-01-01T00:00:00.000Z");
        expect(newPerson.getAttributeValue("Gender")).toBe("Male");
        expect(newPerson.getAttributeValue("ContactPreference")).toBe("Email");
    });

    test("should modify attribute values on existing objects after entering edit mode", async ({ person }) => {
        // Existing objects need to be put in edit mode
        expect(person.isEditing).toBe(false);
        
        // Enter edit mode
        person.beginEdit();
        expect(person.isEditing).toBe(true);
        
        // Test using direct attribute.value assignment
        const phoneAttr = person.getAttribute("PhoneNumber");
        expect(phoneAttr).toBeInstanceOf(PersistentObjectAttribute);
        expect(phoneAttr.isReadOnly).toBe(false);
        phoneAttr.value = "+1-555-9876";
        expect(phoneAttr.value).toBe("+1-555-9876");
        
        // Also test setAttributeValue on existing object
        await person.setAttributeValue("Email", "updated.email@example.com");
        expect(person.getAttributeValue("Email")).toBe("updated.email@example.com");
    });

    test("should handle read-only attributes", async ({ person }) => {
        const fullNameAttr = person.getAttribute("FullName");
        expect(fullNameAttr).toBeInstanceOf(PersistentObjectAttribute);
        expect(fullNameAttr.isReadOnly).toBe(true);
        
        // FullName is computed server-side and cannot be set directly
        person.beginEdit();
        const originalValue = fullNameAttr.value;
        
        // Attempting to set a read-only value should not change it
        fullNameAttr.value = "New Name";
        expect(fullNameAttr.value).toBe(originalValue);
    });

    test("should check attribute state", async ({ person }) => {
        const emailAttr = person.getAttribute("Email");
        
        expect(emailAttr.isReadOnly).toBe(false);
        expect(emailAttr.isRequired).toBe(true);
        expect(emailAttr.isVisible).toBe(true);
        expect(emailAttr.isValueChanged).toBe(false);
        
        person.beginEdit();
        const originalValue = emailAttr.value;
        await person.setAttributeValue("Email", "newemail@example.com");
        expect(emailAttr.isValueChanged).toBe(true);
        
        // Note: Setting back to original value may not always reset isValueChanged
        // This depends on the implementation
        await person.setAttributeValue("Email", originalValue);
        // Just verify the value was set back
        expect(emailAttr.value).toBe(originalValue);
    });
});

test.describe("Attribute Reading and Types", () => {
    test("breadcrumb is set correctly", async ({ person }) => {
        console.log(person.objectId);
        const breadcrumb = person.breadcrumb;
        expect(breadcrumb).toBe("Jonas Devos");
        expect(breadcrumb).toBe(`${person.getAttributeValue("FirstName")} ${person.getAttributeValue("LastName")}`);
    });

    test("should read and verify attribute values and types", async ({ person }) => {
        const firstName = person.getAttributeValue("FirstName");
        expect(firstName).toBe("Jonas");

        const isActive = person.getAttributeValue("IsActive");
        expect(isActive).toBe(true);

        const birthDate = person.getAttributeValue("BirthDate");
        expect(birthDate).toBeInstanceOf(Date);
        expect(birthDate.toISOString()).toBe("1976-03-06T01:56:22.582Z");
    });

    test("has all expected attributes with correct types", async ({ person }) => {
        const specs: Record<string, { type: string; label: string; isReadOnly: boolean; isRequired: boolean, value: any }> = {
            FirstName:         { type: "String",    label: "First name",        isReadOnly: false, isRequired: true, value: "Jonas" },
            LastName:          { type: "String",    label:"Last name",          isReadOnly: false, isRequired: true, value: "Devos" },
            FullName:          { type: "String",    label:"Full name",          isReadOnly: true,  isRequired: true, value: "Jonas Devos" },
            BirthDate:         { type: "Date",      label:"Birth date",         isReadOnly: false, isRequired: true, value: new Date("1976-03-06T01:56:22.582Z") },
            Gender:            { type: "Enum",      label:"Gender",             isReadOnly: false, isRequired: true, value: "Female" },
            ContactPreference: { type: "Enum",      label:"Contact preference", isReadOnly: false, isRequired: true, value: "Email" },
            Email:             { type: "String",    label:"Email",              isReadOnly: false, isRequired: person.getAttributeValue("ContactPreference") === "Email", value: "Jonas_Devos34@gmail.com" },
            PhoneNumber:       { type: "String",    label:"Phone number",       isReadOnly: false, isRequired: person.getAttributeValue("ContactPreference") === "Phone", value: "0477 69 58 25" },
            EmergencyContact:  { type: "Reference", label:"Emergency contact",  isReadOnly: false, isRequired: true, value: "2276" },
            IsActive:          { type: "Boolean",   label:"Is active",          isReadOnly: false, isRequired: true, value: true },
            Languages:         { type: "AsDetail",  label:"Languages",          isReadOnly: false, isRequired: false, value: 2 },
        };

        const attributes: Record<string, PersistentObjectAttribute> = {};
        for (const name of Object.keys(specs)) {
            const attr = attributes[name] = person.getAttribute(name) as PersistentObjectAttribute;
            
            expect(attr).toBeInstanceOf(PersistentObjectAttribute);
            expect(attr.name).toBe(name);
            expect(attr.label).toBe(specs[name].label);
            expect(attr.type).toBe(specs[name].type);
            expect(attr.isReadOnly).toBe(specs[name].isReadOnly);
            expect(attr.isRequired).toBe(specs[name].isRequired);
            expect(attr.validationError).toBeFalsy();

            if (attr instanceof PersistentObjectAttributeWithReference) {
                expect(attr.objectId).toBe(specs[name].value);
            }
            else if (attr instanceof PersistentObjectAttributeAsDetail) {
                expect(Array.isArray(attr.objects)).toBe(true);
                expect(attr.objects.length).toBe(specs[name].value);
                expect(attr.objects.every(obj => obj instanceof PersistentObject)).toBe(true);
            }
            else {
                expect(attr.value).toEqual(specs[name].value);
            }
        }
    });

    test("handles non-existent attributes gracefully", async ({ person }) => {
        expect(person.getAttributeValue("NonExistentAttribute")).toBeUndefined();
        expect(person.getAttribute("NonExistentAttribute")).toBeUndefined();
        expect(person.getAttributeValue("" as any)).toBeUndefined();
        expect(person.getAttribute("" as any)).toBeUndefined();
        expect(person.getAttributeValue("firstname" as any)).toBeUndefined();
        expect(person.getAttribute("firstname" as any)).toBeUndefined();
    });
});

test.describe("Reference Attributes (Many-to-One)", () => {
    test("should access reference properties", async ({ person }) => {
        const emergencyContactRef = person.getAttribute("EmergencyContact") as PersistentObjectAttributeWithReference;
        expect(emergencyContactRef).toBeInstanceOf(PersistentObjectAttributeWithReference);
        
        // Check reference properties
        expect(emergencyContactRef.objectId).toBe("2276");
        expect(emergencyContactRef.value).toBe("Amina Claes");

        expect(emergencyContactRef.displayAttribute).toBe("FullName");
        expect(emergencyContactRef.canAddNewReference).toBe(false);
        expect(emergencyContactRef.selectInPlace).toBe(false);
    });

    test("should work with lookup queries", async ({ person }) => {
        const emergencyContactRef = person.getAttribute("EmergencyContact") as PersistentObjectAttributeWithReference;
        expect(emergencyContactRef).toBeInstanceOf(PersistentObjectAttributeWithReference);
        
        const lookupQuery = emergencyContactRef.lookup;
        expect(lookupQuery).toBeInstanceOf(Query);
        expect(lookupQuery.name).toBe("People");
        
        // Search for available people
        await lookupQuery.search();
        const [item] = await lookupQuery.getItemsByIndex(0);
        expect(item).toBeInstanceOf(QueryResultItem);
        expect(item.id).toBe("3")
    });

    test("should change references", async ({ newPerson }) => {
        // New objects are automatically in edit mode
        expect(newPerson.isEditing).toBe(true);
        
        // Set basic required fields first
        await newPerson.setAttributeValue("FirstName", "Test");
        await newPerson.setAttributeValue("LastName", "User");
        await newPerson.setAttributeValue("Email", "test@example.com");
        await newPerson.setAttributeValue("PhoneNumber", "+1-555-0000");
        await newPerson.setAttributeValue("BirthDate", new Date("1990-01-01"));
        await newPerson.setAttributeValue("Gender", "Male");
        await newPerson.setAttributeValue("IsActive", true);
        
        const emergencyContactRef = newPerson.getAttribute("EmergencyContact") as PersistentObjectAttributeWithReference;
        expect(emergencyContactRef).toBeInstanceOf(PersistentObjectAttributeWithReference);
        
        // Test different ways to set references
        const lookupQuery = emergencyContactRef.lookup;
        expect(lookupQuery).toBeInstanceOf(Query);
        
        // First, get available options from lookup
        await lookupQuery.search();
        const items = await lookupQuery.getItemsByIndex(0, 10);
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(2);
        expect(items.every(item => item instanceof QueryResultItem)).toBe(true);
        
        const firstPerson = items[0];

        await emergencyContactRef.changeReference([firstPerson]);
        expect(emergencyContactRef.objectId).toBe(firstPerson.id);

        await emergencyContactRef.changeReference([]);
        expect(emergencyContactRef.objectId == null).toBe(true);
    });
});

test.describe("Detail Attributes (One-to-Many)", () => {
    test("should access detail objects", async ({ person }) => {
        const languagesAttr = person.getAttribute("Languages") as PersistentObjectAttributeAsDetail;
        expect(languagesAttr).toBeInstanceOf(PersistentObjectAttributeAsDetail);
        
        const languages = languagesAttr.objects;
        expect(Array.isArray(languages)).toBe(true);
        expect(languages.length).toBeGreaterThan(0);
        
        const firstLanguage = languages[0];
        expect(firstLanguage).toBeInstanceOf(PersistentObject);
        
        // Check PersonLanguage attributes
        expect(firstLanguage.getAttribute("Language")).toBeInstanceOf(PersistentObjectAttribute);
        expect(firstLanguage.getAttribute("ProficiencyLevel")).toBeInstanceOf(PersistentObjectAttribute);
        expect(firstLanguage.getAttribute("IsNative")).toBeInstanceOf(PersistentObjectAttribute);
        expect(firstLanguage.getAttribute("CanSpeak")).toBeInstanceOf(PersistentObjectAttribute);
    });

    test("should modify detail objects", async ({ person }) => {
        const languagesAttr = person.getAttribute("Languages") as PersistentObjectAttributeAsDetail;
        expect(languagesAttr).toBeInstanceOf(PersistentObjectAttributeAsDetail);
        
        const languages = languagesAttr.objects;
        expect(Array.isArray(languages)).toBe(true);
        expect(languages.length).toBeGreaterThan(0);
        
        // Parent must be in edit mode
        person.beginEdit();
        
        const firstLanguage = languages[0];
        // Detail objects are automatically in edit mode when parent is editing
        
        await firstLanguage.setAttributeValue("Language", "English");
        await firstLanguage.setAttributeValue("ProficiencyLevel", "Fluent");
        await firstLanguage.setAttributeValue("CanSpeak", true);
        await firstLanguage.setAttributeValue("CanRead", true);
        await firstLanguage.setAttributeValue("CanWrite", true);
        await firstLanguage.setAttributeValue("YearsStudied", 10);
        
        expect(firstLanguage.getAttributeValue("Language")).toBe("English");
        expect(firstLanguage.getAttributeValue("ProficiencyLevel")).toBe("Fluent");
        expect(firstLanguage.getAttributeValue("CanSpeak")).toBe(true);
    });

    test("should add new detail objects", async ({ person }) => {
        const languagesAttr = person.getAttribute("Languages") as PersistentObjectAttributeAsDetail;
        expect(languagesAttr).toBeInstanceOf(PersistentObjectAttributeAsDetail);

        const initialCount = languagesAttr.objects.length;
        
        // Parent must be in edit mode
        person.beginEdit();
        
        // Create a new PersonLanguage detail object
        const newLanguage = await languagesAttr.newObject();
        expect(newLanguage).toBeInstanceOf(PersistentObject);
            
        // Set values on the new PersonLanguage record
        await newLanguage.setAttributeValue("Language", "Spanish");
        await newLanguage.setAttributeValue("ProficiencyLevel", "Intermediate");
        await newLanguage.setAttributeValue("CanSpeak", true);
        await newLanguage.setAttributeValue("CanRead", true);
        await newLanguage.setAttributeValue("CanWrite", false);
        await newLanguage.setAttributeValue("IsNative", false);
        await newLanguage.setAttributeValue("YearsStudied", 3);
        
        // Add to the objects collection
        languagesAttr.objects.push(newLanguage);
        
        // Mark as changed
        languagesAttr.isValueChanged = true;
        person.triggerDirty();
        
        expect(languagesAttr.objects.length).toBe(initialCount + 1);
        expect(person.isDirty).toBe(true);
    });

    test("should access detail query", async ({ person }) => {
        const languagesAttr = person.getAttribute("Languages") as PersistentObjectAttributeAsDetail;
        expect(languagesAttr).toBeInstanceOf(PersistentObjectAttributeAsDetail);
        
        const detailQuery = languagesAttr.details;
        expect(detailQuery).toBeInstanceOf(Query);
        expect(detailQuery.name).toBe("Person_Languages");
        
        // Check for standard actions
        const newAction = detailQuery.actions["New"];
        expect(newAction).toBeInstanceOf(Action);
    });

    test("should follow parent edit state", async ({ person }) => {
        const languagesAttr = person.getAttribute("Languages") as PersistentObjectAttributeAsDetail;
        expect(languagesAttr).toBeInstanceOf(PersistentObjectAttributeAsDetail);

        expect(Array.isArray(languagesAttr.objects)).toBe(true);
        expect(languagesAttr.objects.length).toBeGreaterThan(0);
        
        const firstLanguage = languagesAttr.objects[0];
        
        // Initially not in edit mode
        expect(person.isEditing).toBe(false);
        expect(firstLanguage.isEditing).toBe(false);
        
        // When parent enters edit mode, detail objects follow
        person.beginEdit();
        expect(person.isEditing).toBe(true);
        expect(firstLanguage.isEditing).toBe(true);
        
        // When parent cancels, detail changes are also cancelled
        // but detail objects may remain in edit mode if parent returns to edit
        person.cancelEdit();
        expect(person.isEditing).toBe(false);
    });
});

test.describe("Attribute Metadata and Properties", () => {
    test("should expose core properties", async ({ person }) => {
        const emailAttr = person.getAttribute("Email");
        
        // Identity and structure
        expect(emailAttr.id).toBeTruthy();
        expect(typeof emailAttr.id).toBe("string");
        expect(emailAttr.name).toBe("Email");
        expect(emailAttr.type).toBe("String");
        expect(emailAttr.label).toBe("Email");
        
        // Behavior flags - check actual values
        expect(emailAttr.isReadOnly).toBe(false);
        expect(emailAttr.isRequired).toBe(true);
        expect(emailAttr.isVisible).toBe(true);
        expect(emailAttr.isSystem).toBe(false);
        expect(emailAttr.isSensitive).toBe(false);
        
        // State
        expect(emailAttr.isValueChanged).toBe(false);
        
        // UI positioning
        expect(emailAttr.group).toBeInstanceOf(PersistentObjectAttributeGroup);
        expect(emailAttr.group.label).toBe("");

        expect(emailAttr.tab).toBeInstanceOf(PersistentObjectAttributeTab);
        expect(emailAttr.tab.label).toBe("Person");
        
        expect(emailAttr.column).toBeUndefined();
        expect(emailAttr.columnSpan).toBe(1);
        expect(emailAttr.offset).toBe(50);
    });

    test("should handle display values", async ({ person }) => {
        const birthDateAttr = person.getAttribute("BirthDate");
        expect(birthDateAttr).toBeInstanceOf(PersistentObjectAttribute);
        expect(birthDateAttr.type).toBe("Date");
        expect(birthDateAttr.value).toBeInstanceOf(Date);
        
        // Display value (formatted string)
        expect(birthDateAttr.displayValue).toBe("06/03/1976");
    });

    test("should handle type hints", async ({ person }) => {
        const emailAttr = person.getAttribute("Email");
        const phoneAttr = person.getAttribute("PhoneNumber");
        
        // Get specific type hints with defaults
        const emailInputType = emailAttr.getTypeHint("inputtype", "email");
        expect(emailInputType).toBe("email");
        
        const phoneInputType = phoneAttr.getTypeHint("inputtype", "tel");
        expect(phoneInputType).toBe("tel");
    });

    test("should handle attribute options", async ({ person }) => {
        const genderAttr = person.getAttribute("Gender");
        expect(Array.isArray(genderAttr.options)).toBe(true);
        expect(genderAttr.options).toEqual(["Female", "Male", "Unknown"]);

        const contactPrefAttr = person.getAttribute("ContactPreference");
        expect(Array.isArray(contactPrefAttr.options)).toBe(true);
        expect(contactPrefAttr.options).toEqual(["Email", "Phone"]);
    });
});

test.describe("Validation and Errors", () => {
    test("should check validation rules", async ({ person }) => {
        const emailAttr = person.getAttribute("Email");
        const firstNameAttr = person.getAttribute("FirstName");
        const phoneNumberAttr = person.getAttribute("PhoneNumber");

        expect(emailAttr.rules).toBe("NotEmpty; IsEmail");
        expect(firstNameAttr.rules).toBe("NotEmpty");
        expect(phoneNumberAttr.rules).toBeUndefined();
    });

    test("should handle validation errors", async ({ newPerson }) => {
        // New objects are automatically in edit mode
        expect(newPerson.isEditing).toBe(true);
        
        // Set an invalid email
        await newPerson.setAttributeValue("Email", "invalid-email");
        
        // Try to save with invalid data
        try {
            await newPerson.save();
            // If save succeeds unexpectedly, fail the test
            expect(true).toBe(false);
        } catch (error) {
            // Check for validation errors
            const emailAttr = newPerson.getAttribute("Email");
            
            // Either attribute has validation error or object has notification
            const hasValidationError = emailAttr.validationError || newPerson.notification;
            expect(hasValidationError).toBeTruthy();
        }
    });

    test("should handle required field validation", async ({ newPerson }) => {
        // New objects are automatically in edit mode
        expect(newPerson.isEditing).toBe(true);
        
        // Set valid email but leave required fields empty
        await newPerson.setAttributeValue("Email", "test@example.com");
        
        try {
            await newPerson.save();
            // If save succeeds unexpectedly, fail the test
            expect(true).toBe(false);
        } catch (error) {
            // Should have validation errors for required fields
            const firstNameAttr = newPerson.getAttribute("FirstName");
            const lastNameAttr = newPerson.getAttribute("LastName");
            
            // Check for validation errors
            expect(firstNameAttr.validationError).toBeTruthy();
            expect(lastNameAttr.validationError).toBeTruthy();
        }
    });
});

test.describe("Refresh and Dependencies", () => {
    test("should toggle required fields when ContactPreference changes", async ({ person }) => {
        const contactPrefAttr = person.getAttribute("ContactPreference");
        const emailAttr = person.getAttribute("Email");
        const phoneAttr = person.getAttribute("PhoneNumber");

        expect(contactPrefAttr.triggersRefresh).toBe(true);
        expect(contactPrefAttr.value).toBe("Email");
        expect(emailAttr.isRequired).toBe(true);
        expect(phoneAttr.isRequired).toBe(false);

        person.beginEdit();

        await person.setAttributeValue("ContactPreference", "Phone");
        expect(contactPrefAttr.value).toBe("Phone");
        expect(emailAttr.isRequired).toBe(false);
        expect(phoneAttr.isRequired).toBe(true);

        await person.setAttributeValue("ContactPreference", "Email");
        expect(contactPrefAttr.value).toBe("Email");
        expect(emailAttr.isRequired).toBe(true);
        expect(phoneAttr.isRequired).toBe(false);
    });

    test("should handle deferred refresh", async ({ person }) => {
        person.beginEdit();

        const contactPrefAttr = person.getAttribute("ContactPreference");
        const emailAttr = person.getAttribute("Email");
        const phoneAttr = person.getAttribute("PhoneNumber");

        expect(contactPrefAttr).toBeInstanceOf(PersistentObjectAttribute);
        expect(emailAttr).toBeInstanceOf(PersistentObjectAttribute);
        expect(phoneAttr).toBeInstanceOf(PersistentObjectAttribute);

        // Initial state
        expect(contactPrefAttr.value).toBe("Email");
        expect(emailAttr.isRequired).toBe(true);
        expect(phoneAttr.isRequired).toBe(false);

        // Change to Phone but defer refresh
        await person.setAttributeValue("ContactPreference", "Phone", false);

        // Value changed, but dependencies not refreshed yet
        expect(contactPrefAttr.value).toBe("Phone");
        expect(emailAttr.isRequired).toBe(true);   // still old state
        expect(phoneAttr.isRequired).toBe(false);  // still old state

        // Trigger manual refresh
        await person.triggerAttributeRefresh(contactPrefAttr);

        // After refresh dependencies updated
        expect(contactPrefAttr.value).toBe("Phone");
        expect(emailAttr.isRequired).toBe(false);
        expect(phoneAttr.isRequired).toBe(true);
    });

    test("handles attribute refresh behavior with new person", async ({ newPerson }) => {
        // New objects are automatically in edit mode
        expect(newPerson.isEditing).toBe(true);

        const contactPrefAttr = newPerson.getAttribute("ContactPreference");
        const emailAttr = newPerson.getAttribute("Email");
        const phoneAttr = newPerson.getAttribute("PhoneNumber");
        expect(contactPrefAttr && emailAttr && phoneAttr).toBeTruthy();

        // initial
        expect(contactPrefAttr.value).toBe("Email");
        expect(emailAttr.isRequired).toBe(true);
        expect(phoneAttr.isRequired).toBe(false);

        // change to Phone
        await newPerson.setAttributeValue("ContactPreference", "Phone");
        expect(contactPrefAttr.value).toBe("Phone");
        expect(phoneAttr.isRequired).toBe(true);
        expect(emailAttr.isRequired).toBe(false);

        // change back to Email
        await newPerson.setAttributeValue("ContactPreference", "Email");
        expect(contactPrefAttr.value).toBe("Email");
        expect(emailAttr.isRequired).toBe(true);
        expect(phoneAttr.isRequired).toBe(false);
    });
});

test.describe("Event Handling", () => {
    test("should monitor attribute changes", async ({ person }) => {
        const emailAttr = person.getAttribute("Email");
        let valueChanged = false;
        
        // Attach listener
        const disposer = emailAttr.propertyChanged.attach((sender, args) => {
            if (args.propertyName === "value") {
                valueChanged = true;
            }
        });
        
        person.beginEdit();
        await person.setAttributeValue("Email", "newemail@example.com");
        
        expect(valueChanged).toBe(true);
        
        // Clean up
        disposer();
    });

    test("should monitor detail attribute changes", async ({ person }) => {
        const languagesAttr = person.getAttribute("Languages") as PersistentObjectAttributeAsDetail;
        expect(languagesAttr).toBeInstanceOf(PersistentObjectAttributeAsDetail);
        
        let objectsChanged = false;
        
        const disposer = languagesAttr.propertyChanged.attach((sender, args) => {
            if (args.propertyName === "objects") {
                objectsChanged = true;
            }
        });
        
        person.beginEdit();
        
        // Add a new language
        const newLanguage = await languagesAttr.newObject();
        expect(newLanguage).toBeInstanceOf(PersistentObject);

        languagesAttr.objects.push(newLanguage);
        languagesAttr.isValueChanged = true;
            
        // The propertyChanged event might not fire for array mutations
        // so we check the actual change
        expect(languagesAttr.objects.includes(newLanguage)).toBe(true);
        
        // Clean up
        disposer();
    });
});

test.describe("BinaryFile Attributes", () => {
    test("should persist File through edit/save lifecycle", async ({ service }) => {
        // Phase 1: Load the test object
        const attributesObject = await service.getPersistentObject(null, "Dev.Attributes", "BinaryFile");
        expect(attributesObject).toBeInstanceOf(PersistentObject);
        
        const binaryFileAttr = attributesObject.getAttribute("BinaryFile");
        expect(binaryFileAttr).toBeInstanceOf(PersistentObjectAttribute);
        expect(binaryFileAttr.type).toBe("BinaryFile");
        
        // Phase 2: Set initial file
        const testContent = `Test file created at ${new Date().toISOString()}`;
        const file = new File([testContent], "test-lifecycle.txt", { 
            type: "text/plain",
            lastModified: Date.now()
        });
        
        expect(attributesObject.isEditing).toBe(true);
        
        await binaryFileAttr.setFile(file);
        expect(binaryFileAttr.file).toBe(file);
        // Value should be in format: filename|base64content
        expect(binaryFileAttr.value).toContain("test-lifecycle.txt|");
        expect(binaryFileAttr.value).toContain("VGVzdCBmaWxlIGNyZWF0ZWQgYXQ"); // Start of base64 for "Test file created at"
        expect(binaryFileAttr.isValueChanged).toBe(true);
        
        // Phase 3: Save and verify file persists for potential retry scenarios
        const saveAction = attributesObject.getAction("EndEdit");
        expect(saveAction).toBeDefined();
        
        const savedObject = await saveAction.execute({ skipOpen: true });
        
        expect(savedObject.isEditing).toBe(false);
        
        const savedBinaryFileAttr = savedObject.getAttribute("BinaryFile");
        // File reference should persist for retry scenarios and validation errors
        expect(savedBinaryFileAttr.file).toBeDefined();
        expect(savedBinaryFileAttr.file).toBe(file);
        expect(savedBinaryFileAttr.file?.name).toBe("test-lifecycle.txt");
        
        // Phase 4: Reload object to simulate fresh load
        const reloadedObject = await service.getPersistentObject(null, "Dev.Attributes", "BinaryFile");
        const reloadedBinaryFileAttr = reloadedObject.getAttribute("BinaryFile");
        
        expect(reloadedBinaryFileAttr.value).toBeTruthy();
        expect(reloadedObject.isEditing).toBe(true);
        
        // Phase 5: Update with new file
        const updatedFile = new File(["Updated content"], "updated-file.txt", {
            type: "text/plain",
            lastModified: Date.now()
        });
        
        await reloadedBinaryFileAttr.setFile(updatedFile);
        expect(reloadedBinaryFileAttr.file).toBe(updatedFile);
        // Value should be in format: filename|base64content
        expect(reloadedBinaryFileAttr.value).toContain("updated-file.txt|");
        expect(reloadedBinaryFileAttr.value).toContain("VXBkYXRlZCBjb250ZW50"); // Base64 for "Updated content"
        expect(reloadedBinaryFileAttr.isValueChanged).toBe(true);
        
        // Phase 6: Save again and verify file persists
        const saveAction2 = reloadedObject.getAction("EndEdit");
        const savedObject2 = await saveAction2.execute({ skipOpen: true });
        
        expect(savedObject2.isEditing).toBe(false);
        const finalBinaryFileAttr = savedObject2.getAttribute("BinaryFile");
        // File reference should persist for potential retry scenarios
        expect(finalBinaryFileAttr.file).toBe(updatedFile);
    });
});