# HAR-to-Code

Converts browser-captured HAR (HTTP Archive) files into executable TypeScript code using the `@vidyano/core` Service API. This lets you replay any Vidyano interaction programmatically against a live backend.

## Usage

```bash
# Print generated code to stdout
npx tsx tools/har-to-code/src/index.ts <har-file>

# Write to file
npx tsx tools/har-to-code/src/index.ts <har-file> --output replay.ts
```

## How to capture a HAR file

1. Open Chrome DevTools (F12) -> Network tab
2. Perform the interaction you want to capture
3. Right-click the network log -> "Save all as HAR with content"
4. Optional: clean up the HAR file to remove sensitive data (auth tokens, etc.)

The tool only looks at POST requests to Vidyano API endpoints and ignores everything else (static resources, telemetry, etc.).

## Output format

The tool generates an `async function replay(service: Service)` that expects an already-initialized and authenticated `Service` instance:

```typescript
import type { Service, PersistentObjectAttributeWithReference } from "@vidyano/core";

async function replay(service: Service) {
    const customer = await service.getPersistentObject(null, "Customer", "a1b2c3d4-...");
    // ...
}
```

## Architecture

Three-stage pipeline:

```
HAR File --> [Parser] --> HarApiEntry[] --> [Analyzer] --> InteractionStep[] --> [CodeGenerator] --> TypeScript
```

| Stage | File | Responsibility |
|-------|------|---------------|
| Parser | `har-parser.ts` | Reads HAR JSON, filters to Vidyano API entries, parses request/response bodies |
| Analyzer | `interaction-analyzer.ts` | Walks entries sequentially, tracks PO/Query state, classifies each entry into a high-level API operation |
| Generator | `code-generator.ts` | Produces TypeScript code from the analyzed interaction steps |

## HAR wire format

All Vidyano API calls are POST requests with JSON bodies. The URL path determines the operation type, and the request body contains the full parameters.

### Common request structure

Every request contains:

```json
{
    "userName": "admin",
    "authToken": "base64-encoded-token",
    "session": {
        "id": "guid",
        "type": "Session",
        "securityToken": "...",
        "attributes": [
            { "name": "Customer", "value": "Acme Corp", "objectId": "guid", ... },
            { "name": "SchemaName", "value": "DEFAULT", ... }
        ]
    },
    "profile": true
}
```

The `session.attributes` carry context that persists across calls (e.g., the currently selected customer).

### Endpoint patterns

#### `POST /GetApplication`

Initializes the application and signs in. When present, the generated code creates a `Service` instance and calls `signInUsingDefaultCredentials()` instead of expecting a pre-configured `service` parameter.

**Maps to:**
```typescript
const service = new Service("http://localhost:62310");
await service.signInUsingDefaultCredentials();
```

---

#### `POST /GetPersistentObject/{typeId}`

Loads a single persistent object by type and ID.

