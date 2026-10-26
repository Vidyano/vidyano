import { expect, Locator } from '@playwright/test';
import { columnTracks, gridPage, headerNames, pageErrors, test } from '../_helpers/query-grid';
import { CellInfo, keepColumns, loadQuery, mountLoaded, patchItems, readCells, samplePixels, setDtoValue, wheelGrid } from '../_helpers/cells';

const BLACK_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC';
const RED_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const BLUE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** The raw Image service string of the given items (null when the item has none). */
async function rawImages(grid: Locator, indexes: number[]) {
    return grid.evaluate((g: any, indexes) => {
        const q = g.query;
        const lazy = q.disableLazyLoading;
        q.disableLazyLoading = true;
        try {
            return indexes.map(i => q.items[i]?.getFullValue('Image')?.value || null);
        }
        finally {
            q.disableLazyLoading = lazy;
        }
    }, indexes);
}

/** The data URI of the visible image in the cell, or null when no image is visible. */
function shownImage(cell: CellInfo) {
    const visible = cell.images.filter(i => i.visible);
    expect(visible.length, `${cell.column} shows at most one image`).toBeLessThanOrEqual(1);
    if (!visible.length)
        return null;

    return visible[0].kind === 'img' ? visible[0].value : /^url\("?(.*?)"?\)$/.exec(visible[0].value)?.[1] ?? visible[0].value;
}

test.describe('Rendering', () => {
    test('a PNG base64 value renders as a data-URI image', { annotation: [{ type: 'case', description: 'cells.img-png' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Image']);
        const grid = await mountLoaded(page);

        const [raw] = await rawImages(grid, [0]);
        expect(raw).toMatch(/^iVBORw0KGgo/);

        const image = (await readCells(grid)).find(r => r.index === 0)!.cells.Image;
        expect(image.tag).toBe('vi-query-grid-cell-image');
        expect(shownImage(image)).toBe(`data:image/png;base64,${raw}`);
    });

    test('the mime type is sniffed from the base64 prefix', { annotation: [{ type: 'case', description: 'cells.img-mime' }] }, async ({ page }) => {
        const values: Record<string, [string, string]> = {
            '1': ['/9j/4AAQSkZJRgABAQAAAQABAAD', 'image/jpeg'],
            '2': ['R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'image/gif'],
            '3': ['Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==', 'image/bmp'],
            '4': ['PD94bWwgdmVyc2lvbj0iMS4wIj8+PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=', 'image/svg+xml']
        };
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id && values[id])
                setDtoValue(item, 'Image', values[id][0]);
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Image']);
        const grid = await mountLoaded(page);

        const byId = Object.fromEntries((await readCells(grid)).map(r => [r.cells.Id.text, r.cells.Image]));
        for (const [id, [value, mime]] of Object.entries(values))
            expect(shownImage(byId[id]), `Image of Id ${id}`).toBe(`data:${mime};base64,${value}`);
    });

    test('the image is scaled to row height and centered', { annotation: [{ type: 'case', description: 'cells.img-sizing' }] }, async ({ page }) => {
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '1')
                setDtoValue(item, 'Image', BLACK_PNG);
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Image']);
        await page.evaluate(() => (window as any).q.getColumn('Image').width = '120px');
        const grid = await mountLoaded(page);

        const cell = (await readCells(grid)).find(r => r.cells.Id.text === '1')!.cells.Image;
        expect(Math.abs(cell.box.width - 120)).toBeLessThanOrEqual(1);
        expect(Math.round(cell.box.height)).toBe(32);

        const clip = { x: cell.box.left, y: cell.box.top, width: cell.box.width, height: cell.box.height };
        const png = await page.screenshot({ clip });
        const cx = clip.width / 2;
        const cy = clip.height / 2;
        const [center, insideLeft, insideRight, outsideLeft, outsideRight, edge] = await samplePixels(page, png, [
            { x: cx, y: cy }, { x: cx - 13, y: cy }, { x: cx + 13, y: cy }, { x: cx - 19, y: cy }, { x: cx + 19, y: cy }, { x: 10, y: cy }
        ]);
        const isBlack = (p: number[]) => p[0] < 40 && p[1] < 40 && p[2] < 40;
        expect(isBlack(center), `center ${center}`).toBe(true);
        expect(isBlack(insideLeft) && isBlack(insideRight), 'the square is 32px wide').toBe(true);
        expect(isBlack(outsideLeft) || isBlack(outsideRight), 'nothing is drawn outside the 32px square').toBe(false);
        expect(isBlack(edge), `pixel 10px from the left ${edge}`).toBe(false);
    });

    test('the image column width comes from its header', { annotation: [{ type: 'case', description: 'cells.img-column-width' }] }, async ({ page }) => {
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Image']);
        const grid = await mountLoaded(page);

        const names = await headerNames(grid);
        const track = (await columnTracks(grid))[names.indexOf('Image')];
        const header = await grid.evaluate((g: any) => (g.shadowRoot.querySelector('vi-query-grid-column-header[name="Image"]') as HTMLElement).getBoundingClientRect().width);
        expect(Math.abs(track - header)).toBeLessThanOrEqual(1);

        const rows = await readCells(grid);
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            const image = row.cells.Image;
            expect([image.hostStyle['padding-left'], image.hostStyle['padding-right']], `Id ${row.cells.Id.text}`).toEqual(['1px', '1px']);
            expect(Math.abs(image.box.width - track), `Id ${row.cells.Id.text}`).toBeLessThanOrEqual(1);
        }
    });
});

