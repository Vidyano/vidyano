import type { HarApiEntry, InteractionStep, TrackedAttribute, TrackedObject, TrackedQuery } from "./types.js";

export class InteractionAnalyzer {
    private trackedObjects = new Map<string, TrackedObject>();
    private trackedQueries = new Map<string, TrackedQuery>();
    private varCounts = new Map<string, number>();
    private handledAttributes = new Set<string>(); // "poVar:attrName" already handled by SelectReference or Refresh
    private pendingSteps: InteractionStep[] = [];

    analyze(entries: HarApiEntry[]): InteractionStep[] {
        const steps: InteractionStep[] = [];

        for (const entry of entries) {
            let step: InteractionStep | null = null;

            switch (entry.operationType) {
                case "GetApplication":
                    step = this.#analyzeGetApplication(entry);
                    break;
                case "GetPersistentObject":
                    step = this.#analyzeGetPersistentObject(entry);
                    break;
                case "GetQuery":
                    step = this.#analyzeGetQuery(entry);
                    break;
                case "ExecuteQuery":
                    step = this.#analyzeExecuteQuery(entry);
                    break;
                case "ExecuteAction":
                    step = this.#analyzeExecuteAction(entry, steps);
                    break;
            }

            // Flush any implicit steps (e.g. auto-registered parent loads)
            if (this.pendingSteps.length > 0) {
                steps.push(...this.pendingSteps);
                this.pendingSteps = [];
            }

            if (step)
                steps.push(step);
        }

        return steps;
    }

    #analyzeGetApplication(entry: HarApiEntry): InteractionStep {
        const urlObj = new URL(entry.url);
        const serviceUri = `${urlObj.protocol}//${urlObj.host}`;