**Request body (specific fields):**
```json
{
    "persistentObjectTypeId": "11111111-1111-1111-1111-111111111111",
    "objectId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

**Response body:**
```json
{
    "result": {
        "id": "11111111-...",
        "type": "Customer",
        "objectId": "aaaaaaaa-...",
        "breadcrumb": "Acme Corp",
        "isNew": false,
        "securityToken": "...",
        "attributes": [
            { "id": "guid", "name": "Name", "value": "Acme Corp", "type": "String", "triggersRefresh": true, ... },
            { "id": "guid", "name": "City", "value": "Springfield", "type": "String", ... }
        ],
        "queries": [
            { "id": "guid", "name": "CustomerOrdersView", "label": "Orders", ... }
        ]
    }
}
```

**Maps to:**
```typescript
const customer = await service.getPersistentObject(null, "Customer", "aaaaaaaa-...");
```

The `result.type` field gives the human-readable type name used in the generated code. The `result.queries[]` array lists child queries accessible via `po.queries["name"]`.

---

#### `POST /ExecuteQuery/{queryName}`

Executes a query to fetch tabular data. Can be a standalone query or a child query of a PO.

**Request body (specific fields):**
```json
{
    "query": {
        "id": "22222222-...",
        "name": "CustomerOrdersView",
        "label": "Orders",
        "sortOptions": "",
        "columns": [
            { "id": "guid", "name": "OrderNumber", "label": "Order #", "type": "String" },
            { "id": "guid", "name": "Total", "label": "Total", "type": "Decimal" }
        ],
        "persistentObject": {
            "id": "guid",
            "type": "CustomerOrdersView",
            "securityToken": "..."
        }
    },
    "parent": {
        "id": "11111111-...",
        "type": "Customer",
        "objectId": "aaaaaaaa-...",
        "securityToken": "...",
        "attributes": [ ... ]
    }
}
```

The `parent` field links the query to its parent PO. If absent, it's a standalone (root-level) query.

**Maps to (child query):**
```typescript
const ordersQuery = customer.queries["CustomerOrdersView"];
await ordersQuery.search();
```

**Maps to (standalone):**
```typescript
const productsQuery = await service.getQuery("Products");
await productsQuery.search();
```

**Maps to (refresh - same query executed again):**
```typescript
await ordersQuery.search();
```

**Maps to (column include/exclude filter state):**
```typescript
const productsQuery = await service.getQuery("Products");
productsQuery.getColumn("Category").selectedDistincts = ["|Electronics"];
const statusCol = productsQuery.getColumn("Status");
statusCol.selectedDistincts = ["|Discontinued"];
statusCol.selectedDistinctsInversed = true;
await productsQuery.search();
```

---

#### `POST /ExecuteAction/Query_{queryName}/{actionName}`

Executes an action in the context of a query.

##### Query.New

Creates a new persistent object from a query context.

**Request body (specific fields):**
```json
{
    "action": "Query.New",
    "parent": { "type": "Customer", "objectId": "aaaaaaaa-...", ... },
    "query": { "name": "CustomerOrdersView", ... },
    "parameters": { "MenuOption": "-1" }
}
```

**Response body:**
```json
{
    "result": {
        "type": "CustomerOrder",
        "isNew": true,
        "breadcrumb": "New Order",
        "attributes": [
            { "name": "OrderCategory", "type": "Reference", ... },
            { "name": "Description", "type": "String", ... },
            { "name": "IsUrgent", "value": "False", "type": "Boolean", ... }
        ]
    }
}
```

**Maps to:**
```typescript
const newOrder = await ordersQuery.getAction("New").execute();
```

The response `result` is the newly created PO, already in edit mode (`isNew: true`).

##### Query.New from QueryFilters

Some systems call `Query.New` from the `QueryFilters` parent when opening a new query filter row.

**Request body (specific fields):**
```json
{
    "action": "Query.New",
    "parent": { "type": "QueryFilters", "objectId": "22222222-..." },
    "query": { "name": "SelectAndFilterQuery", ... },
    "parameters": {}
}
```

**Maps to:**
```typescript
const newFilter = await selectAndFilterQuery.filters.createNew();
```

##### Query.Delete (and other query actions with selectedItems)

Executes an action on selected query result items.

**Request body (specific fields):**
```json
{
    "action": "Query.Delete",
    "parent": { "type": "Customer", "objectId": "aaaaaaaa-...", ... },
    "query": { "name": "CustomerOrdersView", ... },
    "selectedItems": [
        { "id": "33333333-...", "values": [{ "key": "OrderNumber", "value": "ORD-001" }, ...] }
    ],
    "parameters": {}
}
```

The `selectedItems` array contains the query result items to act on. The `parameters` object can carry additional action-specific parameters (passed as `{ parameters: ... }` in the execute options when non-empty). A `MenuOption >= 0` in parameters indicates a menu selection (passed as `{ menuOption: N }`).

**Maps to:**
```typescript
const ordersQuery = customer.queries["CustomerOrdersView"];
await ordersQuery.search();
await ordersQuery.getAction("Delete").execute({ selectedItems: ordersQuery.items.filter(i => i.id === "33333333-...") });
```

##### QueryOrder.Reorder

Reorders query items using `query.reorder(before, item, after)`.

**Request body (specific fields):**
```json
{
    "action": "QueryOrder.Reorder",
    "query": { "name": "OrderLinesQuery", ... },
    "selectedItems": [
        { "id": "a1...", "index": 1 },
        { "id": "b2...", "index": 2 },
        { "id": "c3...", "index": 3 }
    ]
}
```

`selectedItems[0]` is the `before` item, `selectedItems[1]` is the moved item, and `selectedItems[2]` is the `after` item. `null` is preserved for top/bottom moves.

**Maps to:**
```typescript
await orderLinesQuery.reorder(
    orderLinesQuery.items.find(i => i.id === "a1..."),
    orderLinesQuery.items.find(i => i.id === "b2..."),
    orderLinesQuery.items.find(i => i.id === "c3...")
);
```

##### POST /ExecuteAction/QueryFilter_* (internal)

`QueryFilter.RefreshColumn` and related `QueryFilter` actions refresh filter distinct values only. They are internal framework operations and do not generate direct output code.
The analyzer pre-registers the owning query so subsequent steps (such as `Query.New` on `QueryFilters`) can be resolved.

---

#### `POST /ExecuteAction/Query_{lookupQueryName}/SelectReference`

Sets a reference attribute by selecting an item from a lookup query.

**Request body (specific fields):**
```json
{
    "action": "PersistentObject.SelectReference",
    "parent": {
        "type": "CustomerOrder",
        "isNew": true,
        "attributes": [
            { "name": "OrderCategory", "type": "Reference", ... }
        ]
    },
    "query": { "name": "OrderCategories", ... },
    "selectedItems": [
        { "id": "44444444-4444-4444-4444-444444444444", ... }
    ]
}
```

Note: the URL path says `Query_OrderCategories` (the lookup query name), but the `action` field in the body says `PersistentObject.SelectReference`. Always trust the `action` field.

**Response body:**

The response returns the updated parent PO with the reference attribute now populated:
```json
{
    "result": {
        "attributes": [
            { "name": "OrderCategory", "value": "Electronics", "objectId": "44444444-...", "type": "Reference", ... }
        ]
    }
}
```

**Maps to:**
```typescript
const attr = newOrder.getAttribute("OrderCategory") as PersistentObjectAttributeWithReference;
await attr.changeReference(["44444444-4444-4444-4444-444444444444"]);
```

The analyzer detects which reference attribute changed by comparing request vs. response attributes. The `selectedItems[0].id` or the newly-populated `objectId` gives the reference target.

---

#### `POST /ExecuteAction/PersistentObject_{typeName}/Save`

Saves a persistent object with its current attribute values.

**Request body (specific fields):**
```json
{
    "action": "PersistentObject.Save",
    "parent": {
        "type": "CustomerOrder",
        "isNew": true,
        "attributes": [
            { "name": "OrderCategory", "value": "Electronics", "objectId": "44444444-...", "isValueChanged": true, ... },
            { "name": "Description", "value": "Bulk order", "isValueChanged": true, ... },
            { "name": "IsUrgent", "value": true, "isValueChanged": true, ... },
            { "name": "Customer", "value": "Acme Corp", "objectId": "aaaaaaaa-...", "isValueChanged": true, ... }
        ]
    }
}
```

The `isValueChanged: true` flag marks which attributes were modified. The analyzer uses this to determine which `setAttributeValue` calls to emit, but filters out:

1. **Reference attributes already handled by SelectReference** (tracked via `handledAttributes` set)
2. **Auto-populated values** that match the original response from Query.New (backend-set, not user-set)
3. **Read-only attributes** (system/audit fields)

**Maps to:**
```typescript
await newOrder.setAttributeValue("Description", "Bulk order");
await newOrder.setAttributeValue("IsUrgent", true);
await newOrder.save();
```

Note: the URL may contain typos (e.g., `PeristentObject` instead of `PersistentObject`). The tool uses the `action` field from the request body for classification, not the URL path.

---

#### `POST /ExecuteAction/PersistentObject_{typeName}/Refresh`

Triggered automatically when an attribute with `triggersRefresh: true` is changed. The tool emits a `setAttributeValue` call instead of a `getAction("Refresh").execute()`, because `setAttributeValue` on a triggersRefresh attribute automatically performs the server roundtrip.

**Request body (specific fields):**
```json
{
    "action": "PersistentObject.Refresh",
    "parent": {
        "type": "Product",
        "objectId": "55555555-5555-5555-5555-555555555555",
        "attributes": [
            { "name": "Category", "value": "Electronics", "type": "String", "isValueChanged": true, "triggersRefresh": true, ... }
        ]
    },
    "parameters": {
        "RefreshedPersistentObjectAttributeId": "66666666-..."
    }
}
```

The `RefreshedPersistentObjectAttributeId` parameter identifies which attribute triggered the refresh. The tool finds the matching attribute in `parent.attributes` and emits a `setAttributeValue` call. The attribute is tracked as handled so the Save step doesn't duplicate it.

**Maps to:**
```typescript
await product.setAttributeValue("Category", "Electronics");
```

---

## Supported patterns

| Pattern | HAR signature | Generated code |
|---------|--------------|----------------|
| Initialize | `GetApplication` | `new Service(url)` + `signInUsingDefaultCredentials()` |
| Load PO | `GetPersistentObject` | `service.getPersistentObject(parent, typeName, objectId)` |
| Search child query | `ExecuteQuery` with `parent` matching a tracked PO | `po.queries["name"].search()` |
| Search standalone query | `ExecuteQuery` without parent | `service.getQuery("name").search()` |
| Refresh query | `ExecuteQuery` for an already-searched query | `query.search()` |
| Create new from query | `ExecuteAction` with `action: "Query.New"` | `query.getAction("New").execute()` |
| Reorder query items | `ExecuteAction` with `action: "QueryOrder.Reorder"` | `query.reorder(beforeItem, item, afterItem)` |
| Query action with selection | `ExecuteAction` with `action: "Query.*"` + `selectedItems` | `query.getAction("Delete").execute({ selectedItems: ... })` |
| Query column filtering | `ExecuteQuery` with column `includes`/`excludes` | `query.getColumn(...).selectedDistincts` and `.selectedDistinctsInversed` |
| Query filter refresh | `ExecuteAction` with `action: "QueryFilter.RefreshColumn"` | Skipped (internal), query is pre-registered for later steps |
| Create query filter row | `ExecuteAction` with `action: "Query.New"` + `parent.type == "QueryFilters"` | `query.filters.createNew()` |
| Select reference | `ExecuteAction` with `action: "PersistentObject.SelectReference"` | `attr.changeReference([ids])` |
| Attribute refresh | `ExecuteAction` with `action: "PersistentObject.Refresh"` | `setAttributeValue()` (auto-triggers refresh) |
| Set values + save | `ExecuteAction` with `action: "PersistentObject.Save"` | `setAttributeValue()` + `po.save()` |
| Custom/other action | `ExecuteAction` with any other `action` | `target.getAction("name").execute()` |

## State tracking

The analyzer maintains state across HAR entries to generate correct variable references:

- **TrackedObjects**: Every PO loaded via `GetPersistentObject` or created via `Query.New` is registered with a generated variable name, its type, objectId, and attribute map.
- **TrackedQueries**: Every query discovered (from PO child queries, standalone, or query actions) is registered. The analyzer tracks whether a query has been searched/declared to distinguish initial search from refresh.
- **Implicit parent tracking**: When a `parent` field references a PO that wasn't explicitly loaded in the HAR (e.g., recording started mid-interaction), the analyzer auto-registers it with a synthetic `LoadPersistentObject` step. This ensures child queries and actions correctly reference their parent.
- **Session handling**: `SelectReference` entries where the parent is a `Session` object target `service.application.session` (the session is a `PersistentObject` accessible via the Application). This handles session-level reference selections like setting the active customer.
- **SelectRef tracking**: Attributes set via `SelectReference` are remembered so the Save handler doesn't emit redundant `setAttributeValue` calls for them.
- **Parent-child correlation**: When `ExecuteQuery` or `ExecuteAction` includes a `parent` that matches a tracked PO, the query is accessed via `po.queries["name"]` instead of standalone `service.getQuery()`.

## Variable naming

Type names are converted to camelCase variable names:

| Type name | Variable |
|-----------|----------|
| `Sales_Customer` | `customer` (last segment after `_`) |
| `CustomerOrder` | `order` (strips `Customer` prefix) |
| `CustomerOrdersView` (query) | `ordersViewQuery` |
| New `CustomerOrder` | `newOrder` |

Duplicates get numeric suffixes: `customer`, `customer2`, etc.

## Value type formatting

| Vidyano type | Generated literal |
|-------------|------------------|
| `Boolean`, `NullableBoolean` | `true` / `false` (from `"True"` / `"False"`) |
| `Int32`, `Int64`, `Decimal`, `Double` (and nullable variants) | Numeric literal |
| `Guid` | String literal |
| Everything else | String literal |

## Adding new patterns

To support a new HAR interaction pattern:

1. **Identify the HAR signature** - What does the URL path look like? What's in the `action` field? What distinguishes it from existing patterns?

2. **Add the InteractionType** in `types.ts` - Add a new variant to the `InteractionType` union and any step-specific fields to `InteractionStep`.

3. **Add analyzer logic** in `interaction-analyzer.ts` - Handle the new pattern in `#analyzeExecuteAction` (or the appropriate method). Extract the relevant data from request/response bodies and create the `InteractionStep`.

4. **Add generator logic** in `code-generator.ts` - Add a new `#emit*` method and wire it into `#emitStep`. Generate the corresponding `@vidyano/core` API calls.

5. **Verify** - Run the tool against a HAR file containing the new pattern and check the output.

### How `Query.*` actions work

All `Query.*` actions (except `Query.New` which has special handling) are handled generically. The analyzer:

1. Resolves the parent PO (auto-registering if implicit)
2. Finds or registers the query from the request body's `query` field
3. Extracts `selectedItems` IDs from the request body
4. Generates code that declares the query variable (if not yet declared), searches it (if items are needed), and executes the action with `{ selectedItems: query.items.filter(...) }`

For example, a `Query.Delete` HAR entry generates:
```typescript
const ordersQuery = customer.queries["CustomerOrdersView"];
await ordersQuery.search();
await ordersQuery.getAction("Delete").execute({ selectedItems: ordersQuery.items.filter(i => i.id === "33333333-...") });
```