test.describe('Empty and unknown values', () => {
    test('an empty or null image shows nothing', { annotation: [{ type: 'case', description: 'cells.img-empty' }] }, async ({ page }) => {
        // Id 2 has a null Image; Id 3 has none either in the data, so its response carries an empty string
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '3')
                setDtoValue(item, 'Image', '');
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Image']);
        const grid = await mountLoaded(page);

        const raw = await grid.evaluate((g: any) => {
            const q = g.query;
            const lazy = q.disableLazyLoading;
            q.disableLazyLoading = true;
            try {
                const value = (id: string) => q.items.find((i: any) => i && String(i.getValue('Id')) === id)?.getFullValue('Image')?.value;
                return [value('2'), value('3')];
            }
            finally {
                q.disableLazyLoading = lazy;
            }
        });
        expect(raw[0] == null, 'Id 2 Image is null').toBe(true);
        expect(raw[1], 'Id 3 Image is an empty string').toBe('');

        const rows = await readCells(grid);
        const byId = Object.fromEntries(rows.map(r => [r.cells.Id.text, r.cells.Image]));
        expect(shownImage(byId['1'])).not.toBeNull();
        for (const id of ['2', '3']) {
            expect(shownImage(byId[id]), `Id ${id}`).toBeNull();
            expect(Math.abs(byId[id].box.width - byId['1'].box.width), `Id ${id} keeps the column width`).toBeLessThanOrEqual(1);
            expect(byId[id].box.width).toBeGreaterThan(0);
        }
    });

    test('an unknown image format renders nothing without error', { annotation: [{ type: 'case', description: 'cells.img-unknown' }] }, async ({ page }) => {
        // A 1x1 WebP: not one of the sniffed formats
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id === '1')
                setDtoValue(item, 'Image', 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=');
        });
        const errors = pageErrors(page);
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Image']);
        const grid = await mountLoaded(page);

        const byId = Object.fromEntries((await readCells(grid)).map(r => [r.cells.Id.text, r.cells.Image]));
        expect(byId['1'].images.filter(i => i.visible && /data:/.test(i.value))).toEqual([]);
        expect(shownImage(byId['5'])).toMatch(/^data:image\/png;base64,/);
        expect(errors).toEqual([]);
    });
});

test.describe('Recycling', () => {
    test('images follow their items through recycling', { annotation: [{ type: 'case', description: 'cells.img-recycle' }] }, async ({ page }) => {
        // Generated rows alternate a red PNG, no image and a blue PNG (patched into the responses)
        await patchItems(page, 'QueryGrid_DataTypes', (item, id) => {
            if (id == null || parseInt(id) < 13)
                return;

            setDtoValue(item, 'Image', [RED_PNG, null, BLUE_PNG][parseInt(id) % 3]);
        });
        await gridPage(page);
        await loadQuery(page, 'QueryGrid_DataTypes');
        await keepColumns(page, ['Id', 'Text', 'Image']);
        const grid = await mountLoaded(page);

        const seen = { red: 0, blue: 0, none: 0 };
        const check = async () => {
            const rows = await readCells(grid);
            const raws = await rawImages(grid, rows.map(r => r.index));
            rows.forEach((row, i) => {
                const shown = shownImage(row.cells.Image);
                expect(shown, `Image of Id ${row.cells.Id.text}`).toBe(raws[i] ? `data:image/png;base64,${raws[i]}` : null);
                if (parseInt(row.cells.Id.text) >= 13)
                    seen[raws[i] === RED_PNG ? 'red' : raws[i] === BLUE_PNG ? 'blue' : 'none']++;
            });
        };

        await check();
        for (const delta of [20 * 32, 20 * 32 + 16, 7 * 32, -(13 * 32), -(20 * 32)]) {
            await wheelGrid(page, grid, delta);
            await check();
        }

        expect(seen.red).toBeGreaterThan(0);
        expect(seen.blue).toBeGreaterThan(0);
        expect(seen.none).toBeGreaterThan(0);
    });
});
