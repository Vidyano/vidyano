import { test as base, expect } from "@playwright/test";
import {
    Service,
    PersistentObject,
    PersistentObjectAttribute,
    Action,
    Query,
    QueryResultItem,
    PersistentObjectAttributeTab,
    PersistentObjectQueryTab,
    PersistentObjectAttributeWithReference
} from "@vidyano/core";

type Fixtures = {
    service: Service;
    peopleQuery: Query;
    firstItem: QueryResultItem;
    firstPersistentObject: PersistentObject;
};

const test = base.extend<Fixtures>({
    service: async ({ }, use) => {
        const service = new Service("http://localhost:5000", undefined, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await service.executeAction("PersistentObject.ResetTest", service.application);
        await use(service);
    },

    peopleQuery: async ({ service }, use) => {
        const q = await service.getQuery("People");
        expect(q).toBeInstanceOf(Query);
        await use(q);
    },

    firstItem: async ({ peopleQuery }, use) => {
        const [first] = await peopleQuery.getItemsByIndex(0);
        expect(first).toBeInstanceOf(QueryResultItem);
        await use(first);
    },

    firstPersistentObject: async ({ firstItem }, use) => {
        const person = await firstItem.getPersistentObject();
        expect(person).toBeInstanceOf(PersistentObject);
        await use(person);
    },
});

test.describe("PersistentObject", () => {
    test.describe("Loading Persistent Objects", () => {
        test("loads an existing object by type and ID", async ({ service, firstItem }) => {
            const person = await service.getPersistentObject(null, "Person", firstItem.id);
            expect(person).toBeInstanceOf(PersistentObject);
            expect(person.objectId).toBe(firstItem.id);
            expect(person.type).toBe("Person");
            expect(person.attributes?.length).toBe(11);
        });

        test("loads object from query result and validates attributes", async ({ firstItem, firstPersistentObject }) => {
            // Validate object loaded correctly
            expect(firstPersistentObject).toBeInstanceOf(PersistentObject);
            expect(firstPersistentObject.objectId).toBe(firstItem.id);
            
            // Validate attribute values match query data
            const firstname = firstPersistentObject.getAttributeValue("FirstName");
            const lastname = firstPersistentObject.getAttributeValue("LastName");
            
            expect(firstname).toBe(firstItem.values.FirstName);
            expect(lastname).toBe(firstItem.values.LastName);
        });

        test("loads multiple objects and validates properties", async ({ service, peopleQuery }) => {
            const items = await peopleQuery.getItemsByIndex(0, 1, 2);
            expect(items.length).toBe(3);

            const persistentObjects = await Promise.all(items.map(item => item.getPersistentObject()));
            persistentObjects.forEach((po, index) => {
                expect(po).toBeInstanceOf(PersistentObject);
                expect(po.objectId).toBe(items[index].id);
                expect(po.type).toBe("Person");
                expect(po.attributes?.length).toBe(11);
            });
            
            // Validate owner query reference
            const firstPO = persistentObjects[0];
            expect(firstPO.ownerQuery).toBeInstanceOf(Query);
            expect(firstPO.ownerQuery).toBe(peopleQuery);
        });
    });


    test.describe("Actions", () => {
        test("manages actions on PersistentObject", async ({ firstPersistentObject }) => {
            // Get and validate available actions
            const actions = firstPersistentObject.actions;
            expect(Array.isArray(actions)).toBe(true);
            expect(actions.length).toBe(7);
            actions.forEach((a) => expect(a).toBeInstanceOf(Action));

            const actionNames = actions.map((a) => a.name);
            expect(actionNames).toEqual(expect.arrayContaining(["Edit", "EndEdit", "CancelEdit"]));
            
            // Test getAction method
            const editAction = firstPersistentObject.getAction("Edit");
            expect(editAction).toBeInstanceOf(Action);
            expect(editAction?.name).toBe("Edit");
            expect(editAction?.canExecute).toBe(true);

            const nonExistentAction = firstPersistentObject.getAction("NonExistentAction");
            expect(nonExistentAction).toBeUndefined();
        });

        test("executes SendEmail action", async ({ service, peopleQuery }) => {
            const personItem = await peopleQuery.items.findAsync((item) => item.values["ContactPreference"] === "Email") as QueryResultItem;
            expect(personItem).toBeInstanceOf(QueryResultItem);

            const personId = personItem.values["Id"] ?? personItem.id;
            expect(personId).toBe("3");

            const person = await service.getPersistentObject(null, "Person", personId);
            expect(person).toBeInstanceOf(PersistentObject);

            const sendEmailAction = person.getAction("SendEmail");
            expect(sendEmailAction).toBeInstanceOf(Action);
            expect(sendEmailAction.canExecute).toBe(true);

            const result = await sendEmailAction.execute();
            expect(result).toBeInstanceOf(PersistentObject);
            expect(result.type).toBe("Email");
        });

        test("creates and saves new PersistentObject", async ({ peopleQuery, firstItem }) => {
            const newAction = peopleQuery.actions.find((a) => a.name === "New") as Action;
            expect(newAction).toBeInstanceOf(Action);

            const newPerson = await newAction.execute();
            expect(newPerson).toBeInstanceOf(PersistentObject);

            await newPerson.setAttributeValue("FirstName", "Test");
            await newPerson.setAttributeValue("LastName", "ActionUser");
            await newPerson.setAttributeValue("ContactPreference", "Email");
            await newPerson.setAttributeValue("Email", `test.action.${Date.now()}@example.com`);
            await newPerson.setAttributeValue("PhoneNumber", "555-123-4567");
            await newPerson.setAttributeValue("BirthDate", "1985-05-09");
            await newPerson.setAttributeValue("Gender", "Female");
            await newPerson.setAttributeValue("IsActive", true);

            const emergencyContactAttr = newPerson.getAttribute("EmergencyContact") as PersistentObjectAttributeWithReference;
            expect(emergencyContactAttr).toBeInstanceOf(PersistentObjectAttributeWithReference);
            await emergencyContactAttr.changeReference([firstItem]);

            const saveAction = newPerson.getAction("Save");
            expect(saveAction).toBeInstanceOf(Action);
            expect(saveAction.canExecute).toBe(true);

            const result = await saveAction.execute({ throwExceptions: true });
            expect(result).toBeInstanceOf(PersistentObject);
            expect(result?.objectId).toBe("10001");
        });
    });

    test.describe("State Properties and Editing", () => {
        test("manages state properties throughout object lifecycle", async ({ firstPersistentObject, peopleQuery }) => {
            // Verify all state properties exist
            const props = ["isNew", "isEditing", "isDirty", "isReadOnly", "isSystem", "isFrozen"] as const;
            props.forEach((p) => expect(p in firstPersistentObject).toBe(true));
            props.forEach((p) => expect(typeof (firstPersistentObject as any)[p]).toBe("boolean"));
            
            // Test existing object state
            expect(firstPersistentObject.isNew).toBe(false);
            expect(firstPersistentObject.isEditing).toBe(false);
            expect(firstPersistentObject.isDirty).toBe(false);

            // Test edit mode transitions
            await firstPersistentObject.beginEdit();
            expect(firstPersistentObject.isNew).toBe(false);
            expect(firstPersistentObject.isEditing).toBe(true);
            expect(firstPersistentObject.isDirty).toBe(false);

            const firstNameAttr = firstPersistentObject.getAttribute("FirstName");
            const originalValue = firstNameAttr.value;
            await firstNameAttr.setValue(originalValue + "_modified");
            
            expect(firstPersistentObject.isEditing).toBe(true);
            expect(firstPersistentObject.isDirty).toBe(true);

            await firstPersistentObject.cancelEdit();
            expect(firstPersistentObject.isEditing).toBe(false);
            expect(firstPersistentObject.isDirty).toBe(false);
            expect(firstPersistentObject.getAttribute("FirstName").value).toBe(originalValue);
            
            // Test new object state
            const newAction = peopleQuery.actions.find((a) => a.name === "New") as Action;
            expect(newAction).toBeInstanceOf(Action);

            const newPerson = await newAction.execute({ skipOpen: true });
            expect(newPerson).toBeInstanceOf(PersistentObject);

            expect(newPerson.isNew).toBe(true);
            expect(newPerson.isEditing).toBe(true);
            expect(newPerson.isDirty).toBe(false);
            expect(newPerson.isReadOnly).toBe(false);
            expect(newPerson.isSystem).toBe(false);
            expect(newPerson.isFrozen).toBe(false);

            const newFirstNameAttr = newPerson.getAttribute("FirstName");
            expect(newFirstNameAttr).toBeInstanceOf(PersistentObjectAttribute);
            await newFirstNameAttr.setValue("Test");

            expect(newPerson.isNew).toBe(true);
            expect(newPerson.isEditing).toBe(true);
            expect(newPerson.isDirty).toBe(true);
        });

        test("handles freeze/unfreeze operations", async ({ firstPersistentObject }) => {
            await firstPersistentObject.beginEdit();
            expect(firstPersistentObject.isEditing).toBe(true);
            const originalFirstName = firstPersistentObject.getAttributeValue("FirstName");

            // Test single freeze/unfreeze cycle
            firstPersistentObject.freeze();
            expect(firstPersistentObject.isFrozen).toBe(true);

            const returnedValue = await firstPersistentObject.setAttributeValue("FirstName", "NewName");
            expect(returnedValue).toBe(originalFirstName);
            expect(firstPersistentObject.getAttributeValue("FirstName")).toBe(originalFirstName);

            firstPersistentObject.unfreeze();
            expect(firstPersistentObject.isFrozen).toBe(false);

            await firstPersistentObject.setAttributeValue("FirstName", "NewName");
            expect(firstPersistentObject.getAttributeValue("FirstName")).toBe("NewName");
            
            // Test multiple freeze/unfreeze cycles
            await firstPersistentObject.setAttributeValue("FirstName", originalFirstName);
            
            for (let i = 1; i <= 2; i++) {
                firstPersistentObject.freeze();
                expect(firstPersistentObject.isFrozen).toBe(true);
                const cycleResult = await firstPersistentObject.setAttributeValue("FirstName", `Cycle${i}`);
                expect(cycleResult).toBe(originalFirstName);
                expect(firstPersistentObject.getAttributeValue("FirstName")).toBe(originalFirstName);
                firstPersistentObject.unfreeze();
                expect(firstPersistentObject.isFrozen).toBe(false);
            }

            await firstPersistentObject.setAttributeValue("FirstName", "FinalValue");
            expect(firstPersistentObject.getAttributeValue("FirstName")).toBe("FinalValue");
        });
    });

    test.describe("Tabs and Groups", () => {
        test("validates tabs, groups, and attributes structure", async ({ firstPersistentObject }) => {
            // Verify basic properties
            expect(firstPersistentObject.type).toBe("Person");
            expect(firstPersistentObject.objectId).toBe("3");
            expect(Array.isArray(firstPersistentObject.tabs)).toBe(true);
            expect(firstPersistentObject.tabs.length).toBe(2);

            // Tab 0: Person (Attribute Tab)
            const personTab = firstPersistentObject.tabs[0] as PersistentObjectAttributeTab;
            expect(personTab).toBeInstanceOf(PersistentObjectAttributeTab);
            expect(personTab.label).toBe("Person");
            expect(personTab.name).toBe("Person");
            expect(Array.isArray(personTab.groups)).toBe(true);
            expect(personTab.groups.length).toBe(1);
            
            // Validate first group and attributes
            const firstGroup = personTab.groups[0];
            expect(Array.isArray(firstGroup.attributes)).toBe(true);
            expect(firstGroup.attributes.length).toBe(11);
            
            const firstAttribute = firstGroup.attributes[0];
            expect(firstAttribute.name).toBe("FirstName");
            expect(firstAttribute.label).toBe("First name");
            expect(firstAttribute.type).toBe("String");
            
            // Count total attributes
            const tabAttributeCount = personTab.groups.reduce((n, g) => n + g.attributes.length, 0);
            expect(tabAttributeCount).toBe(11);

            // Tab 1: Addresses (Query Tab)
            const addressesTab = firstPersistentObject.tabs[1] as PersistentObjectQueryTab;
            expect(addressesTab).toBeInstanceOf(PersistentObjectQueryTab);
            expect(addressesTab.label).toBe("Addresses");
            expect(addressesTab.name).toBe("Person_Addresses");
            expect(addressesTab.query).toBeInstanceOf(Query);
            expect(addressesTab.query.name).toBe("Person_Addresses");
            expect(addressesTab.query.label).toBe("Addresses");
        });
    });

    test.describe("Error Handling and Validation", () => {
        test("handles save operations with validation", async ({ peopleQuery }) => {
            // Test validation errors
            const newAction = peopleQuery.actions.find((a) => a.name === "New") as Action;
            expect(newAction).toBeInstanceOf(Action);

            const invalidPerson = await newAction.execute();
            expect(invalidPerson).toBeInstanceOf(PersistentObject);

            let saveResult = false;
            try {
                saveResult = await invalidPerson.save();
            } catch {
                saveResult = false;
            }
            expect(saveResult).toBe(false);

            const hasValidationErrors = invalidPerson.attributes.some((a) => !!a.validationError);
            expect(hasValidationErrors).toBe(true);
            
            // Test successful save
            const validPerson = await newAction.execute();
            expect(validPerson).toBeInstanceOf(PersistentObject);

            await validPerson.setAttributeValue("FirstName", "Test");
            await validPerson.setAttributeValue("LastName", "User");
            await validPerson.setAttributeValue("Email", `test.user.${Date.now()}@example.com`);
            await validPerson.setAttributeValue("PhoneNumber", "555-1234");
            await validPerson.setAttributeValue("BirthDate", new Date("1990-01-01"));
            await validPerson.setAttributeValue("Gender", "Male");
            await validPerson.setAttributeValue("IsActive", true);
            await validPerson.setAttributeValue("ContactPreference", "Email");

            const [randomPerson] = await peopleQuery.getItemsByIndex(0);
            expect(randomPerson).toBeInstanceOf(QueryResultItem);
            const emergencyContextAttr = await validPerson.getAttribute("EmergencyContact") as PersistentObjectAttributeWithReference;
            emergencyContextAttr.changeReference([randomPerson]);

            const successfulSave = await validPerson.save();
            expect(successfulSave).toBe(true);
            expect(validPerson.objectId).toBe("10001");
            expect(validPerson.attributes.some((a) => !!a.validationError)).toBe(false);
        });
    });

    test.describe("Property Change Monitoring", () => {
        test("monitors property changes using observable patterns", async ({ firstPersistentObject }) => {
            const changes: any[] = [];
            const detachObserver = firstPersistentObject.propertyChanged.attach((sender: any, args: any) => {
                changes.push({ propertyName: args.propertyName, oldValue: args.oldValue, newValue: args.newValue });
            });

            await firstPersistentObject.beginEdit();
            expect(changes).toEqual([
                { propertyName: "isEditing", oldValue: false, newValue: true }
            ]);
            
            changes.length = 0; // Clear the array

            const firstNameAttr = firstPersistentObject.getAttribute("FirstName");
            const originalFirstName = firstNameAttr.value;
            await firstNameAttr.setValue(originalFirstName + "_modified");

            expect(changes).toEqual([
                { propertyName: "isDirty", oldValue: false, newValue: true }
            ]);

            changes.length = 0; // Clear the array

            await firstPersistentObject.cancelEdit();
            
            expect(changes).toEqual([
                { propertyName: "isEditing", oldValue: true, newValue: false },
                { propertyName: "isDirty", oldValue: true, newValue: false },
                { propertyName: "lastUpdated", oldValue: expect.any(Date), newValue: expect.any(Date) }
            ]);

            detachObserver();
        });
    });
});