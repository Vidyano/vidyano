# vi-query-grid tests

Playwright tests that lock in the behavior of `vi-query-grid`: its rows, cells, headers, filters, grouping, selection, scrolling, user settings and the app views that use it. Every test has a `case` annotation with a unique id (`<area>.<name>`, e.g. `grid.ct-scroll-to-end`).

| Folder | What it covers |
|---|---|
| `cells/` | The cell templates (`vi-query-grid-cell-*`) and `QueryGridColumn` |
| `filters/` | The column filter popup, the filters menu, saved filters, the filter dialog and the grouping menu |
| `grid/` | The grid host: initialization, layout, column widths and settings, virtual and horizontal scrolling, continuation paging, grouping, selection, reordering, max rows, query swaps and scroll restore |
| `header/` | Column headers, the configure dialog and `QueryGridUserSettings` |
| `rows/` | `vi-query-grid-row`, the group rows, the footer and select-all |
| `views/` | The grid on the real app views: rendering, routing, selection, sort and search, the select reference dialog and screenshots |
| `perf/` | Performance: DOM and request counts, frame timings, layout work, recycling and leaks |

Most specs mount a grid on a bare test page (`gridPage` + `mountGrid`); the `views/` specs open the real app (`openView`). The tests use public API, real input, rendered DOM and the network only.

A new page costs about as much as a typical test, so the specs share one per worker: the bare-page specs take `test` from `_helpers/query-grid` and `gridPage` resets the page in place (a new body, styles, service and app, without the window globals and the document and window listeners the last test added); `views/rendering.spec.ts` takes `test` from `_helpers/views` and `showView` shows each view on one booted app. A test that adds init scripts, exposes functions or installs the clock gets a freshly loaded page, and the page is replaced after it, as after a test that adds style or script tags; a test with other context options (`test.use({ hasTouch: true })`) gets a page of its own. `test.use({ freshPage: true })` gives a spec a new page per test.

## Helpers

| File | Contents |
|---|---|
| `_helpers/query-grid.ts` | Shared: the base URL (`BASE`), the `test` that shares the bare grid page, the bare grid page, mounting a grid, waiting for it to be ready, scrolling, the request log, saved user settings and opening app views (`VIEWS`) |
| `_helpers/grid.ts` | Grid host specs: column tracks and tokens, header and row boxes, the `initializing` watcher, wheel scrolling and holding `ExecuteQuery` requests |
| `_helpers/cells.ts` | Cell specs: loading a query without a grid, reading cells and their computed styles |
| `_helpers/rows.ts` | Row specs: finding the row or group row of an item, selection and select-all state, holding page loads, and the context menu |
| `_helpers/header.ts` | Header specs: the sort icon, the column menu, the configure dialog and its rows, column resizing and the stored grid settings |
| `_helpers/filters.ts` | Filter specs: opening a column filter, its distinct rows, the filters menu, saved filters and the filter log |
| `_helpers/views.ts` | App view specs: the `test` and `showView` that share one app, `VIEW_MATRIX` with the expected values per view, header and cell alignment, row boxes, the column and grouping menus and the reference dialog |
| `_helpers/perf.ts` | Perf specs: the perf `test` (it fails a test that writes shared server state), the metrics JSON (`recordPerf`), frame and long task sampling, CDP metrics and the 60fps frame budget |

## Running

