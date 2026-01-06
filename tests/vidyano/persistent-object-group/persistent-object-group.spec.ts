import { test, expect, Page, Locator } from '@playwright/test';
import { setupPage } from '../_helpers/page';
import { startBackend, stopBackend, BackendProcess } from '../_helpers/backend';

let backend: BackendProcess | undefined;

test.describe.serial('PersistentObjectGroup', () => {
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

    async function setupGroup(
        poType: string = 'Mock_Item',
        groupIndex: number = 0,
        columns: number = 1
    ): Promise<Locator> {
        const componentId = `group-${Math.random().toString(36).substring(2, 15)}`;

        await sharedPage.waitForFunction(
            (tag) => !!customElements.get(tag),
            'vi-persistent-object-group',
            { timeout: 10000 }
        );

        await sharedPage.evaluate(async ({ componentId, poType, groupIndex, columns }) => {
            const objectId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            const po = await (window as any).service.getPersistentObject(null, poType, objectId);

            const container = document.getElementById('test-container');
            if (!container)
                throw new Error('Test container not found');

            const group = document.createElement('vi-persistent-object-group');
            group.id = componentId;
            (group as any).group = po.tabs[0].groups[groupIndex];
            (group as any).groupIndex = groupIndex;
            (group as any).columns = columns;

            container.appendChild(group);

            await (group as any).updateComplete;

            // Wait for arrange to complete (uses requestAnimationFrame)
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

            if (!(window as any).groupMap)
                (window as any).groupMap = {};
            (window as any).groupMap[componentId] = { group, po };
        }, { componentId, poType, groupIndex, columns });

        return sharedPage.locator(`#${componentId}`);
    }

    async function getGridAreas(group: Locator): Promise<string> {
        return group.evaluate((el) => {
            return getComputedStyle(el).getPropertyValue('--vi-persistent-object-group--grid-areas').trim();
        });
    }

    test.describe('Label', () => {
        test('computes label from group', async () => {
            const group = await setupGroup('Mock_Item', 0);

            const label = await group.evaluate((el) => (el as any).label);

            expect(label).toBe('First Group');
        });

        test('custom label overrides computed value', async () => {
            const group = await setupGroup('Mock_Item', 0);

            await group.evaluate((el) => {
                (el as any).label = 'Custom Label';
            });

            const label = await group.evaluate((el) => (el as any).label);

            expect(label).toBe('Custom Label');
        });

        test('renders custom label in template', async () => {
            const group = await setupGroup('Mock_Item', 0);

            await group.evaluate((el) => {
                (el as any).label = 'My Custom Label';
            });

            await group.evaluate((el) => (el as any).updateComplete);

            const labelText = await group.locator('> label').textContent();

            expect(labelText).toBe('My Custom Label');
        });
    });

    test.describe('Grid Layout', () => {
        test.describe('Sequential Attributes', () => {
            test('stacks 4 attributes vertically in single column', async () => {
                // Expected layout (1 column):
                // ┌───┐
                // │ A │
                // ├───┤
                // │ B │
                // ├───┤
                // │ C │
                // ├───┤
                // │ D │
                // └───┘
                const group = await setupGroup('Grid_Sequential', 0, 1);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A" "B" "C" "D"');
            });

            test('flows 4 attributes across 2 columns', async () => {
                // Expected layout (2 columns):
                // ┌───┬───┐
                // │ A │ B │
                // ├───┼───┤
                // │ C │ D │
                // └───┴───┘
                const group = await setupGroup('Grid_Sequential', 0, 2);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A B" "C D"');
            });

            test('flows 4 attributes across 3 columns', async () => {
                // Expected layout (3 columns):
                // ┌───┬───┬───┐
                // │ A │ B │ C │
                // ├───┼───┴───┘
                // │ D │
                // └───┘
                const group = await setupGroup('Grid_Sequential', 0, 3);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A B C" "D . ."');
            });

            test('flows 4 attributes across 4 columns', async () => {
                // Expected layout (4 columns):
                // ┌───┬───┬───┬───┐
                // │ A │ B │ C │ D │
                // └───┴───┴───┴───┘
                const group = await setupGroup('Grid_Sequential', 0, 4);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A B C D"');
            });
        });

        test.describe('Column Span', () => {
            test('attribute with columnSpan=2 spans two columns in 3-column layout', async () => {
                // Expected layout (3 columns):
                // ┌───┬───────────┐
                // │ A │   Wide    │
                // ├───┴───────────┤
                // │ B │   .   │ . │
                // └───┴───────┴───┘
                const group = await setupGroup('Grid_ColumnSpan', 0, 3);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A Wide Wide" "B . ."');
            });

            test('columnSpan=2 wraps to next row when no space in 2-column layout', async () => {
                // Wide has columnSpan=2, A is in column 0
                // Wide doesn't fit next to A, so wraps to next row
                // Expected layout (2 columns):
                // ┌───┬───┐
                // │ A │ . │
                // ├───┴───┤
                // │ Wide  │
                // ├───┬───┤
                // │ B │ . │
                // └───┴───┘
                const group = await setupGroup('Grid_ColumnSpan', 0, 2);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A ." "Wide Wide" "B ."');
            });
        });

        test.describe('Row Span (Height)', () => {
            test('attribute with Height=2 spans two rows', async () => {
                // Expected layout (3 columns):
                // ┌──────┬───┬───┐
                // │ Tall │ A │ B │
                // │      ├───┴───┘
                // │      │
                // └──────┘
                const group = await setupGroup('Grid_RowSpan', 0, 3);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"Tall A B" "Tall . ."');
            });

            test('attribute with Height=2 in 2-column layout', async () => {
                // Expected layout (2 columns):
                // ┌──────┬───┐
                // │ Tall │ A │
                // │      ├───┤
                // │      │ B │
                // └──────┴───┘
                const group = await setupGroup('Grid_RowSpan', 0, 2);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"Tall A" "Tall B"');
            });
        });

        test.describe('Large Attribute (2x2)', () => {
            test('2x2 attribute occupies correct grid area in 3-column layout', async () => {
                // Big has columnSpan=2, Height=2
                // Expected layout (3 columns):
                // ┌───────────┬───┐
                // │    Big    │ A │
                // │           ├───┤
                // │           │ B │
                // └───────────┴───┘
                const group = await setupGroup('Grid_Large', 0, 3);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"Big Big A" "Big Big B"');
            });
        });

        test.describe('Explicit Column Position', () => {
            test('positioned attribute placed in specified column', async () => {
                // Fixed has Column=2 (third column, 0-indexed)
                // Expected layout (3 columns):
                // ┌───┬───┬───────┐
                // │ A │ . │ Fixed │
                // ├───┼───┴───────┤
                // │ B │
                // └───┘
                const group = await setupGroup('Grid_Positioned', 0, 3);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A . Fixed" "B . ."');
            });
        });

        test.describe('Hidden Attributes', () => {
            test('hidden attributes are not included in grid', async () => {
                // X has Visibility=Never, should not appear
                // Expected layout (3 columns):
                // ┌───┬───┬───┐
                // │ A │ B │ . │
                // └───┴───┴───┘
                const group = await setupGroup('Grid_Hidden', 0, 3);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A B ."');
                expect(areas).not.toContain('X');
            });
        });

        test.describe('Area Name Sanitization', () => {
            test('special characters in attribute name are sanitized', async () => {
                // "Test-Name_123" should become "Test_Name_123" (hyphen replaced)
                const group = await setupGroup('Grid_Sanitize', 0, 1);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"Test_Name_123"');
                expect(areas).not.toContain('-');
            });
        });

        test.describe('Full Width', () => {
            test('columnSpan=3 spans all columns in 3-column layout', async () => {
                // Full has columnSpan=3
                // Expected layout (3 columns):
                // ┌───┬───┬───┐
                // │ A │ . │ . │
                // ├───┴───┴───┤
                // │   Full    │
                // ├───┬───┬───┤
                // │ B │ . │ . │
                // └───┴───┴───┘
                const group = await setupGroup('Grid_FullWidth', 0, 3);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A . ." "Full Full Full" "B . ."');
            });

            test('columnSpan=3 is clamped to 2 in 2-column layout', async () => {
                // Full has columnSpan=3, but only 2 columns available
                // Expected layout (2 columns):
                // ┌───┬───┐
                // │ A │ . │
                // ├───┴───┤
                // │ Full  │
                // ├───┬───┤
                // │ B │ . │
                // └───┴───┘
                const group = await setupGroup('Grid_FullWidth', 0, 2);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"A ." "Full Full" "B ."');
            });
        });

        test.describe('Column Count Changes', () => {
            test('re-arranges when column count changes from 1 to 2', async () => {
                const group = await setupGroup('Grid_Sequential', 0, 1);

                const areas1col = await getGridAreas(group);
                expect(areas1col).toBe('"A" "B" "C" "D"');

                // Change to 2 columns
                await group.evaluate(async (el) => {
                    (el as any).columns = 2;
                    await (el as any).updateComplete;
                    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                });

                const areas2col = await getGridAreas(group);
                expect(areas2col).toBe('"A B" "C D"');
            });
        });

        test.describe('Infinite Height (Height=0)', () => {
            test('infinite height attribute fills column down and extends beyond other attributes', async () => {
                // Infinite has Height=0, fills all rows in its column including an extra row
                // Expected layout (3 columns):
                // ┌──────────┬───┬───┐
                // │ Infinite │ A │ B │
                // │          ├───┼───┤
                // │          │ C │ . │
                // │          ├───┴───┤
                // │          │   .   │
                // └──────────┴───────┘
                const group = await setupGroup('Grid_InfiniteHeight', 0, 3);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"Infinite A B" "Infinite C ." "Infinite . ."');
            });

            test('infinite height in 2-column layout', async () => {
                // Expected layout (2 columns):
                // ┌──────────┬───┐
                // │ Infinite │ A │
                // │          ├───┤
                // │          │ B │
                // │          ├───┤
                // │          │ C │
                // │          ├───┤
                // │          │ . │
                // └──────────┴───┘
                const group = await setupGroup('Grid_InfiniteHeight', 0, 2);

                const areas = await getGridAreas(group);

                expect(areas).toBe('"Infinite A" "Infinite B" "Infinite C" "Infinite ."');
            });
        });
    });

    test.describe('Size Tracker Initialization', () => {
        test('computes columns when starting at zero height then resizing', async () => {
            const componentId = `group-${Math.random().toString(36).substring(2, 15)}`;

            // Start at 0 height - without trigger-zero, sizechanged won't fire
            await sharedPage.evaluate(async ({ componentId }) => {
                const po = await (window as any).service.getPersistentObject(null, 'Grid_Sequential', `${Date.now()}`);

                const container = document.getElementById('test-container');
                if (!container)
                    throw new Error('Test container not found');

                const group = document.createElement('vi-persistent-object-group') as any;
                group.id = componentId;
                group.style.width = '800px';
                group.style.height = '0px';
                group.style.display = 'block';
                group.group = po.tabs[0].groups[0];
                group.groupIndex = 0;

                container.appendChild(group);

                await group.updateComplete;
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }, { componentId });

            const group = sharedPage.locator(`#${componentId}`);

            // At 0 height, columns should still be computed with trigger-zero
            // Without trigger-zero, _computedColumns would be undefined
            let columns = await group.evaluate((el) => (el as any)._computedColumns);
            expect(columns).toBeDefined();
            expect(columns).toBe(2); // 800px width should give 2 columns

            // Now resize to have height
            await group.evaluate(async (el) => {
                el.style.height = '200px';
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });

            columns = await group.evaluate((el) => (el as any).columns);
            expect(columns).toBe(2); // Still 2 columns
        });
    });

    test.describe('Visibility Change Reactivity', () => {
        test('re-arranges grid when attribute visibility changes from Never to Always', async () => {
            // Start with Grid_Hidden which has X attribute with visibility="Never"
            // Grid starts as: A, B (X is hidden)
            const group = await setupGroup('Grid_Hidden', 0, 3);

            // Verify X is not in the grid initially
            const initialAreas = await getGridAreas(group);
            expect(initialAreas).toBe('"A B ."');
            expect(initialAreas).not.toContain('X');

            // Change X's visibility to "Always" - this should trigger _arrange()
            await group.evaluate(async (el) => {
                const groupData = (el as any).group;
                const attrX = groupData.attributes.find((a: any) => a.name === 'X');
                if (!attrX)
                    throw new Error('Attribute X not found');

                // Change visibility from "Never" to "Always"
                attrX.visibility = 'Always';

                // Wait for the component to update
                await (el as any).updateComplete;
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });

            // The grid should now include X
            const updatedAreas = await getGridAreas(group);
            expect(updatedAreas).toContain('X');
            expect(updatedAreas).toBe('"A X B"');
        });

        test('re-arranges grid when attribute visibility changes from Always to Never', async () => {
            // Start with Grid_Sequential which has all visible attributes
            const group = await setupGroup('Grid_Sequential', 0, 2);

            // Verify initial state
            const initialAreas = await getGridAreas(group);
            expect(initialAreas).toBe('"A B" "C D"');

            // Hide attribute B
            await group.evaluate(async (el) => {
                const groupData = (el as any).group;
                const attrB = groupData.attributes.find((a: any) => a.name === 'B');
                if (!attrB)
                    throw new Error('Attribute B not found');

                // Change visibility to "Never"
                attrB.visibility = 'Never';

                await (el as any).updateComplete;
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            });

            // B should be removed from the grid
            const updatedAreas = await getGridAreas(group);
            expect(updatedAreas).not.toContain('B');
            expect(updatedAreas).toBe('"A C" "D ."');
        });
    });

    test.describe('Columns Auto/Override', () => {
        async function setupGroupWithWidth(
            width: number,
            customColumns?: number
        ): Promise<Locator> {
            const componentId = `group-${Math.random().toString(36).substring(2, 15)}`;

            await sharedPage.waitForFunction(
                (tag) => !!customElements.get(tag),
                'vi-persistent-object-group',
                { timeout: 10000 }
            );

            await sharedPage.evaluate(async ({ componentId, width, customColumns }) => {
                const po = await (window as any).service.getPersistentObject(null, 'Grid_Sequential', `${Date.now()}`);

                const container = document.getElementById('test-container');
                if (!container)
                    throw new Error('Test container not found');

                const group = document.createElement('vi-persistent-object-group') as any;
                group.id = componentId;
                group.style.width = `${width}px`;
                group.style.display = 'block';
                group.group = po.tabs[0].groups[0];
                group.groupIndex = 0;

                if (customColumns !== undefined)
                    group.setAttribute('columns', String(customColumns));

                container.appendChild(group);

                await group.updateComplete;
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

                if (!(window as any).groupMap)
                    (window as any).groupMap = {};
                (window as any).groupMap[componentId] = { group, po };
            }, { componentId, width, customColumns });

            return sharedPage.locator(`#${componentId}`);
        }

        test('auto-computes 1 column for width <= 500', async () => {
            const group = await setupGroupWithWidth(400);

            const columns = await group.evaluate((el) => (el as any).columns);

            expect(columns).toBe(1);
        });

        test('auto-computes 2 columns for width > 500 and <= 1000', async () => {
            const group = await setupGroupWithWidth(800);

            const columns = await group.evaluate((el) => (el as any).columns);

            expect(columns).toBe(2);
        });

        test('auto-computes 3 columns for width > 1000 and < 1500', async () => {
            const group = await setupGroupWithWidth(1200);

            const columns = await group.evaluate((el) => (el as any).columns);

            expect(columns).toBe(3);
        });

        test('auto-computes 4 columns for width >= 1500', async () => {
            const group = await setupGroupWithWidth(1600);

            const columns = await group.evaluate((el) => (el as any).columns);

            expect(columns).toBe(4);
        });

        test('custom columns attribute overrides auto-computed value', async () => {
            // Width would normally give 3 columns, but we set 2
            const group = await setupGroupWithWidth(1200, 2);

            const columns = await group.evaluate((el) => (el as any).columns);
            const customColumns = await group.evaluate((el) => (el as any)._customColumns);

            expect(columns).toBe(2);
            expect(customColumns).toBe(2);
        });

        test('setting columns property overrides auto-computed value', async () => {
            const group = await setupGroupWithWidth(1200); // Would be 3 columns

            await group.evaluate((el) => {
                (el as any).columns = 1;
            });

            const columns = await group.evaluate((el) => (el as any).columns);

            expect(columns).toBe(1);
        });

        test('setting columns to undefined falls back to auto-computed', async () => {
            const group = await setupGroupWithWidth(1200, 2); // Custom 2, would be 3

            // Verify custom is active
            let columns = await group.evaluate((el) => (el as any).columns);
            expect(columns).toBe(2);

            // Set to undefined to fall back to auto
            await group.evaluate(async (el) => {
                (el as any).columns = undefined;
                await (el as any).updateComplete;
            });

            columns = await group.evaluate((el) => (el as any).columns);
            const customColumns = await group.evaluate((el) => (el as any)._customColumns);

            expect(customColumns).toBeUndefined();
            expect(columns).toBe(3); // Auto-computed based on 1200px width
        });

        test('removing columns attribute falls back to auto-computed', async () => {
            const group = await setupGroupWithWidth(1200, 2); // Custom 2, would be 3

            // Verify custom is active
            let columns = await group.evaluate((el) => (el as any).columns);
            expect(columns).toBe(2);

            // Remove attribute to fall back to auto
            await group.evaluate(async (el) => {
                el.removeAttribute('columns');
                await (el as any).updateComplete;
            });

            columns = await group.evaluate((el) => (el as any).columns);
            const customColumns = await group.evaluate((el) => (el as any)._customColumns);

            expect(customColumns).toBeUndefined();
            expect(columns).toBe(3); // Auto-computed based on 1200px width
        });

        test('respects custom CSS breakpoints', async () => {
            const group = await setupGroupWithWidth(600);

            // Default breakpoint for 2 columns is > 500, so 600px = 2 columns
            let columns = await group.evaluate((el) => (el as any).columns);
            expect(columns).toBe(2);

            // Change breakpoint so 600px now gives 1 column
            // Need to change width to force recalculation, then change back
            await group.evaluate(async (el) => {
                el.style.setProperty('--vi-persistent-object-group-columns-2-min-width', '700');
                // Reset internal width to force recalculation
                (el as any)._width = 0;
                el.style.width = '601px'; // Trigger resize
            });

            // Wait for size tracker to fire
            await group.evaluate(async (el) => {
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                await (el as any).updateComplete;
            });

            columns = await group.evaluate((el) => (el as any).columns);
            expect(columns).toBe(1);
        });
    });
});