        return {
            index: entry.index,
            type: "Initialize",
            description: "Initialize service and sign in",
            entry,
            serviceUri,
        };
    }

    #analyzeGetQuery(entry: HarApiEntry): InteractionStep | null {
        const response = entry.responseBody;
        const queryName = response?.query?.name;
        const queryId = response?.query?.id ?? entry.requestBody?.id;

        if (!queryName)
            return null;

        const varName = this.#generateVarName(queryName + "Query", false);

        this.trackedQueries.set(queryName, {
            varName,
            name: queryName,
            id: queryId,
            parentObjectVar: null,
            searched: true,
        });

        return {
            index: entry.index,
            type: "LoadQuery",
            description: `Load ${queryName} query`,
            entry,
            queryVar: varName,
            queryName,
            queryId,
        };
    }

    #analyzeGetPersistentObject(entry: HarApiEntry): InteractionStep {
        const body = entry.requestBody;
        const typeId = body.persistentObjectTypeId;
        const objectId = body.objectId;
        const result = entry.responseBody?.result;
        const typeName = result?.type ?? typeId;

        const parentVar = this.#ensureParentTracked(body.parent, entry);
        const varName = this.#generateVarName(typeName, false);

        this.#registerPo(varName, typeName, typeId, objectId, false, parentVar, result);

        return {
            index: entry.index,
            type: "LoadPersistentObject",
            description: `Load ${typeName}${objectId ? ` (${objectId})` : ""}`,
            entry,
            poVar: varName,
            typeName,
            objectId,
            parentVar,
        };
    }

    #analyzeExecuteQuery(entry: HarApiEntry): InteractionStep | null {
        const body = entry.requestBody;
        const queryName = body.query?.name;
        const queryId = body.query?.id;
        const parentVar = this.#ensureParentTracked(body.parent, entry);
        const existing = this.#findTrackedQuery(queryName, queryId);
        const existingColumnState = body.query?.columns;
        const columnFilterChanges = existing
            ? this.#trackColumnFilterChanges(existing, existingColumnState)
            : [];

        // Check if this query was already registered (from a parent PO)
        if (existing?.searched) {
            return {
                index: entry.index,
                type: "RefreshQuery",
                description: `Refresh ${queryName}`,
                entry,
                queryVar: existing.varName,
                queryName,
                columnFilterChanges: columnFilterChanges.length > 0 ? columnFilterChanges : undefined,
            };
        }

        if (existing) {
            existing.searched = true;
            const isStandalone = existing.parentObjectVar == null;
            return {
                index: entry.index,
                type: "SearchQuery",
                description: `Search ${queryName}`,
                entry,
                queryVar: existing.varName,
                queryName,
                queryParentVar: existing.parentObjectVar,
                isStandalone,
                columnFilterChanges: columnFilterChanges.length > 0 ? columnFilterChanges : undefined,
            };
        }

        // Not previously registered — if it has a parent PO that doesn't include this query,
        // it's likely a framework-internal query (e.g., reference lookup handled by changeReference)
        if (parentVar)
            return null;

        const varName = this.#generateVarName((queryName ?? queryId ?? "query") + "Query", false);

        const tracked = {
            varName,
            name: queryName ?? queryId ?? "query",
            id: queryId,
            parentObjectVar: parentVar,
            searched: true,
        } as TrackedQuery;

        const newChanges = this.#trackColumnFilterChanges(tracked, existingColumnState);
        this.trackedQueries.set(queryName ?? queryId ?? varName, tracked);

        return {
            index: entry.index,
            type: "SearchQuery",
            description: `Search ${queryName}`,
            entry,
            queryVar: varName,
            queryName,
            queryParentVar: parentVar,
            isStandalone: !parentVar,
            columnFilterChanges: newChanges.length > 0 ? newChanges : undefined,
        };
    }

    #analyzeExecuteAction(entry: HarApiEntry, previousSteps: InteractionStep[]): InteractionStep | null {
        const body = entry.requestBody;
        const action = body.action as string;

        if (!action)
            return null;

        if (action.startsWith("QueryFilter."))
            return this.#analyzeQueryFilterAction(body, entry);

        if (action === "QueryOrder.Reorder")
            return this.#analyzeReorder(entry);

        if (action === "Query.New")
            return this.#analyzeQueryNew(entry);

        if (action === "PersistentObject.SelectReference")
            return this.#analyzeSelectReference(entry);

        if (action === "PersistentObject.Refresh")
            return this.#analyzeRefresh(entry);

        if (action === "PersistentObject.Save")
            return this.#analyzeSave(entry, previousSteps);

        // Generic action
        return this.#analyzeGenericAction(entry, action);
    }

    #analyzeQueryNew(entry: HarApiEntry): InteractionStep {
        const body = entry.requestBody;
        const result = entry.responseBody?.result;
        const queryName = body.query?.name;
        const parent = body.parent;
        const resultType = result?.type ?? "Unknown";

        let queryTrack = this.#findTrackedQuery(queryName, body.query?.id);

        // If query is not tracked, register it (e.g., AsDetail queries not in PO's top-level queries)
        if (!queryTrack && queryName && parent?.type !== "QueryFilters") {
            const parentVar = this.#ensureParentTracked(parent, entry);
            const queryVarName = this.#generateVarName(queryName + "Query", false);
            queryTrack = {
                varName: queryVarName,
                name: queryName,
                id: body.query?.id,
                parentObjectVar: parentVar,
                searched: false,
            };
            this.trackedQueries.set(queryName, queryTrack);
        }

        const queryVar = queryTrack?.varName ?? queryName;
        const sourceQuery = parent?.type === "QueryFilters"
            ? this.#findTrackedQueryById(parent.objectId) ?? queryTrack
            : queryTrack;
        const filtersSourceQueryVar = parent?.type === "QueryFilters"
            ? sourceQuery?.varName
            : undefined;
        const varName = this.#generateVarName(resultType, true);

        // Determine if we need to declare the query variable
        let queryDeclareVar: string | undefined;
        let queryDeclareParentVar: string | undefined;
        let queryDeclareName: string | undefined;

        if (filtersSourceQueryVar && sourceQuery && !sourceQuery.searched) {
            // Filter case: declare the source query that owns the filters
            queryDeclareVar = sourceQuery.varName;
            queryDeclareParentVar = sourceQuery.parentObjectVar ?? undefined;
            queryDeclareName = sourceQuery.name;
        }
        else if (!filtersSourceQueryVar && queryTrack && !queryTrack.searched) {
            // Non-filter case: declare the query itself (e.g., AsDetail query from parent PO)
            queryDeclareVar = queryTrack.varName;
            queryDeclareParentVar = queryTrack.parentObjectVar ?? undefined;
            queryDeclareName = queryTrack.name;
        }

        // Mark as searched since the declaration will be emitted
        if (queryDeclareVar && sourceQuery)
            sourceQuery.searched = true;
        if (queryDeclareVar && queryTrack)
            queryTrack.searched = true;

        this.#registerPo(varName, resultType, result?.fullTypeName ?? resultType, null, true, null, result);

        return {
            index: entry.index,
            type: "QueryAction",
            description: `Create new ${resultType}`,
            entry,
            actionName: "New",
            resultVar: varName,
            sourceQueryVar: filtersSourceQueryVar ? undefined : queryVar,
            filtersSourceQueryVar,
            queryDeclareVar,
            queryDeclareParentVar,
            queryDeclareName,
            asDetailAttributeName: queryTrack?.asDetailAttributeName,
            asDetailParentVar: queryTrack?.asDetailAttributeName ? queryTrack.parentObjectVar ?? undefined : undefined,
            ...this.#extractActionOptions(body),
        };
    }

    #analyzeReorder(entry: HarApiEntry): InteractionStep {
        const body = entry.requestBody;
        const queryTrack = this.#findTrackedQuery(body.query?.name, body.query?.id) ?? this.#findTrackedQueryById(body.query?.id);
        const selectedItems: any[] = body.selectedItems ?? [];
        const reorderItemIds: (string | null)[] = [
            selectedItems[0]?.id ?? null,
            selectedItems[1]?.id ?? null,
            selectedItems[2]?.id ?? null,
        ];

        const needsDeclare = queryTrack != null && !queryTrack.searched;
        if (queryTrack)
            queryTrack.searched = true;

        return {
            index: entry.index,
            type: "ReorderQuery",
            description: `Reorder ${body.query?.name}`,
            entry,
            reorderQueryVar: queryTrack?.varName ?? body.query?.name,
            reorderItemIds,
            queryDeclareVar: needsDeclare ? queryTrack?.varName : undefined,
            queryDeclareParentVar: needsDeclare ? queryTrack?.parentObjectVar ?? undefined : undefined,
            queryDeclareName: needsDeclare ? queryTrack?.name : undefined,
        };
    }

    #analyzeQueryFilterAction(body: Record<string, any>, entry: HarApiEntry): null {
        const queryName = body.query?.name;
        const queryId = body.query?.id;
        const queryKey = queryName ?? queryId ?? "query";

        if (!queryName && !queryId)
            return null;

        const parentVar = this.#ensureParentTracked(body.parent, entry);
        const tracked = this.#findTrackedQuery(queryName, queryId);

        if (!tracked) {
            this.trackedQueries.set(queryKey, {
                varName: this.#generateVarName((queryKey ?? "query") + "Query", false),
                name: queryKey ?? "query",
                id: queryId,
                parentObjectVar: parentVar,
                searched: false,
                lastColumnFilters: this.#extractColumnFilters(body.query?.columns),
            });
        }
        else {
            tracked.lastColumnFilters = this.#extractColumnFilters(body.query?.columns);
            if (parentVar)
                tracked.parentObjectVar = parentVar;
        }

        return null;
    }

    #trackColumnFilterChanges(tracked: TrackedQuery | undefined, columns: any[] | undefined): Array<{ columnName: string; selectedDistincts: string[]; inversed: boolean }> {
        if (!tracked)
            return [];

        const previous = tracked.lastColumnFilters ?? new Map<string, { includes: string[]; excludes: string[] }>();
        const current = this.#extractColumnFilters(columns);
        const changes: Array<{ columnName: string; selectedDistincts: string[]; inversed: boolean }> = [];
        tracked.lastColumnFilters = current;

        for (const [columnName, state] of current) {
            const prev = previous.get(columnName);
            const prevIncludes = prev?.includes ?? [];
            const prevExcludes = prev?.excludes ?? [];
            const hasIncludes = !this.#isEqualArray(state.includes, prevIncludes);
            const hasExcludes = !this.#isEqualArray(state.excludes, prevExcludes);

            if (hasIncludes && state.includes.length > 0)
                changes.push({ columnName, selectedDistincts: state.includes, inversed: false });
            if (hasExcludes && state.excludes.length > 0)
                changes.push({ columnName, selectedDistincts: state.excludes, inversed: true });
        }

        return changes;
    }

    #extractColumnFilters(columns: any[] | undefined): Map<string, { includes: string[]; excludes: string[] }> {
        const map = new Map<string, { includes: string[]; excludes: string[] }>();
        const normalizedColumns = columns ?? [];

        for (const column of normalizedColumns) {
            const columnName = column?.name;
            if (!columnName)
                continue;

            map.set(columnName, {
                includes: this.#normalizeStringArray(column.includes),
                excludes: this.#normalizeStringArray(column.excludes),
            });
        }

        return map;
    }

    #analyzeRefresh(entry: HarApiEntry): InteractionStep | null {
        const body = entry.requestBody;
        const parentPo = body.parent;
        const targetPoVar = this.#findPoVarByTypeAndId(parentPo?.type, parentPo?.objectId, parentPo?.isNew);

        // Find the attribute that triggered the refresh
        const refreshedAttrId = body.parameters?.RefreshedPersistentObjectAttributeId;
        const poAttrs: any[] = parentPo?.attributes ?? [];
        const triggerAttr = poAttrs.find((a: any) => a.id === refreshedAttrId && a.isValueChanged);

        if (!triggerAttr || !targetPoVar)
            return null;

        // Track as handled so Save doesn't duplicate
        this.handledAttributes.add(`${targetPoVar}:${triggerAttr.name}`);

        return {
            index: entry.index,
            type: "SetAttributeValues",
            description: `Set ${triggerAttr.name} (triggers refresh)`,
            entry,
            targetVar: targetPoVar,
            attributeChanges: [{
                name: triggerAttr.name,
                value: triggerAttr.value,
                type: triggerAttr.type,
            }],
        };
    }

    #analyzeSelectReference(entry: HarApiEntry): InteractionStep | null {
        const body = entry.requestBody;
        const result = entry.responseBody?.result;

        // Find the PO being edited - it's the parent in the request
        const parentPo = body.parent;

        // Session-level reference selections target service.application.session
        const targetPoVar = parentPo?.type === "Session"
            ? "service.application.session"
            : this.#findPoVarByTypeAndId(parentPo?.type, parentPo?.objectId, parentPo?.isNew);

        // Find which attribute was changed by comparing request parent attributes with response
        const requestAttrs: any[] = parentPo?.attributes ?? [];
        const responseAttrs: any[] = result?.attributes ?? [];

        let attributeName = "";
        let selectedItemIds: string[] = [];
        let selectedDisplayValue = "";

        // The selectedItems in the query tell us what was selected
        const selectedItems: any[] = body.selectedItems ?? [];
        if (selectedItems.length > 0)
            selectedItemIds = selectedItems.map((item: any) => item.id).filter(Boolean);

        // Find the attribute that changed by comparing request vs response
        for (const respAttr of responseAttrs) {
            const reqAttr = requestAttrs.find((a: any) => a.name === respAttr.name);
            if (respAttr.type === "Reference" && respAttr.objectId && (!reqAttr?.objectId || reqAttr.objectId !== respAttr.objectId)) {
                attributeName = respAttr.name;
                selectedDisplayValue = respAttr.value ?? "";
                if (selectedItemIds.length === 0 && respAttr.objectId)
                    selectedItemIds = [respAttr.objectId];

                break;
            }
        }

        if (targetPoVar)
            this.handledAttributes.add(`${targetPoVar}:${attributeName}`);

        return {
            index: entry.index,
            type: "SelectReference",
            description: `Select ${attributeName} = "${selectedDisplayValue}"`,
            entry,
            targetPoVar: targetPoVar ?? "unknown",
            attributeName,
            selectedItemIds,
            selectedDisplayValue,
        };
    }

    #analyzeSave(entry: HarApiEntry, previousSteps: InteractionStep[]): InteractionStep {
        const body = entry.requestBody;
        const parentPo = body.parent;
        const targetPoVar = this.#findPoVarByTypeAndId(parentPo?.type, parentPo?.objectId, parentPo?.isNew);
        const poAttrs: any[] = parentPo?.attributes ?? [];

        // Find the step that created this PO (QueryAction New) to get original attribute values
        const createStep = previousSteps.find(s =>
            s.type === "QueryAction" && s.resultVar === targetPoVar
        );
        const originalAttrs = createStep
            ? this.#getOriginalAttributes(createStep)
            : new Map<string, any>();

        // Collect AsDetail changes — AsDetail attributes are never set via setAttributeValue
        const asDetailChanges: InteractionStep["asDetailChanges"] = [];
        const asDetailAttrNames = new Set<string>();

        for (const attr of poAttrs) {
            if (attr.type !== "AsDetail")
                continue;

            // Always skip AsDetail from normal setAttributeValue handling
            asDetailAttrNames.add(attr.name);

            if (!attr.isValueChanged)
                continue;
            const objects: any[] = attr.objects ?? [];

            const deletedObjectIds: string[] = [];
            const newObjectVars: string[] = [];
            const modifiedObjects: Array<{ objectId: string; changes: Array<{ name: string; value: any; type: string }> }> = [];

            for (const obj of objects) {
                if (obj.isDeleted) {
                    deletedObjectIds.push(obj.objectId);
                    continue;
                }

                if (obj.isNew) {
                    // Find the QueryAction step that created this new object via this AsDetail attribute
                    const newStep = previousSteps.find(s =>
                        s.type === "QueryAction" && s.asDetailAttributeName === attr.name && s.resultVar
                    );
                    if (newStep?.resultVar)
                        newObjectVars.push(newStep.resultVar);

                    continue;
                }

                // Existing, non-deleted object — check for changed attributes
                const objAttrs: any[] = obj.attributes ?? [];
                const objChanges: Array<{ name: string; value: any; type: string }> = [];
                for (const oa of objAttrs) {
                    if (!oa.isValueChanged || oa.isReadOnly)
                        continue;

                    objChanges.push({ name: oa.name, value: oa.value, type: oa.type });
                }

                if (objChanges.length > 0)
                    modifiedObjects.push({ objectId: obj.objectId, changes: objChanges });
            }

            if (deletedObjectIds.length > 0 || newObjectVars.length > 0 || modifiedObjects.length > 0) {
                // Determine the attr variable name from tracked query
                const queryTrack = [...this.trackedQueries.values()].find(q => q.asDetailAttributeName === attr.name && q.parentObjectVar === targetPoVar);
                const attrVarBase = attr.name[0].toLowerCase() + attr.name.slice(1) + "Attr";

                asDetailChanges.push({
                    attributeName: attr.name,
                    attrVar: queryTrack ? attrVarBase : attrVarBase,
                    parentVar: targetPoVar ?? "unknown",
                    newObjectVars,
                    deletedObjectIds,
                    modifiedObjects,
                });
            }
        }

        // Find changed attributes that need explicit setAttributeValue calls
        const changes: Array<{ name: string; value: any; type: string }> = [];
        for (const attr of poAttrs) {
            if (!attr.isValueChanged)
                continue;

            // Skip AsDetail attributes — handled via asDetailChanges
            if (asDetailAttrNames.has(attr.name))
                continue;

            // Skip attributes handled by SelectReference
            if (this.handledAttributes.has(`${targetPoVar}:${attr.name}`))
                continue;

            // Skip attributes whose value matches the original (auto-populated by backend)
            const originalVal = originalAttrs.get(attr.name);
            if (originalVal !== undefined && originalVal === attr.value)
                continue;

            // Skip read-only, audit, and system attributes
            if (attr.isReadOnly)
                continue;

            changes.push({
                name: attr.name,
                value: attr.value,
                type: attr.type,
            });
        }

        return {
            index: entry.index,
            type: "Save",
            description: `Save ${parentPo?.type ?? "object"}`,
            entry,
            saveTargetVar: targetPoVar ?? "unknown",
            attributeChanges: changes.length > 0 ? changes : undefined,
            asDetailChanges: asDetailChanges.length > 0 ? asDetailChanges : undefined,
        };
    }

    #analyzeGenericAction(entry: HarApiEntry, action: string): InteractionStep {
        const body = entry.requestBody;

        // Parse "PersistentObject.ActionName" or "Query.ActionName"
        const dotIndex = action.indexOf(".");
        const actionPrefix = dotIndex >= 0 ? action.substring(0, dotIndex) : "";
        const actionName = dotIndex >= 0 ? action.substring(dotIndex + 1) : action;

        if (actionPrefix === "Query") {
            // Query action - target is the query, not the parent PO
            const parentVar = this.#ensureParentTracked(body.parent, entry);
            const queryName = body.query?.name;
            const queryId = body.query?.id;
            let tracked = this.#findTrackedQuery(queryName, queryId);

            if (!tracked && queryName) {
                const queryVarName = this.#generateVarName(queryName + "Query", false);
                tracked = {
                    varName: queryVarName,
                    name: queryName,
                    id: queryId,
                    parentObjectVar: parentVar,
                    searched: false,
                };
                this.trackedQueries.set(queryName, tracked);
            }

            const needsDeclare = tracked != null && !tracked.searched;
            if (tracked)
                tracked.searched = true;

            // Extract selected item IDs for query actions (e.g. Delete)
            const selectedItems: any[] = body.selectedItems ?? [];
            const selectedItemIds = selectedItems.map((item: any) => item.id).filter(Boolean);

            // Check if action returns a result PO (e.g. BulkEdit)
            const responseResult = entry.responseBody?.result;
            let resultVar: string | undefined;
            if (responseResult?.type && responseResult?.attributes?.length > 0) {
                resultVar = this.#generateVarName(responseResult.type, false);
                this.#registerPo(resultVar, responseResult.type, responseResult.fullTypeName ?? responseResult.type, null, true, null, responseResult);
            }

            return {
                index: entry.index,
                type: "CustomAction",
                description: `Execute action ${actionName}`,
                entry,
                customActionName: actionName,
                customActionTargetVar: tracked?.varName ?? "unknown",
                resultVar,
                queryDeclareVar: needsDeclare ? tracked?.varName : undefined,
                queryDeclareParentVar: needsDeclare ? parentVar ?? undefined : undefined,
                queryDeclareName: needsDeclare ? queryName : undefined,
                queryActionSelectedItemIds: selectedItemIds.length > 0 ? selectedItemIds : undefined,
                ...this.#extractActionOptions(body),
            };
        }

        // PersistentObject action
        const parentPo = body.parent;
        const targetPoVar = this.#findPoVarByTypeAndId(parentPo?.type, parentPo?.objectId, parentPo?.isNew);

        return {
            index: entry.index,
            type: "CustomAction",
            description: `Execute action ${actionName}`,
            entry,
            customActionName: actionName,
            customActionTargetVar: targetPoVar ?? "unknown",
            ...this.#extractActionOptions(body),
        };
    }

    #registerPo(
        varName: string,
        type: string,
        typeId: string,
        objectId: string | null,
        isNew: boolean,
        parentVar: string | null,
        responseResult: any,
    ): void {
        const attributes = new Map<string, TrackedAttribute>();
        const attrs: any[] = responseResult?.attributes ?? [];
        for (const attr of attrs) {
            attributes.set(attr.name, {
                id: attr.id,
                name: attr.name,
                type: attr.type,
                value: attr.value,
            });
        }

        const key = `${type}:${objectId ?? "new"}`;
        this.trackedObjects.set(key, {
            varName,
            type,
            typeId,
            objectId,
            isNew,
            attributes,
            parentVar,
        });

        // Also index by varName for easy lookup
        this.trackedObjects.set(`var:${varName}`, {
            varName,
            type,
            typeId,
            objectId,
            isNew,
            attributes,
            parentVar,
        });

        // Register child queries
        const queries: any[] = responseResult?.queries ?? [];
        for (const q of queries) {
            const existing = this.trackedQueries.get(q.name);
            this.trackedQueries.set(q.name, {
                varName: existing?.varName ?? this.#generateVarName(q.name + "Query", false),
                name: q.name,
                id: q.id,
                parentObjectVar: varName,
                searched: false,
            });
        }

        // Register AsDetail attribute queries
        for (const attr of attrs) {
            if (attr.type !== "AsDetail" || !attr.details?.name)
                continue;

            const detailQuery = attr.details;
            const existing = this.trackedQueries.get(detailQuery.name);
            if (!existing) {
                this.trackedQueries.set(detailQuery.name, {
                    varName: this.#generateVarName(detailQuery.name + "Query", false),
                    name: detailQuery.name,
                    id: detailQuery.id,
                    parentObjectVar: varName,
                    searched: false,
                    asDetailAttributeName: attr.name,
                });
            }
        }
    }

    #ensureParentTracked(parent: any, entry: HarApiEntry): string | null {
        if (!parent?.type)
            return null;

        const key = `${parent.type}:${parent.objectId ?? "new"}`;
        const existing = this.trackedObjects.get(key);
        if (existing)
            return existing.varName;

        // Auto-register implicit parent with a synthetic LoadPersistentObject step
        const varName = this.#generateVarName(parent.type, false);
        this.#registerPo(varName, parent.type, parent.type, parent.objectId ?? null, !parent.objectId, null, parent);
        this.pendingSteps.push({
            index: entry.index,
            type: "LoadPersistentObject",
            description: `Load ${parent.type}${parent.objectId ? ` (${parent.objectId})` : ""}`,
            entry,
            poVar: varName,
            typeName: parent.type,
            objectId: parent.objectId,
            parentVar: null,
        });

        return varName;
    }

    #findPoVarByTypeAndId(type: string | undefined, objectId: string | undefined, isNew?: boolean): string | null {
        if (!type)
            return null;

        // Try exact match first
        if (objectId) {
            const key = `${type}:${objectId}`;
            const found = this.trackedObjects.get(key);
            if (found)
                return found.varName;
        }

        // Try new object match
        if (isNew) {
            const key = `${type}:new`;
            const found = this.trackedObjects.get(key);
            if (found)
                return found.varName;
        }

        // Search by type
        for (const [key, obj] of this.trackedObjects) {
            if (key.startsWith("var:"))
                continue;
            if (obj.type === type)
                return obj.varName;
        }

        return null;
    }

    #findTrackedQuery(name: string | undefined, id: string | undefined): TrackedQuery | undefined {
        if (name) {
            const byName = this.trackedQueries.get(name);
            if (byName)
                return byName;
        }

        if (id) {
            for (const q of this.trackedQueries.values()) {
                if (q.id === id)
                    return q;
            }
        }

        return undefined;
    }

    #findTrackedQueryById(id: string | undefined): TrackedQuery | undefined {
        if (!id)
            return undefined;

        for (const q of this.trackedQueries.values()) {
            if (q.id === id)
                return q;
        }

        return undefined;
    }

    #isEqualArray(left: string[], right: string[]): boolean {
        if (left.length !== right.length)
            return false;

        return left.every((value, index) => value === right[index]);
    }

    #normalizeStringArray(value: any): string[] {
        if (!Array.isArray(value))
            return [];

        return value.filter(v => v !== null && v !== undefined).map(v => String(v));
    }

    #extractActionOptions(body: Record<string, any>): { actionParameters?: Record<string, any>; actionMenuOption?: number } {
        const raw = body.parameters;
        if (!raw || typeof raw !== "object")
            return {};

        const params = { ...raw };
        const menuOption = params.MenuOption != null && Number(params.MenuOption) >= 0 ? Number(params.MenuOption) : undefined;
        delete params.MenuOption;
        delete params.MenuLabel;

        return {
            actionParameters: Object.keys(params).length > 0 ? params : undefined,
            actionMenuOption: menuOption,
        };
    }

    #getOriginalAttributes(createStep: InteractionStep): Map<string, any> {
        const result = new Map<string, any>();
        const responseResult = createStep.entry.responseBody?.result;
        const attrs: any[] = responseResult?.attributes ?? [];
        for (const attr of attrs) {
            if (attr.value !== undefined && attr.value !== null && attr.value !== "")
                result.set(attr.name, attr.value);
        }
        return result;
    }

    #generateVarName(typeName: string, isNew: boolean): string {
        // "Personen_Patient" -> "patient"
        // "PersoonContactGegevens" -> "contactGegevens"
        // "PersoonContactGegevensViewQuery" -> "contactGegevensViewQuery"
        let base = typeName;

        // Remove common prefixes that include underscore
        if (base.includes("_")) {
            const parts = base.split("_");
            base = parts[parts.length - 1];
        }

        // Remove "Persoon" prefix for readability
        if (base.startsWith("Persoon") && base.length > 7)
            base = base.substring(7);

        // camelCase
        base = base[0].toLowerCase() + base.slice(1);

        if (isNew)
            base = "new" + base[0].toUpperCase() + base.slice(1);

        // Deduplicate
        const count = (this.varCounts.get(base) ?? 0) + 1;
        this.varCounts.set(base, count);

        return count > 1 ? `${base}${count}` : base;
    }
}