The specs use the dev backend (`npm run dev`, http://localhost:5000; a worktree's supervisor runs get a backend of their own) and the views below. Run them through the dev supervisor:

```bash
npm run test:dev -- packages/vidyano/tests/query-grid                                    # everything but the @timing tests
npm run test:dev -- packages/vidyano/tests/query-grid/grid/continuation.spec.ts          # one spec
npm run test:dev -- --project=vidyano-perf packages/vidyano/tests/query-grid/perf        # the @timing tests, alone on one worker
```

- The grid specs run in the `vidyano` project with 4 workers, perf/ included, but without the tests tagged `@timing` (wall-clock and frame timings); `vidyano-perf` runs only those, with 1 worker and no retries, and only when nothing else runs.
- Run core and grid specs in separate runs: core specs reset the shared data under the grid specs.
- Each perf test writes its metrics to `perf-results/<case id>.json` (gitignored; Playwright empties `test-results/` on every run) and attaches them to the test.
- The screenshot specs (`views/screenshots.spec.ts`, `views/select-reference-dialog.spec.ts`) have Windows baselines only and are skipped on other platforms.

## Test data

The dev backend (`dev/`) has read-only views for these tests. They live in **Components → Query Grid**, after the 7 existing `QueryGrid_*` views (those and `People` are unchanged: 10,000 people, first row `Aaron Lemmens`).

All data is in memory and rebuilt by `DevContext.Initialize()`. It runs on backend startup and on every `PersistentObject.ResetTest`. Generated rows come from Bogus with fixed seeds, so values are the same on every run and machine.

| View (menu title) | Query name | Route (`routes.queries` key) | App path | Rows |
|---|---|---|---|---|
| Data types | `QueryGrid_DataTypes` | `query-grid_data-types` | `components/query-grid_data-types` | 212 (12 fixed + 200 generated) |
| Column options | `QueryGrid_ColumnOptions` | `query-grid_column-options` | `components/query-grid_column-options` | 10,000 (People) |
| Big (150k) | `PeopleBig` | `people-big` | `components/people-big` | 150,000 |
| Wide (60 columns) | `QueryGrid_Wide` | `query-grid_wide` | `components/query-grid_wide` | 2,000 |
| Reorder | `QueryGrid_Reorder` | `query-grid_reorder` | `components/query-grid_reorder` | 12 |
| Reorder (250) | `QueryGrid_ReorderLarge` | `query-grid_reorder-large` | `components/query-grid_reorder-large` | 250 |
| Continuation (unknown total) | `QueryGrid_Continuation` | `query-grid_continuation` | `components/query-grid_continuation` | 1,234 (paged with continuation tokens; the total is unknown until the last page) |

Where the code is:
- Model: `dev/App_Data/Model/Dev/GridDataType.json`, `WideRow.json`, `ReorderItem.json`, `ContinuationRow.json`, plus 2 queries in `Person.json`, and the menu items in `dev/App_Data/programUnits.json`.
- Entities: `dev/Service/Model/GridDataType.cs`, `WideRow.cs`, `ReorderItem.cs`, `ContinuationRow.cs`.
- Data: `dev/Service/DevContext.QueryGrid.cs`, called from `DevContext.Initialize()`.
- Actions: `dev/Service/Actions/GridDataTypeActions.cs`, `WideRowActions.cs`, `ReorderItemActions.cs`, `ContinuationRowActions.cs`, `QueryGridTestData.cs` (shared helpers), and the `ColumnOptions` / `PeopleBig` parts of `PersonActions.cs`.

### Seeds

| Data | Seed |
|---|---|
| People (existing, unchanged) | `Randomizer.Seed = new Random(6841844)` |
| `QueryGrid_DataTypes` generated rows | `Faker<GridDataType>("en").UseSeed(1001)` |
| `QueryGrid_Wide` | `Faker<WideRow>("en").UseSeed(1002)` |
| `QueryGrid_Reorder` | `Faker<ReorderItem>("en").UseSeed(1003)` |
| `QueryGrid_ReorderLarge` | `Faker<ReorderItem>("en").UseSeed(1004)` |
| `QueryGrid_Continuation` | `Faker<ContinuationRow>("en").UseSeed(1005)` |
| `PeopleBig` | no own seed: a projection of the seeded People |

Each faker uses its own seed (`UseSeed`) and runs after People is generated. Changing one dataset does not shift the others.

### Read-only

- The queries over the new entities have no `New`, `BulkEdit` or `Delete` (`DisableBulkEdit` is set). Their remaining actions are `Filter` plus the client-side `viConfigureQuery` and `RefreshQuery`.
- Opening a row gives a read-only persistent object (`IsReadOnly = true`).
- Saving or deleting on the server throws `This test data is read-only.`
- `PeopleBig` has no `New`, `BulkEdit`, `Delete`, `NewPersonWizard` or `SendEmail`. The custom `Test*` actions are still there.
- `QueryGrid_ColumnOptions` keeps the default People actions, so it can still mutate People. Do not run those actions in tests.

### QueryGrid_DataTypes

The columns are shown in this order. The default sort is `Id`, the first sortable column, so the fixed rows come first.

| Column | Type | Column type hints / flags |
|---|---|---|
| `Id` | Int32 | |
| `Text` | String | DisplaySum (only so it can hold the "Total" label) |
| `MultiLine` | MultiLineString | |
| `Int32` | Int32 | DisplaySum |
| `NullableInt32` | NullableInt32 | |
| `Decimal` | Decimal | DisplaySum |
| `DecimalFormatted` (label "Decimal (N2)") | Decimal | `displayformat={0:N2}` |
| `Double` | Double | |
| `Int64` | Int64 | |
| `DateTime` | DateTime | |
| `DateTimeOffset` | DateTimeOffset | |
| `Time` | Time | |
| `NullableDate` | NullableDate | |
| `NullableBoolean` (label "Nullable boolean (hints)") | NullableBoolean | `truekey=OK`, `falsekey=Cancel`, `nullkey=Unknown` |
| `NullableBooleanPlain` (label "Nullable boolean") | NullableBoolean | none |
| `YesNo` | YesNo | |
| `Image` | Image | canSort, canFilter and canListDistincts are false (data type default) |
| `CommonMark` | CommonMark | `displayingrid=True` |
| `Secret` | String | `isSensitive: true` |

Every column except `Image` has canSort, canFilter and canListDistincts set to true. The client sees type hint keys in lower case.

#### Fixed rows (Id 1–12)

The values below are service strings, as `getFullValue(name).value` returns them. "Base" means the defaults used by most fixed rows:

- `MultiLine` = `"<Text> line 1\n<Text> line 2"`.
- Numbers: `Int32` = 42, `NullableInt32` = 7, `Decimal` = 1234.5, `DecimalFormatted` = 1234567.891 (shown as `1,234,567.89` in an en culture), `Double` = 3.14159, `Int64` = 9007199254740993 (larger than `Number.MAX_SAFE_INTEGER`).
- Dates and time: `DateTime` = 2024-01-15 13:45:30, `DateTimeOffset` = 2024-01-15 13:45:30 +02:00, `Time` = 13:45:30, `NullableDate` = 2024-02-29.
- `NullableBoolean`, `NullableBooleanPlain` and `YesNo` are true.
- `Image` = the 32x32 PNG (the same base64 as `AttributesActions`, starting with `iVBORw0KGgo`).
- `Secret` = `secret-<Id>`.

| Id | Text | CommonMark | Differences from base | Hints |
|---|---|---|---|---|
| 1 | `Alpha` | `**bold** text` | none | none |
| 2 | null | null | All nullable values are null: Text, MultiLine, NullableInt32, NullableDate, NullableBoolean, NullableBooleanPlain, Image, CommonMark and Secret. Non-nullable values are 0 or false; Time is 00:00:00; DateTime and DateTimeOffset are as in base. | item `extraclass=disabled` |
| 3 | `""` | `""` | Empty strings for Text, MultiLine, CommonMark and Secret. Every number is 0, Time is 00:00:00, the booleans are false and Image is empty (null). NullableDate is as in base. | item `extraclass=readonly` |
| 4 | `Delta` | `[People](http://localhost:5000/home/people)` (absolute in-app link) | `Int32` = -17, `Decimal` = -0.5 | item `extraclass="vip highlight"`; `Text` value `foreground=rgb(255, 0, 0)` |
| 5 | `Echo` | `[Hashbang](#!/home/people)` | none | `Text` value `tag=rgb(46, 125, 50)` |
| 6 | `Foxtrot` | `[External](https://www.vidyano.com/)` | none | `Int32` value `style=font-weight: bold; color: rgb(0, 0, 255)`; `Text` value `hoverstyle=background-color: rgb(255, 255, 0)` |
| 7 | `Golf` | `[**Bold link**](http://localhost:5000/home/people)` (link wrapping bold) | none | item `openaction=TestCountSingle` |
| 8 | `<b>not bold</b>` (must render as text) | `<script>window.__xss = 'script';</script>` | none | none |
| 9 | `Img` | `<img src=x onerror="window.__xss = 'img'">` | none | none |
| 10 | `JavaScript href` | `[click me](javascript:window.__xss='href')` | none | none |
| 11 | `Iframe` | `<iframe src="https://www.vidyano.com/"></iframe>` | none | none |
| 12 | `Style` | `<style>body { display: none !important; }</style>after style` | none | none |

How the hints are set:
- Item hints are set with `QueryResultItem.AddTypeHint` and are read with `item.getTypeHint(...)`. `vi-query-grid-row` handles `extraclass` (including `disabled` and `readonly`) and `openaction`.
- Value hints are set on `QueryResultItemValue` and are read through `column.getTypeHint(name, default, value.typeHints)`. The cells handle `foreground`, `tag`, `style` and `hoverstyle`.
- All hints are added in `GridDataTypeActions.QueryExecuted`.

`TestCountSingle` is not among the actions of `QueryGrid_DataTypes`. The client should resolve it through `Vidyano.Action.get(service, "TestCountSingle", query)` (`vi-query-grid-row` falls back to that). The server-side action adds the notification `1` (the selected item count).

For XSS tests, every payload sets `window.__xss` if it executes. Assert that it stays `undefined`.

#### Generated rows (Id 13–212)

The generated rows use Bogus with seed 1001 and the "en" locale. `i` is the 0-based index of the generated row, so `Id = 13 + i`.

| Column | Pattern |
|---|---|
| Text | `Commerce.ProductName()` (Id 13 = `Handcrafted Granite Table`, Id 14 = `Rustic Frozen Hat`) |
| MultiLine | `Lorem.Lines(2)` |
| Int32 | random −1000..1000 |
| NullableInt32 | null when `i % 4 == 0` (Id 13, 17, 21, …), otherwise 0..100 |
| Decimal | random −1000..1000, 2 decimals |
| DecimalFormatted | random 0..1,000,000, 3 decimals |
| Double | random −100..100, 4 decimals |
| Int64 | random ±1e12 |
| DateTime | 2020-01-01..2025-12-31 (with fractional seconds) |
| DateTimeOffset | same range, always +02:00 |
| Time | random second of the day |
| NullableDate | null when `i % 5 == 0` (Id 13, 18, 23, …), otherwise a date in 2020..2025 |
| NullableBoolean, NullableBooleanPlain | `i % 3`: 0 → null (Id 13, 16, …), 1 → true (Id 14, 17, …), 2 → false (Id 15, 18, …) |
| YesNo | true when `i % 2 == 0` (odd Ids) |
| Image | the PNG when `i % 2 == 0` (odd Ids), otherwise empty |
| CommonMark | `**<ProductAdjective>** <ProductMaterial>` (Id 13 = `**Awesome** Frozen`) |
| Secret | `Internet.Password(12)` |

#### Totals row

`query.totalItem` is computed over the whole query result, respecting filters and text search:

```
Text = "Total", Int32 = "-2306", Decimal = "3585.68"
```

The total columns come from `DisplaySum: true` on `Text`, `Int32` and `Decimal`. `GridDataTypeActions.GetTotalItem` calls the base sums and then sets `Text = "Total"`; strings are not summed, so the label goes there. The totals row has no other columns.

### QueryGrid_ColumnOptions

This is the People query (`Source: Database.People`, same data and default actions as `QueryGrid_SelectAndFilterAndInlineActions`) with per-query column overrides. Every other column is unchanged.

| Column | Override |
|---|---|
| FirstName | label `First name of the person as registered in the population register` |
| LastName | `isSensitive: true` |
| BirthDate | `isPinned: true` |
| Gender | `isHidden: true` (still in the result, so its values are available) |
| ContactPreference | `width: "200px"` |
| Email | `canListDistincts: false` |
| PhoneNumber | `canSort: false`, `canFilter: false` |
| EmergencyContact | `width: "0"` |

How the overrides are applied:
- `PersonActions.ApplyColumnOptions` applies them to the query columns in `OnConstruct`, and to the result columns in `QueryExecuted`. The client builds its columns from the result columns when the query comes with a result, so they are applied on every execute.
- `QueryColumn.CanSort`, `CanFilter` and `CanListDistincts` have only internal setters, and the model JSON ignores them on columns. `QueryGridTestData` sets them with reflection.
- These are server defaults. User query settings saved for this query id (pinning, hiding, width) can override them on the client.

### PeopleBig

- `DevContext._peopleBig` holds 150,000 `Person` objects, built in `Initialize()` from `_people[i % 10_000]` with `Id = i + 1`. All fields are copied; `EmergencyContact`, `Addresses` and `Languages` reference the source person's objects.
- The `_people` list is not changed.
- The query has `Source: Custom.PeopleBig` (`DevContext.PeopleBig()`) and the same columns as People.
- The default sort is `FirstName`, so the first rows are `Aaron Lemmens` (Id 3) and `Aaron Verhaeghe` (Id 105). Each person appears 15 times.
- Opening a row loads the person through `DevContext.People`, so Ids above 10,000 cannot be opened. The grid itself works fine.

### QueryGrid_Wide

`WideRow` has 60 columns, in this order:

| Columns | Type |
|---|---|
| `Id` | Int32 |
| `Text01`..`Text20` | String |
| `Int01`..`Int10` | Int32 |
| `Dec01`..`Dec05` | Decimal |
| `Date01`..`Date05` | Date |
| `DateTime01`..`DateTime03` | DateTime |
| `Time01`, `Time02` | Time |
| `Flag01`..`Flag05` | Boolean |
| `NFlag01`, `NFlag02` | NullableBoolean (about 30% null) |
| `YesNo01` | YesNo |
| `Enum01` | Enum `WideColor` (Red, Green, Blue, Yellow) |
| `Enum02` | Enum `WideSize` (Small, Medium, Large) |
| `Enum03` | Enum `WideStatus` (Draft, Active, Archived) |
| `Enum04` | Enum `WidePriority` (Low, Normal, High, Critical) |
| `Image01` | Image (about 50% empty) |
| `Markdown01` | CommonMark (`displayingrid=True`, `**<adjective>** _<material>_`) |

There are 2,000 rows from Bogus (seed 1002, "en"). The default sort is `Id`, and `Int10` equals `Id`. The text columns have varied lengths:

| Column | Content |
|---|---|
| Text01 | first name |
| Text02 | last name |
| Text03 | city |
| Text04 | country |
| Text05 | email |
| Text06 | company |
| Text07 | product |
| Text08 | one word |
| Text09 | sentence |
| Text10 | paragraph |
| Text11 | 3 characters |
| Text12 | 40 characters |
| Text13 | phone |
| Text14 | street |
| Text15 | department |
| Text16 | hacker phrase |
| Text17 | word |
| Text18 | 3 sentences |
| Text19 | 1 character |
| Text20 | GUID |

Row 1 starts with `Text01 = Cleveland`, `Text02 = Senger`.

### QueryGrid_Reorder / QueryGrid_ReorderLarge

Both queries are over `ReorderItem`, which has the columns `Id`, `Name`, `Description` (Bogus `Commerce.ProductName()`) and `Offset`. Both have `canReorder: true`.

| Query | Source | Ids | Names | Initial Offset | Seed |
|---|---|---|---|---|---|
| `QueryGrid_Reorder` | `Custom.ReorderItems` | 1..12 | `Item 01`..`Item 12` | 10, 20, … 120 | 1003 |
| `QueryGrid_ReorderLarge` | `Custom.ReorderItemsLarge` | 1001..1250 | `Item 001`..`Item 250` | 10, 20, … 2500 | 1004 |

How reordering works:
- Both queries are always returned in `Offset` order, then by `Id`; `ReorderItemActions.Sort` ignores the user's sort.
- `query.reorder(before, item, after)` calls `QueryOrder.Reorder`. `ReorderItemActions.OnReorder` runs `ReorderArgs.Apply(list, i => i.Offset)` on the matching in-memory list. Only `Offset` changes, and nothing else can be mutated.
- Example: moving `Item 03` between `Item 01` and `Item 02` gives `Item 01@10, Item 03@15, Item 02@20, Item 04@40`.

To reset the order, run `PersistentObject.ResetTest`. It calls `DevContext.Initialize()`, which rebuilds both lists (and all other dev data) to the initial state above:

```ts
await service.executeAction("PersistentObject.ResetTest", service.application);
```

This was verified: after the reorder above and a ResetTest, the order is again `Item 01@10, Item 02@20, Item 03@30, Item 04@40`. The backend state is shared by all specs, so a spec that reorders should reset in `afterAll` (or `afterEach`).

### QueryGrid_Continuation

A query whose total is unknown while it pages: the server answers with a continuation token instead of a total, like a source that cannot count. Read-only, `PageSize` 100, `Source: Custom.ContinuationPages`.

`ContinuationRow` has these columns, in this order. All can sort, filter and list distincts. The default sort is `Id`.

| Column | Type | Content |
|---|---|---|
| `Id` | Int32 | 1..1234, the row number |
| `Code` | String | `Row 0001`..`Row 1234` (`Row {Id:0000}`) |
| `Name` | String | `Commerce.ProductName()` (153 duplicates) |
| `Department` | String | `Commerce.Department(1)` (22 distinct values) |
| `Amount` | Decimal | random 0..10,000, 2 decimals, no duplicates (so a sort on it is stable) |
| `Date` | Date | 2020-01-01..2025-12-31 |

There are 1,234 rows from Bogus (seed 1005, "en"), not a multiple of the page size: 12 full pages and a last page of 34. Row 1 is `Row 0001`, `Handmade Metal Ball`, `Automotive`, 8261.81, 2021-03-20.

#### Paging protocol

| Request | Result |
|---|---|
| GetQuery, or ExecuteQuery without a token (any `skip`) | the page at `skip` (0 when absent); `totalItems: -1` and `continuation: "offset:<skip + count>"` while more rows follow |
| ExecuteQuery with `continuation: "offset:<n>"` | `top` rows (default the page size) from row `n`; the client's `skip` is ignored |
| a page that reaches the end | no `continuation`, and `totalItems` is the real count (`offset:1200` gives 34 rows and `totalItems: 1234`; `offset:1100` with `top: 134` gives 134 rows and 1234) |
| `offset:1234` | 0 rows, `totalItems: 1234`, no token |
| a token that is not `offset:<digits>` | exception `Invalid continuation token '<token>'.` |

- The token is the 0-based index of the next row within the current sort, text search and column filters. It does not carry them: a request with a token must send the same sort, search and filters as the request that produced it.
- Sorting, text search and column filters run on the server (Vidyano's normal pipeline over `DevContext._continuationRows`); the token only replaces `skip`. A new sort, search or filter starts again without a token.
- The server returns `totalItems: -1` because it sets `QueryResult.Continuation` (Vidyano does that by itself); it still counts internally.
- Only `ExecuteQueryReason.Unknown` and `GetQuery` page with the token. Distincts, counts, all-selected actions and exports see the whole query.
- Opening a row loads it through `DevContext.ContinuationRows` and gives a read-only persistent object.

#### Verified on the server (raw GetQuery/ExecuteQuery calls)

Walking the tokens 100 rows at a time returns exactly the same ids, in the same order, as one request with `top: 5000`:

| Sort / search / filter | Rows | Pages (last page) | First ids |
|---|---|---|---|
| none (`Id`) | 1,234 | 13 (34) | 1, 2, 3 |
| `Amount DESC` | 1,234 | 13 (34) | 701, 143, 4 |
| `Amount` | 1,234 | 13 (34) | 127, … |
| `Department; Name DESC` | 1,234 | 13 (34) | 133, 288, 94 |
| text search `2021` | 189 | 2 (89) | 1, 2, 7 |
| Department excludes `\|Automotive` | 1,168 | 12 (68) | 2, 3, 5 |
| Department includes `\|Automotive`, `\|Books` | 121 | 2 (21) | 1, 4, 16 |
| `Amount DESC` + search `2021` + Department excludes `\|Automotive`, `\|Books` | 171 | 2 (71) | 295, 474, 1104 |
| text search `Handmade` | 96 | 1 (no token, `totalItems: 96`) | 1, 35, 44 |

Two identical requests return the same rows.

Grocery, Computers, Health and Home together hold exactly 200 rows (two full pages); `grid.ct-exact-multiple` filters on them for a total that is a multiple of the page size.

#### What the client does

This is the contract `grid/continuation.spec.ts` and `packages/core/tests/query-continuation.spec.ts` lock in:

- The first page shows rows 1–100, `query.hasMore` is true, `query.totalItems` is 100 and the title reads `100+ Continuation (unknown total)`. The scroll range ends at row 100, plus at most one viewport of open end.
- Reaching the last loaded row sends the next token once (`{ continuation: "offset:100", top: 100 }`); the rows arrive at their index and the scroll position does not move. Walking to the end sends `offset:100`..`offset:1200` once each and ends with `hasMore` false, `totalItems` 1234 and `1.234 Continuation (unknown total)`.
- `items.atAsync(i)` or lazy `items[i]` far ahead sends one request with the current token that covers every page up to `i` (`atAsync(1000)`: `top: 1000`). Past the real end (`atAsync(2000)`) the server stops early with the real total, and `atAsync` resolves to `undefined`. Concurrent requests for later pages never send a token twice. `_internal(query).getItems(500, 100)` resolves to ids 501–600.
- The token is cleared once the last page arrived. An empty last page after a token (only possible with a server that cannot tell it reached the end; the specs patch the response) closes the total and drops the `+`.
- A sort, text search or filter change sends ExecuteQuery without a token and without `skip`, and the grid starts again at row 1 with `hasMore` true and `totalItems` 100. That also holds while a page request is still in flight: its response is dropped, and `search()` resolves to its own result.

### Caveats

- `QueryColumn.CanSort`, `CanFilter` and `CanListDistincts` are set through reflection (see QueryGrid_ColumnOptions). A Vidyano update that renames these internals breaks `QueryGridTestData` with an `InvalidOperationException`.
- The totals label needs `Text` to be a DisplaySum column. Vidyano only allows values for DisplaySum columns in the total item.
- No hints are set on generated rows. All item and value hints are on fixed rows 2–7.
- `PeopleBig` rows with Id > 10,000 cannot be opened as a persistent object.
- `QueryGrid_Continuation` is an offset in disguise: the server could count, it just does not say so. Its tokens are only valid for the sort, search and filters they were made with, and a token request ignores `skip`, so a client that sends a token for a page other than the next one gets the next one.
