import { test, expect } from "@playwright/test";
import { PersistentObjectAttributeTab } from "@vidyano/core";
import { VirtualService } from "../src/index.js";

test("creates tabs from configuration", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", tab: "General" },
            { name: "LastName", type: "String", tab: "General" },
            { name: "Email", type: "String", tab: "Contact" },
            { name: "Phone", type: "String", tab: "Contact" }
        ],
        tabs: {
            "General": { name: "General", columnCount: 2 },
            "Contact": { name: "Contact", columnCount: 1 }
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    // Verify tabs array
    expect(Array.isArray(person.tabs)).toBe(true);
    expect(person.tabs.length).toBe(2);

    // Verify General tab
    const generalTab = person.tabs.find(t => t.name === "General") as PersistentObjectAttributeTab;
    expect(generalTab).toBeDefined();
    expect(generalTab).toBeInstanceOf(PersistentObjectAttributeTab);
    expect(generalTab.label).toBe("General");

    // Verify Contact tab
    const contactTab = person.tabs.find(t => t.name === "Contact") as PersistentObjectAttributeTab;
    expect(contactTab).toBeDefined();
    expect(contactTab).toBeInstanceOf(PersistentObjectAttributeTab);
    expect(contactTab.label).toBe("Contact");

    // Verify attributes are in correct tabs
    const generalAttrs = generalTab.groups.flatMap(g => g.attributes);
    expect(generalAttrs.length).toBe(2);
    expect(generalAttrs.some(a => a.name === "FirstName")).toBe(true);
    expect(generalAttrs.some(a => a.name === "LastName")).toBe(true);

    const contactAttrs = contactTab.groups.flatMap(g => g.attributes);
    expect(contactAttrs.length).toBe(2);
    expect(contactAttrs.some(a => a.name === "Email")).toBe(true);
    expect(contactAttrs.some(a => a.name === "Phone")).toBe(true);
});

test("creates default tab when no tabs specified", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String" },
            { name: "LastName", type: "String" }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    // Should have at least one tab
    expect(Array.isArray(person.tabs)).toBe(true);
    expect(person.tabs.length).toBeGreaterThan(0);

    // Default tab should contain all attributes
    const defaultTab = person.tabs[0] as PersistentObjectAttributeTab;
    const allAttrs = defaultTab.groups.flatMap(g => g.attributes);
    expect(allAttrs.length).toBe(2);
    expect(allAttrs.some(a => a.name === "FirstName")).toBe(true);
    expect(allAttrs.some(a => a.name === "LastName")).toBe(true);
});

test("groups attributes correctly within tabs", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        attributes: [
            { name: "FirstName", type: "String", tab: "General", group: "Name" },
            { name: "LastName", type: "String", tab: "General", group: "Name" },
            { name: "BirthDate", type: "Date", tab: "General", group: "Details" },
            { name: "Email", type: "String", tab: "Contact", group: "" }
        ],
        tabs: {
            "General": { name: "General" },
            "Contact": { name: "Contact" }
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person");

    // Find General tab
    const generalTab = person.tabs.find(t => t.name === "General") as PersistentObjectAttributeTab;
    expect(generalTab).toBeDefined();

    // Verify groups in General tab
    expect(generalTab.groups.length).toBeGreaterThan(0);

    // Find "Name" group
    const nameGroup = generalTab.groups.find(g => g.label === "Name");
    expect(nameGroup).toBeDefined();
    expect(nameGroup!.attributes.length).toBe(2);
    expect(nameGroup!.attributes.some(a => a.name === "FirstName")).toBe(true);
    expect(nameGroup!.attributes.some(a => a.name === "LastName")).toBe(true);

    // Find "Details" group
    const detailsGroup = generalTab.groups.find(g => g.label === "Details");
    expect(detailsGroup).toBeDefined();
    expect(detailsGroup!.attributes.length).toBe(1);
    expect(detailsGroup!.attributes[0].name).toBe("BirthDate");

    // Contact tab should have attributes without explicit group
    const contactTab = person.tabs.find(t => t.name === "Contact") as PersistentObjectAttributeTab;
    expect(contactTab).toBeDefined();
    const contactAttrs = contactTab.groups.flatMap(g => g.attributes);
    expect(contactAttrs.some(a => a.name === "Email")).toBe(true);
});
