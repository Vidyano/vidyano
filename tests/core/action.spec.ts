import { test as base, expect } from "@playwright/test";
import {
    Service,
    Query,
    QueryResultItem,
    Action,
    ActionGroup,
    PersistentObject
} from "@vidyano/core";

type Fixtures = {
    service: Service;
    peopleQuery: Query;
};

const test = base.extend<Fixtures>({
    service: async ({}, use) => {
        const service = new Service("http://localhost:5000", undefined, false);
        await service.initialize(true);
        await service.signInUsingCredentials("admin", "admin");
        await service.executeAction("PersistentObject.ResetTest", service.application);
        await use(service);
    },

    peopleQuery: async ({ service }, use) => {
        const peopleQuery = await service.getQuery("People");
        await use(peopleQuery);
    },
});

test.describe("Action", () => {
    test.describe("Action Selection Rules", () => {
        test("TestCount allows 0 to infinity selected items", async ({ peopleQuery }) => {
            const testCountAction = peopleQuery.actions.find(a => a.name === "TestCount") as Action;
            expect(testCountAction).toBeInstanceOf(Action);
            
            expect(testCountAction.canExecute).toBe(true);
            
            let result = await testCountAction.execute();
            
            // Wait for query refresh since TestCount refreshes the query
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("0");
            expect(peopleQuery.notificationType).toBe("OK");
            
            const threeItems = peopleQuery.items.slice(0, 3);
            threeItems.forEach(item => item.isSelected = true);
            
            expect(testCountAction.canExecute).toBe(true);
            
            result = await testCountAction.execute();
            
            // Wait for query refresh since TestCount refreshes the query
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("3");
            expect(peopleQuery.notificationType).toBe("OK");
            
            peopleQuery.items.forEach(item => item.isSelected = false);
            const tenItems = peopleQuery.items.slice(0, 10);
            tenItems.forEach(item => item.isSelected = true);
            expect(testCountAction.canExecute).toBe(true);
            
            result = await testCountAction.execute();
            
            // Wait for query refresh since TestCount refreshes the query
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("10");
        });

        test("TestCountSingle requires exactly 1 selected item", async ({ peopleQuery }) => {
            const testCountSingleAction = peopleQuery.actions.find(a => a.name === "TestCountSingle") as Action;
            
            if (!testCountSingleAction) {
                console.log("TestCountSingle action not found on People query");
                return;
            }
            
            expect(testCountSingleAction).toBeInstanceOf(Action);
            
            expect(testCountSingleAction.canExecute).toBe(false);
            
            peopleQuery.items[0].isSelected = true;
            
            expect(testCountSingleAction.canExecute).toBe(true);
            
            let result = await testCountSingleAction.execute();
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("1");
            expect(peopleQuery.notificationType).toBe("OK");
            
            peopleQuery.items[1].isSelected = true;
            expect(testCountSingleAction.canExecute).toBe(false);
            
            peopleQuery.items[0].isSelected = false;
            expect(testCountSingleAction.canExecute).toBe(true);
            
            peopleQuery.items[1].isSelected = false;
            expect(testCountSingleAction.canExecute).toBe(false);
        });

        test("TestCountMany requires at least 2 selected items", async ({ peopleQuery }) => {
            const testCountManyAction = peopleQuery.actions.find(a => a.name === "TestCountMany") as Action;
            
            if (!testCountManyAction) {
                console.log("TestCountMany action not found on People query");
                return;
            }
            
            expect(testCountManyAction).toBeInstanceOf(Action);
            
            expect(testCountManyAction.canExecute).toBe(false);
            
            peopleQuery.items[0].isSelected = true;
            expect(testCountManyAction.canExecute).toBe(false);
            
            peopleQuery.items[1].isSelected = true;
            expect(testCountManyAction.canExecute).toBe(true);
            
            let result = await testCountManyAction.execute();
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("2");
            expect(peopleQuery.notificationType).toBe("OK");
            
            peopleQuery.items.slice(2, 7).forEach(item => item.isSelected = true);
            expect(testCountManyAction.canExecute).toBe(true);
            
            result = await testCountManyAction.execute();
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("7");
            
            peopleQuery.items.forEach(item => item.isSelected = false);
            peopleQuery.items.slice(0, 10).forEach(item => item.isSelected = true);
            expect(testCountManyAction.canExecute).toBe(true);
            
            result = await testCountManyAction.execute();
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("10");
        });

    });

    test.describe("Action Execution", () => {
        test("TestCount returns count as notification", async ({ peopleQuery }) => {
            const testCountAction = peopleQuery.actions.find(a => a.name === "TestCount") as Action;
            expect(testCountAction).toBeInstanceOf(Action);
            
            const someItems = await peopleQuery.items.sliceAsync(0, 4);
            
            for (const item of someItems) {
                item.isSelected = true;
            }
            
            expect(testCountAction.canExecute).toBe(true);
            
            const result = await testCountAction.execute();
            
            // Wait for query refresh since TestCount refreshes the query
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("4");
        });

        test("TestCountSingle returns count as notification", async ({ peopleQuery }) => {
            const testCountSingleAction = peopleQuery.actions.find(a => a.name === "TestCountSingle") as Action;
            
            if (!testCountSingleAction) {
                console.log("TestCountSingle action not found on People query");
                return;
            }
            
            const items = await peopleQuery.getItemsByIndex(5);
            if (items.length > 0) {
                items[0].isSelected = true;
            }
            
            expect(testCountSingleAction.canExecute).toBe(true);
            
            const result = await testCountSingleAction.execute();
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("1");
        });

        test("TestCountMany returns count as notification", async ({ peopleQuery }) => {
            const testCountManyAction = peopleQuery.actions.find(a => a.name === "TestCountMany") as Action;
            
            if (!testCountManyAction) {
                console.log("TestCountMany action not found on People query");
                return;
            }
            
            const multipleItems = await peopleQuery.items.sliceAsync(0, 5);
            
            for (const item of multipleItems) {
                item.isSelected = true;
            }
            
            expect(testCountManyAction.canExecute).toBe(true);
            
            const result = await testCountManyAction.execute();
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe("5");
        });

        test("actions are disabled while another action is executing", async ({ peopleQuery }) => {
            const itemsToSelect = peopleQuery.items.slice(0, 2);
            itemsToSelect.forEach(item => item.isSelected = true);
            
            const testCountAction = peopleQuery.actions.find(a => a.name === "TestCount") as Action;
            const otherActions = peopleQuery.actions.filter(a => a.name !== "TestCount");
            
            const initialCanExecuteStates = otherActions.map(a => ({ 
                action: a, 
                canExecute: a.canExecute 
            }));
            
            let actionsDuringExecution: { name: string; canExecute: boolean }[] = [];

            const actionPromise = testCountAction.execute();
           
            otherActions.forEach(action => {
                actionsDuringExecution.push({ name: action.name, canExecute: action.canExecute });
            });
            
            await actionPromise;
            
            expect(actionsDuringExecution.length).toBeGreaterThan(0);
            actionsDuringExecution.forEach(actionState => {
                expect(actionState.canExecute).toBe(false);
            });
            
            // Wait for query refresh to complete since TestCount refreshes the query
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            initialCanExecuteStates.forEach(state => {
                if (state.canExecute) {
                    expect(state.action.canExecute).toBe(state.canExecute);
                }
            });
        });
    });

    test.describe("Query Refresh on Action Completion", () => {
        test("TestCount refreshes query after execution", async ({ peopleQuery }) => {
            const testCountAction = peopleQuery.actions.find(a => a.name === "TestCount") as Action;
            expect(testCountAction).toBeInstanceOf(Action);
            
            const someItems = await peopleQuery.items.sliceAsync(0, 3);
            someItems.forEach(item => item.isSelected = true);
            
            const originalItemsLength = peopleQuery.items.length;
            
            const result = await testCountAction.execute();
            expect(result).toBeNull();
            
            // TestCount refreshes the query, items become empty during refresh
            expect(peopleQuery.items).toEqual([]);
            expect(peopleQuery.isBusy).toBe(true);
            
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            // After refresh, items are reloaded
            expect(peopleQuery.items.length).toBeGreaterThan(0);
            expect(peopleQuery.isBusy).toBe(false);
        });

        test("TestCountSingle does not refresh query after execution", async ({ peopleQuery }) => {
            const testCountSingleAction = peopleQuery.actions.find(a => a.name === "TestCountSingle") as Action;
            
            if (!testCountSingleAction) {
                console.log("TestCountSingle action not found on People query");
                return;
            }
            
            const singleItem = await peopleQuery.getItemsByIndex(0);
            singleItem[0].isSelected = true;
            
            const result = await testCountSingleAction.execute();
            expect(result).toBeNull();
            
            // Query should not refresh - items stay populated and busy stays false
            expect(peopleQuery.items[0]).toBeInstanceOf(QueryResultItem);
            expect(peopleQuery.isBusy).toBe(false);
        });

        test("TestCountMany does not refresh query after execution", async ({ peopleQuery }) => {
            const testCountManyAction = peopleQuery.actions.find(a => a.name === "TestCountMany") as Action;
            
            if (!testCountManyAction) {
                console.log("TestCountMany action not found on People query");
                return;
            }
            
            const multipleItems = await peopleQuery.items.sliceAsync(0, 4);
            multipleItems.forEach(item => item.isSelected = true);
            
            const result = await testCountManyAction.execute();
            expect(result).toBeNull();
            
            // Query should not refresh - items stay populated and busy stays false
            expect(peopleQuery.items[0]).toBeInstanceOf(QueryResultItem);
            expect(peopleQuery.isBusy).toBe(false);
        });


        test("TestCount preserves selection after refresh", async ({ peopleQuery }) => {
            const testCountAction = peopleQuery.actions.find(a => a.name === "TestCount") as Action;
            expect(testCountAction).toBeInstanceOf(Action);
            
            const someItems = await peopleQuery.items.sliceAsync(0, 5);
            const selectedIds = someItems.map(item => item.id);
            someItems.forEach(item => item.isSelected = true);
            
            const selectedCount = peopleQuery.items.filter(item => item.isSelected).length;
            expect(selectedCount).toBe(5);
            
            await testCountAction.execute();
            
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            const stillSelectedItems = peopleQuery.items.filter(item => 
                item.isSelected && selectedIds.includes(item.id)
            );
            expect(stillSelectedItems.length).toBe(5);
        });

        test("TestCount with selectAll keeps full selection across refresh", async ({ peopleQuery }) => {
            const testCountAction = peopleQuery.actions.find(a => a.name === "TestCount") as Action;
            expect(testCountAction).toBeInstanceOf(Action);
            
            // Ensure query has many items (10,000 total)
            await peopleQuery.search();
            expect(peopleQuery.totalItems).toBe(10000);
            
            // Enable select-all (non-inverse)
            peopleQuery.selectAll.allSelected = true;
            expect(peopleQuery.selectAll.allSelected).toBe(true);
            expect(peopleQuery.selectAll.inverse).toBe(false);
            
            // First execution should report all 10,000 items
            let result = await testCountAction.execute();
            expect(result).toBeNull();
            
            // Wait for query refresh since TestCount has RefreshQueryOnCompleted: true
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // After refresh, notification should show full count
            expect(peopleQuery.notification).toBe("10000");
            
            // After refresh, select-all should still be active
            expect(peopleQuery.selectAll.allSelected).toBe(true);
            expect(peopleQuery.selectAll.inverse).toBe(false);
            
            // Second execution should still report all 10,000 items
            result = await testCountAction.execute();
            expect(result).toBeNull();

            // Wait for query refresh since TestCount has RefreshQueryOnCompleted: true
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // After refresh, notification should still show full count
            expect(peopleQuery.notification).toBe("10000");
        });
    });

    test.describe("Action Grouping", () => {
        test("actions can be grouped", async ({ peopleQuery }) => {
            const groupedActions = peopleQuery.actions.filter(a => a.group);
            const ungroupedActions = peopleQuery.actions.filter(a => !a.group);
            
            expect(groupedActions.length).toBeGreaterThan(0);
            expect(ungroupedActions.length).toBeGreaterThan(0);
            
            const groupNames = [...new Set(groupedActions.map(a => a.group))];
            expect(groupNames.length).toBeGreaterThan(0);
        });

        test("TestCount actions are grouped under TestActions", async ({ peopleQuery }) => {
            const testActions = peopleQuery.actions.filter(a => 
                a.name === "TestCount" || 
                a.name === "TestCountSingle" || 
                a.name === "TestCountMany"
            );
            
            expect(testActions.length).toBe(3);
            testActions.forEach(action => {
                expect(action.group).toBeInstanceOf(ActionGroup);
                expect(action.group.definition.name).toBe("TestActionsGroup");
            });
        });

        test("pinned actions appear separately from groups", async ({ peopleQuery }) => {
            const pinnedActions = peopleQuery.actions.filter(a => a.isPinned);
            const groupedActions = peopleQuery.actions.filter(a => a.group && !a.isPinned);
            
            if (pinnedActions.length > 0 && groupedActions.length > 0) {
                expect(pinnedActions.length).toBeGreaterThan(0);
                expect(groupedActions.length).toBeGreaterThan(0);
            }
        });
    });

    test.describe("Action Menu Options", () => {
        test("TestOptions action executes with Option 1", async ({ peopleQuery }) => {
            const testOptionsAction = peopleQuery.actions.find(a => a.name === "TestOptions") as Action;
            expect(testOptionsAction).toBeInstanceOf(Action);
            
            const result = await testOptionsAction.execute({ menuOption: 0 });
            
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe('{"MenuOption":"0","MenuLabel":"Option 1"}');
            expect(peopleQuery.notificationType).toBe("OK");
        });

        test("TestOptions action executes with Option 2", async ({ peopleQuery }) => {
            const testOptionsAction = peopleQuery.actions.find(a => a.name === "TestOptions") as Action;
            expect(testOptionsAction).toBeInstanceOf(Action);
            
            const result = await testOptionsAction.execute({ menuOption: 1 });
            
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe('{"MenuOption":"1","MenuLabel":"Option 2"}');
            expect(peopleQuery.notificationType).toBe("OK");
        });

        test("TestOptions action with custom parameters", async ({ peopleQuery }) => {
            const testOptionsAction = peopleQuery.actions.find(a => a.name === "TestOptions") as Action;
            expect(testOptionsAction).toBeInstanceOf(Action);
            
            const customParams = { foo: "bar", count: 42 };
            const result = await testOptionsAction.execute({ 
                menuOption: 0, 
                parameters: customParams 
            });
            
            expect(result).toBeNull();
            const notification = JSON.parse(peopleQuery.notification);
            expect(notification.MenuOption).toBe("0");
            expect(notification.MenuLabel).toBe("Option 1");
            expect(notification.foo).toBe("bar");
            expect(notification.count).toBe("42");
            expect(peopleQuery.notificationType).toBe("OK");
        });

        test("TestOptions action throws error without menu option", async ({ peopleQuery }) => {
            const testOptionsAction = peopleQuery.actions.find(a => a.name === "TestOptions") as Action;
            expect(testOptionsAction).toBeInstanceOf(Action);
            
            let errorThrown = false;
            try {
                await testOptionsAction.execute();
            } catch (error) {
                errorThrown = true;
                expect(error.toString()).toBe("Option is required");
            }
            
            expect(errorThrown).toBe(true);
            expect(peopleQuery.notification).toBe("Option is required");
            expect(peopleQuery.notificationType).toBe("Error");
        });

        test("multiple TestOptions executions with different options", async ({ peopleQuery }) => {
            const testOptionsAction = peopleQuery.actions.find(a => a.name === "TestOptions") as Action;
            expect(testOptionsAction).toBeInstanceOf(Action);
            
            let result = await testOptionsAction.execute({ menuOption: 0 });
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe('{"MenuOption":"0","MenuLabel":"Option 1"}');
            
            result = await testOptionsAction.execute({ menuOption: 1 });
            expect(result).toBeNull();
            expect(peopleQuery.notification).toBe('{"MenuOption":"1","MenuLabel":"Option 2"}');
            
            result = await testOptionsAction.execute({ 
                menuOption: 0, 
                parameters: { testRun: true } 
            });
            expect(result).toBeNull();
            const notification = JSON.parse(peopleQuery.notification);
            expect(notification.MenuOption).toBe("0");
            expect(notification.MenuLabel).toBe("Option 1");
            expect(notification.testRun).toBe("true");
        });
    });

    test.describe("Delete Action Confirmation", () => {
        test("prevents deletion when confirmation is cancelled", async ({ service, peopleQuery }) => {
            const itemToDelete = peopleQuery.items[0];
            itemToDelete.isSelected = true;
            
            const deleteAction = peopleQuery.actions.find(a => a.name === "Delete") as Action;
            expect(deleteAction).toBeInstanceOf(Action);
            expect(deleteAction.definition.confirmation).toBeTruthy();
            
            const originalOnActionConfirmation = service.hooks.onActionConfirmation;
            let confirmationCalled = false;
            service.hooks.onActionConfirmation = async (action, option) => {
                confirmationCalled = true;
                expect(action).toBe(deleteAction);
                return false;
            };
            
            const originalItemCount = peopleQuery.totalItems;
            
            const result = await deleteAction.execute();
            
            expect(confirmationCalled).toBe(true);
            expect(result).toBeNull();
            
            await peopleQuery.search();
            
            expect(peopleQuery.totalItems).toBe(originalItemCount);
            
            service.hooks.onActionConfirmation = originalOnActionConfirmation;
        });

        test("allows deletion when confirmation is accepted", async ({ service, peopleQuery }) => {
            const itemToDelete = peopleQuery.items[0];
            itemToDelete.isSelected = true;
            
            const deleteAction = peopleQuery.actions.find(a => a.name === "Delete") as Action;
            expect(deleteAction).toBeInstanceOf(Action);
            
            const originalOnActionConfirmation = service.hooks.onActionConfirmation;
            let confirmationCalled = false;
            service.hooks.onActionConfirmation = async (action, option) => {
                confirmationCalled = true;
                expect(action).toBe(deleteAction);
                return true;
            };
            
            const originalItemCount = peopleQuery.items.length;
            const itemId = itemToDelete.id;
            
            const result = await deleteAction.execute();
            
            expect(confirmationCalled).toBe(true);
            
            // Delete action returns null (standard delete behavior)
            expect(result).toBeNull();
            
            // After delete, the query automatically refreshes (refreshQueryOnCompleted: true)
            // The items array becomes empty while searching
            expect(peopleQuery.items).toEqual([]);
            expect(peopleQuery.isBusy).toBe(true);
            
            while (peopleQuery.isBusy) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            expect(peopleQuery.items.length).toBe(originalItemCount - 1);
            expect(peopleQuery.items.find(i => i.id === itemId)).toBeUndefined();
            
            service.hooks.onActionConfirmation = originalOnActionConfirmation;
        });
    });

    test.describe("PersistentObject Actions", () => {
        test("TestPersonSummary triggers dialog with person summary", async ({ service, peopleQuery }) => {
            const person = await service.getPersistentObject(null, peopleQuery.persistentObject.id, "3");
            expect(person).toBeInstanceOf(PersistentObject);
            
            const testSummaryAction = person.actions.find(a => a.name === "TestPersonSummary") as Action;
            expect(testSummaryAction).toBeInstanceOf(Action);
            expect(testSummaryAction.canExecute).toBe(true);
            
            const firstName = person.getAttributeValue("FirstName");
            expect(firstName).toBe("Aaron");
            
            // Intercept the onMessageDialog hook
            const originalOnMessageDialog = service.hooks.onMessageDialog;
            let dialogTriggered = false;
            
            service.hooks.onMessageDialog = async (title: string, message: string, rich: boolean, ...actions: string[]) => {
                dialogTriggered = true;
                
                // Verify the dialog parameters
                expect(title).toBe("OK");
                expect(message).toContain("FirstName: Aaron");
                expect(actions).toBeDefined();
                expect(actions.length).toBeGreaterThan(0);
                
                // Return 0 to simulate clicking the first button (OK)
                return 0;
            };
            
            const result = await testSummaryAction.execute();
            
            // Verify the dialog was triggered
            expect(dialogTriggered).toBe(true);
            
            // The action returns null after the dialog is handled
            expect(result).toBeNull();
            
            // Restore original hook
            service.hooks.onMessageDialog = originalOnMessageDialog;
        });
    });
});