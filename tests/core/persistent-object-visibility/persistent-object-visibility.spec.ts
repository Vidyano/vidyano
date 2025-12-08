import { test, expect, TestInfo } from "@playwright/test";
import { Service, PersistentObject, PersistentObjectAttributeTab, Action } from "@vidyano/core";
import { startBackend, stopBackend, BackendProcess } from "../../vidyano/_helpers/backend";

let backend: BackendProcess;

test.describe.serial("Attribute Visibility", () => {
    test.beforeAll(async ({}, testInfo: TestInfo) => {
        backend = await startBackend(testInfo);
    });

    test.afterAll(async () => {
        await stopBackend(backend);
    });

    async function createService(): Promise<Service> {
        const service = new Service(`http://localhost:${backend.port}`, undefined, false);
        await service.initialize(true);
        await service.signInUsingDefaultCredentials();
        return service;
    }

    async function getTestItem(service: Service): Promise<PersistentObject> {
        const query = await service.getQuery("VisibilityTestItems");
        await query.search();
        const item = await query.items.atAsync(0);
        return await item!.getPersistentObject();
    }

    test("initial state has all tabs and groups visible", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Verify we have 2 tabs: Main (unnamed) and Advanced
        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        expect(attributeTabs.length).toBe(2);

        // Both tabs should be visible
        expect(attributeTabs[0].isVisible).toBe(true);
        expect(attributeTabs[1].isVisible).toBe(true);

        // Main tab (key="") should have 2 groups (General and Optional)
        const mainTab = attributeTabs.find(t => t.key === "");
        expect(mainTab).toBeDefined();
        expect(mainTab!.groups.length).toBe(2);

        // Advanced tab should have 2 groups (Technical and Audit)
        const advancedTab = attributeTabs.find(t => t.key === "Advanced");
        expect(advancedTab).toBeDefined();
        expect(advancedTab!.groups.length).toBe(2);

        // All attributes should be visible
        for (const attr of po.attributes)
            expect(attr.isVisible).toBe(true);
    });

    test("hiding all attributes in a tab hides the tab", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Track tab visibility changes
        const tabChanges: { tabKey: string; oldVisible: boolean; newVisible: boolean }[] = [];
        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        for (const tab of attributeTabs) {
            tab.propertyChanged.attach((_, args) => {
                if (args.propertyName === "isVisible")
                    tabChanges.push({ tabKey: tab.key, oldVisible: args.oldValue as boolean, newVisible: args.newValue as boolean });
            });
        }

        // Begin editing and change ViewMode to hide Advanced tab
        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Advanced Tab");

        // Find Advanced tab
        const advancedTab = attributeTabs.find(t => t.key === "Advanced") as PersistentObjectAttributeTab;

        // Advanced tab should be hidden
        expect(advancedTab.isVisible).toBe(false);

        // Main tab should still be visible
        const mainTab = attributeTabs.find(t => t.key === "") as PersistentObjectAttributeTab;
        expect(mainTab.isVisible).toBe(true);

        // Verify change event was fired for Advanced tab
        const advancedTabChange = tabChanges.find(c => c.tabKey === "Advanced");
        expect(advancedTabChange).toBeDefined();
        expect(advancedTabChange!.oldVisible).toBe(true);
        expect(advancedTabChange!.newVisible).toBe(false);
    });

    test("hiding all attributes in a group hides those attributes", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Track attribute visibility changes
        const attrChanges: { name: string; oldVisible: boolean; newVisible: boolean }[] = [];
        for (const attr of po.attributes) {
            attr.propertyChanged.attach((_, args) => {
                if (args.propertyName === "isVisible")
                    attrChanges.push({ name: attr.name, oldVisible: args.oldValue as boolean, newVisible: args.newValue as boolean });
            });
        }

        // Begin editing and change ViewMode to hide Optional group
        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Optional Group");

        // Notes and Tags should be hidden (they're in Optional group)
        expect(po.getAttribute("Notes")!.isVisible).toBe(false);
        expect(po.getAttribute("Tags")!.isVisible).toBe(false);

        // Name, Description, ViewMode should still be visible (General group)
        expect(po.getAttribute("Name")!.isVisible).toBe(true);
        expect(po.getAttribute("Description")!.isVisible).toBe(true);
        expect(po.getAttribute("ViewMode")!.isVisible).toBe(true);

        // Advanced tab attributes should still be visible
        expect(po.getAttribute("InternalCode")!.isVisible).toBe(true);
        expect(po.getAttribute("CreatedDate")!.isVisible).toBe(true);
        expect(po.getAttribute("ModifiedDate")!.isVisible).toBe(true);

        // Verify change events were fired for hidden attributes
        const notesChange = attrChanges.find(c => c.name === "Notes");
        const tagsChange = attrChanges.find(c => c.name === "Tags");
        expect(notesChange).toBeDefined();
        expect(tagsChange).toBeDefined();
        expect(notesChange!.newVisible).toBe(false);
        expect(tagsChange!.newVisible).toBe(false);
    });

    test("minimal view shows only essential attributes", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Get tab references before the change
        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const advancedTab = attributeTabs.find(t => t.key === "Advanced")!;
        const mainTab = attributeTabs.find(t => t.key === "")!;

        // Begin editing and change ViewMode to Minimal View
        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Minimal View");

        // Only Name, Description, ViewMode should be visible
        expect(po.getAttribute("Name")!.isVisible).toBe(true);
        expect(po.getAttribute("Description")!.isVisible).toBe(true);
        expect(po.getAttribute("ViewMode")!.isVisible).toBe(true);

        // All other attributes should be hidden
        expect(po.getAttribute("Notes")!.isVisible).toBe(false);
        expect(po.getAttribute("Tags")!.isVisible).toBe(false);
        expect(po.getAttribute("InternalCode")!.isVisible).toBe(false);
        expect(po.getAttribute("CreatedDate")!.isVisible).toBe(false);
        expect(po.getAttribute("ModifiedDate")!.isVisible).toBe(false);

        // Advanced tab should be hidden (all its attributes are hidden)
        expect(advancedTab.isVisible).toBe(false);

        // Main tab should still be visible (has visible attributes)
        expect(mainTab.isVisible).toBe(true);
    });

    test("restoring visibility shows all tabs and groups again", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Get tab references before hiding
        const getAttributeTabs = () => po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const initialTabs = getAttributeTabs();
        expect(initialTabs.length).toBe(2);

        const advancedTabBefore = initialTabs.find(t => t.key === "Advanced")!;

        // First hide everything
        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Minimal View");

        // Verify Advanced tab is hidden
        expect(advancedTabBefore.isVisible).toBe(false);

        // Restore visibility
        await po.setAttributeValue("ViewMode", "Show All");

        // All attributes should be visible
        for (const attr of po.attributes)
            expect(attr.isVisible).toBe(true);

        // Look up tabs again after restoration (new tab objects may have been created)
        const restoredTabs = getAttributeTabs();

        // We should still have 2 tabs
        expect(restoredTabs.length).toBe(2);

        const advancedTabAfter = restoredTabs.find(t => t.key === "Advanced")!;
        const mainTabAfter = restoredTabs.find(t => t.key === "")!;

        // All tabs should be visible
        expect(advancedTabAfter.isVisible).toBe(true);
        expect(mainTabAfter.isVisible).toBe(true);
    });

    test("change events fire for attribute visibility changes", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Track all property changes on an attribute that will be hidden
        const notesAttr = po.getAttribute("Notes")!;
        const changes: { property: string; oldValue: any; newValue: any }[] = [];
        notesAttr.propertyChanged.attach((_, args) => {
            changes.push({ property: args.propertyName, oldValue: args.oldValue, newValue: args.newValue });
        });

        // Begin editing and hide the Optional group
        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Optional Group");

        // Verify isVisible and visibility changes were fired
        const visibilityChange = changes.find(c => c.property === "visibility");
        const isVisibleChange = changes.find(c => c.property === "isVisible");

        expect(visibilityChange).toBeDefined();
        expect(isVisibleChange).toBeDefined();
        expect(isVisibleChange!.oldValue).toBe(true);
        expect(isVisibleChange!.newValue).toBe(false);
    });

    test("tab visibility updates automatically without manual refresh", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Get initial tab visibility
        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const advancedTab = attributeTabs.find(t => t.key === "Advanced") as PersistentObjectAttributeTab;
        expect(advancedTab.isVisible).toBe(true);

        // Begin editing and hide Advanced tab
        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Advanced Tab");

        // The tab should automatically update without calling any refresh method
        // This tests the Observable.forward mechanism
        expect(advancedTab.isVisible).toBe(false);

        // Restore and verify automatic update
        await po.setAttributeValue("ViewMode", "Show All");
        expect(advancedTab.isVisible).toBe(true);
    });

    // === Edge Case Tests ===

    test("hiding single-attribute group (Audit) hides only that attribute", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const advancedTab = attributeTabs.find(t => t.key === "Advanced") as PersistentObjectAttributeTab;

        // Audit group has only ModifiedDate
        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Audit Only");

        // ModifiedDate should be hidden
        expect(po.getAttribute("ModifiedDate")!.isVisible).toBe(false);

        // Technical group attributes should still be visible
        expect(po.getAttribute("InternalCode")!.isVisible).toBe(true);
        expect(po.getAttribute("CreatedDate")!.isVisible).toBe(true);

        // Advanced tab should still be visible (Technical group has visible attrs)
        expect(advancedTab.isVisible).toBe(true);
    });

    test("hiding some (not all) attributes in a group keeps group partially visible", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Single Attr In Optional");

        // Notes hidden, Tags visible
        expect(po.getAttribute("Notes")!.isVisible).toBe(false);
        expect(po.getAttribute("Tags")!.isVisible).toBe(true);

        // Main tab should still be visible
        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const mainTab = attributeTabs.find(t => t.key === "") as PersistentObjectAttributeTab;
        expect(mainTab.isVisible).toBe(true);
    });

    test("hiding one group keeps tab visible when other groups have visible attrs", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const advancedTab = attributeTabs.find(t => t.key === "Advanced") as PersistentObjectAttributeTab;

        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Technical Only");

        // Technical group attrs hidden
        expect(po.getAttribute("InternalCode")!.isVisible).toBe(false);
        expect(po.getAttribute("CreatedDate")!.isVisible).toBe(false);

        // Audit group attr visible
        expect(po.getAttribute("ModifiedDate")!.isVisible).toBe(true);

        // Advanced tab still visible (Audit group has visible content)
        expect(advancedTab.isVisible).toBe(true);
    });

    test("visibility works correctly on new objects", async () => {
        const service = await createService();
        const query = await service.getQuery("VisibilityTestItems");

        // Create new object via query's New action
        const newAction = query.actions.find(a => a.name === "New") as Action;
        expect(newAction).toBeInstanceOf(Action);

        const po = await newAction.execute() as PersistentObject;
        expect(po.isNew).toBe(true);

        // All attributes should be visible initially
        for (const attr of po.attributes)
            expect(attr.isVisible).toBe(true);

        // Change ViewMode on new object
        await po.setAttributeValue("ViewMode", "Minimal View");

        // Only essential attributes visible
        expect(po.getAttribute("Name")!.isVisible).toBe(true);
        expect(po.getAttribute("Description")!.isVisible).toBe(true);
        expect(po.getAttribute("ViewMode")!.isVisible).toBe(true);
        expect(po.getAttribute("Notes")!.isVisible).toBe(false);
        expect(po.getAttribute("InternalCode")!.isVisible).toBe(false);
    });

    test("canceling edit reverts visibility changes", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Initial state: all visible
        expect(po.getAttribute("Notes")!.isVisible).toBe(true);

        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Minimal View");

        // Notes should be hidden
        expect(po.getAttribute("Notes")!.isVisible).toBe(false);

        // Cancel edit
        po.cancelEdit();

        // Notes should be visible again (reverted to original state)
        expect(po.getAttribute("Notes")!.isVisible).toBe(true);
    });

    test("rapid visibility changes maintain consistent final state", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const advancedTab = attributeTabs.find(t => t.key === "Advanced") as PersistentObjectAttributeTab;

        po.beginEdit();

        // Rapid changes
        await po.setAttributeValue("ViewMode", "Minimal View");
        await po.setAttributeValue("ViewMode", "Hide Advanced Tab");
        await po.setAttributeValue("ViewMode", "Hide Optional Group");
        await po.setAttributeValue("ViewMode", "Show All");

        // Final state should be "Show All"
        for (const attr of po.attributes)
            expect(attr.isVisible).toBe(true);

        expect(advancedTab.isVisible).toBe(true);
    });

    test("tab visibility change fires exactly once per transition", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const advancedTab = attributeTabs.find(t => t.key === "Advanced") as PersistentObjectAttributeTab;

        let changeCount = 0;
        advancedTab.propertyChanged.attach((_, args) => {
            if (args.propertyName === "isVisible")
                changeCount++;
        });

        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Advanced Tab");

        // Should fire exactly once for the hide transition
        expect(changeCount).toBe(1);

        // Restore
        await po.setAttributeValue("ViewMode", "Show All");

        // Should fire exactly once more for the show transition
        expect(changeCount).toBe(2);
    });

    test("group attributes reflect visibility state correctly", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        const attributeTabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
        const mainTab = attributeTabs.find(t => t.key === "") as PersistentObjectAttributeTab;
        const optionalGroup = mainTab.groups.find(g => g.key === "Optional");

        expect(optionalGroup).toBeDefined();

        // Initially all attrs in Optional group are visible
        expect(optionalGroup!.attributes.every(a => a.isVisible)).toBe(true);

        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Optional Group");

        // All attrs in Optional group should now be hidden
        expect(optionalGroup!.attributes.every(a => !a.isVisible)).toBe(true);

        // Restore
        await po.setAttributeValue("ViewMode", "Show All");
        expect(optionalGroup!.attributes.every(a => a.isVisible)).toBe(true);
    });

    test("visibility change on attribute that is only one in its group", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Track changes for ModifiedDate (only attr in Audit group)
        const modifiedDateAttr = po.getAttribute("ModifiedDate")!;
        const changes: boolean[] = [];
        modifiedDateAttr.propertyChanged.attach((_, args) => {
            if (args.propertyName === "isVisible")
                changes.push(args.newValue as boolean);
        });

        po.beginEdit();
        await po.setAttributeValue("ViewMode", "Hide Audit Only");

        expect(changes).toEqual([false]);

        await po.setAttributeValue("ViewMode", "Show All");

        expect(changes).toEqual([false, true]);
    });

    test("restoring single-attribute group visibility shows tab correctly", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        // Helper to get fresh tab reference
        const getAdvancedTab = () => {
            const tabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
            return tabs.find(t => t.key === "Advanced") as PersistentObjectAttributeTab;
        };

        const initialTab = getAdvancedTab();
        expect(initialTab.isVisible).toBe(true);

        po.beginEdit();

        // Hide only Audit group (single attr)
        await po.setAttributeValue("ViewMode", "Hide Audit Only");
        expect(po.getAttribute("ModifiedDate")!.isVisible).toBe(false);
        expect(getAdvancedTab().isVisible).toBe(true); // Technical still visible

        // Now hide Technical too (via Hide Advanced Tab)
        await po.setAttributeValue("ViewMode", "Hide Advanced Tab");
        expect(getAdvancedTab().isVisible).toBe(false);

        // Restore everything
        await po.setAttributeValue("ViewMode", "Show All");

        // Get fresh reference after restore and verify
        const restoredTab = getAdvancedTab();
        expect(restoredTab.isVisible).toBe(true);
        expect(po.getAttribute("ModifiedDate")!.isVisible).toBe(true);
        expect(po.getAttribute("InternalCode")!.isVisible).toBe(true);
        expect(po.getAttribute("CreatedDate")!.isVisible).toBe(true);
    });

    test("restore partial visibility keeps correct state", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        po.beginEdit();

        // Start with minimal (hide most)
        await po.setAttributeValue("ViewMode", "Minimal View");
        expect(po.getAttribute("Notes")!.isVisible).toBe(false);
        expect(po.getAttribute("Tags")!.isVisible).toBe(false);

        // Switch to hide only single attr in optional
        await po.setAttributeValue("ViewMode", "Hide Single Attr In Optional");

        // Notes hidden, but Tags now visible (partial restore)
        expect(po.getAttribute("Notes")!.isVisible).toBe(false);
        expect(po.getAttribute("Tags")!.isVisible).toBe(true);

        // All other attrs should be visible now
        expect(po.getAttribute("InternalCode")!.isVisible).toBe(true);
        expect(po.getAttribute("ModifiedDate")!.isVisible).toBe(true);
    });

    test("alternating visibility states multiple times", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        const getAdvancedTab = () => {
            const tabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
            return tabs.find(t => t.key === "Advanced") as PersistentObjectAttributeTab;
        };

        po.beginEdit();

        // Toggle visibility multiple times
        for (let i = 0; i < 3; i++) {
            await po.setAttributeValue("ViewMode", "Hide Advanced Tab");
            expect(getAdvancedTab().isVisible).toBe(false);

            await po.setAttributeValue("ViewMode", "Show All");
            expect(getAdvancedTab().isVisible).toBe(true);
        }

        // Final state should be all visible
        for (const attr of po.attributes)
            expect(attr.isVisible).toBe(true);
    });

    test("group with all hidden attrs vs group with some hidden attrs", async () => {
        const service = await createService();
        const po = await getTestItem(service);

        const getMainTab = () => {
            const tabs = po.tabs.filter(t => t instanceof PersistentObjectAttributeTab) as PersistentObjectAttributeTab[];
            return tabs.find(t => t.key === "") as PersistentObjectAttributeTab;
        };

        po.beginEdit();

        // Hide Optional group completely (Notes + Tags)
        await po.setAttributeValue("ViewMode", "Hide Optional Group");

        const mainTab = getMainTab();
        const generalGroup = mainTab.groups.find(g => g.key === "General");
        const optionalGroup = mainTab.groups.find(g => g.key === "Optional");

        // General group: all visible
        expect(generalGroup!.attributes.every(a => a.isVisible)).toBe(true);
        // Optional group: all hidden
        expect(optionalGroup!.attributes.every(a => !a.isVisible)).toBe(true);

        // Tab should still be visible (General has visible attrs)
        expect(mainTab.isVisible).toBe(true);

        // Now restore
        await po.setAttributeValue("ViewMode", "Show All");

        // Both groups should have all visible
        const mainTabAfter = getMainTab();
        expect(mainTabAfter.groups.every(g => g.attributes.every(a => a.isVisible))).toBe(true);
    });
});
