import type { InteractionStep } from "./types.js";

export class CodeGenerator {
    #needsReferenceImport = false;
    #needsAsDetailImport = false;
    #hasInitialize = false;
    #lines: string[] = [];
    #indent = "    ";

    generate(steps: InteractionStep[]): string {
        this.#lines = [];
        this.#needsReferenceImport = steps.some(s => s.type === "SelectReference");
        this.#needsAsDetailImport = steps.some(s => !!s.asDetailAttributeName || !!s.asDetailChanges?.length);
        this.#hasInitialize = steps.some(s => s.type === "Initialize");

        this.#emitImports();
        this.#emitBlankLine();

        if (this.#hasInitialize)
            this.#emit("async function replay() {");
        else
            this.#emit("async function replay(service: Service) {");

        for (const step of steps) {
            this.#emitBlankLine();
            this.#emitStep(step);
        }

        this.#emit("}");

        return this.#lines.join("\n");
    }

    #emitStep(step: InteractionStep): void {
        switch (step.type) {
            case "Initialize":
                this.#emitInitialize(step);
                break;
            case "LoadPersistentObject":
                this.#emitLoadPO(step);
                break;
            case "LoadQuery":
                this.#emitLoadQuery(step);
                break;
            case "SearchQuery":
                this.#emitSearchQuery(step);
                break;
            case "RefreshQuery":
                this.#emitRefreshQuery(step);
                break;
            case "ReorderQuery":
                this.#emitReorderQuery(step);
                break;
            case "QueryAction":
                this.#emitQueryAction(step);
                break;
            case "SelectReference":
                this.#emitSelectReference(step);
                break;
            case "SetAttributeValues":
                this.#emitSetAttributeValues(step);
                break;
            case "Save":
                this.#emitSave(step);
                break;
            case "CustomAction":
                this.#emitCustomAction(step);
                break;
        }
    }

    #emitInitialize(step: InteractionStep): void {
        this.#emitComment(step.description);
        this.#emitIndented(`const service = new Service("${step.serviceUri}");`);
        this.#emitIndented(`await service.signInUsingDefaultCredentials();`);
    }

    #emitLoadPO(step: InteractionStep): void {
        this.#emitComment(step.description);
        const parentArg = step.parentVar ?? "null";
        this.#emitIndented(`const ${step.poVar} = await service.getPersistentObject(${parentArg}, "${step.typeName}", "${step.objectId}");`);
    }

    #emitLoadQuery(step: InteractionStep): void {
        this.#emitComment(step.description);
        this.#emitIndented(`const ${step.queryVar} = await service.getQuery("${step.queryName}");`);
    }

    #emitSearchQuery(step: InteractionStep): void {
        this.#emitComment(step.description);
        if (step.isStandalone) {
            this.#emitIndented(`const ${step.queryVar} = await service.getQuery("${step.queryName}");`);
            this.#emitColumnFilterChanges(step);
            this.#emitIndented(`await ${step.queryVar}.search();`);
        }
        else {
            this.#emitIndented(`const ${step.queryVar} = ${step.queryParentVar}.queries["${step.queryName}"];`);
            this.#emitColumnFilterChanges(step);
            this.#emitIndented(`await ${step.queryVar}.search();`);
        }
    }

    #emitRefreshQuery(step: InteractionStep): void {
        this.#emitComment(step.description);
        this.#emitColumnFilterChanges(step);
        this.#emitIndented(`await ${step.queryVar}.search();`);
    }

    #emitQueryAction(step: InteractionStep): void {
        this.#emitComment(step.description);

        // AsDetail: use attribute.newObject() instead of query.getAction("New")
        if (step.asDetailAttributeName && step.asDetailParentVar) {
            this.#needsAsDetailImport = true;
            const attrVarName = this.#attrVarName(step.asDetailAttributeName);
            this.#emitIndented(`const ${attrVarName} = ${step.asDetailParentVar}.getAttribute("${step.asDetailAttributeName}") as PersistentObjectAttributeAsDetail;`);
            this.#emitIndented(`const ${step.resultVar} = await ${attrVarName}.newObject();`);
            return;
        }

        // Declare query variable from parent if needed (both filter and non-filter cases)
        if (step.queryDeclareVar && step.queryDeclareName) {
            if (step.queryDeclareParentVar)
                this.#emitIndented(`const ${step.queryDeclareVar} = ${step.queryDeclareParentVar}.queries["${step.queryDeclareName}"];`);
            else
                this.#emitIndented(`const ${step.queryDeclareVar} = await service.getQuery("${step.queryDeclareName}");`);
        }

        if (step.filtersSourceQueryVar) {
            this.#emitIndented(`const ${step.resultVar} = await ${step.filtersSourceQueryVar}.filters.createNew();`);
            return;
        }

        const opts = this.#formatExecuteOptions(step);
        this.#emitIndented(`const ${step.resultVar} = await ${step.sourceQueryVar}.getAction("${step.actionName}").execute(${opts});`);
    }

    #emitReorderQuery(step: InteractionStep): void {
        this.#emitComment(step.description);

        // Declare query variable from parent if needed
        if (step.queryDeclareVar && step.queryDeclareName) {
            if (step.queryDeclareParentVar)
                this.#emitIndented(`const ${step.queryDeclareVar} = ${step.queryDeclareParentVar}.queries["${step.queryDeclareName}"];`);
            else
                this.#emitIndented(`const ${step.queryDeclareVar} = await service.getQuery("${step.queryDeclareName}");`);

            this.#emitIndented(`await ${step.queryDeclareVar}.search();`);
        }

        const queryVar = step.reorderQueryVar ?? "unknown";
        const beforeItemId = step.reorderItemIds?.[0];
        const itemId = step.reorderItemIds?.[1];
        const afterItemId = step.reorderItemIds?.[2];

        const toQueryItem = (itemId: string | null | undefined, source: string): string => itemId == null
            ? "null"
            : `${source}.items.find(i => i.id === "${itemId}")`;

        const beforeExpr = toQueryItem(beforeItemId, queryVar);
        const itemExpr = toQueryItem(itemId, queryVar);
        const afterExpr = toQueryItem(afterItemId, queryVar);

        this.#emitIndented(`await ${queryVar}.reorder(`);
        this.#emitIndented(`${this.#indent}${beforeExpr},`);
        this.#emitIndented(`${this.#indent}${itemExpr},`);
        this.#emitIndented(`${this.#indent}${afterExpr}`);
        this.#emitIndented(`);`);
    }

    #emitColumnFilterChanges(step: InteractionStep): void {
        const emittedColumns = new Set<string>();

        for (const columnFilter of step.columnFilterChanges ?? []) {
            const colVarName = columnFilter.columnName[0].toLowerCase() + columnFilter.columnName.slice(1) + "Column";

            if (!emittedColumns.has(columnFilter.columnName))
                this.#emitIndented(`const ${colVarName} = ${step.queryVar}.getColumn("${columnFilter.columnName}");`);

            this.#emitIndented(`${colVarName}.selectedDistincts = ${this.#formatValueArray(columnFilter.selectedDistincts)};`);
            if (columnFilter.inversed)
                this.#emitIndented(`${colVarName}.selectedDistinctsInversed = true;`);
            this.#emitBlankLine();
            emittedColumns.add(columnFilter.columnName);
        }
    }

    #emitSelectReference(step: InteractionStep): void {
        const attrVarName = this.#attrVarName(step.attributeName!);
        this.#emitComment(`${step.description}`);
        this.#emitIndented(`const ${attrVarName} = ${step.targetPoVar}.getAttribute("${step.attributeName}") as PersistentObjectAttributeWithReference;`);

        const ids = step.selectedItemIds ?? [];
        if (ids.length === 1)
            this.#emitIndented(`await ${attrVarName}.changeReference(["${ids[0]}"]);`);
        else if (ids.length > 1) {
            const idsStr = ids.map(id => `"${id}"`).join(", ");
            this.#emitIndented(`await ${attrVarName}.changeReference([${idsStr}]);`);
        }
    }

    #emitSetAttributeValues(step: InteractionStep): void {
        this.#emitComment(step.description);
        for (const change of step.attributeChanges ?? []) {
            const formattedValue = this.#formatValue(change.value, change.type);
            this.#emitIndented(`await ${step.targetVar}.setAttributeValue("${change.name}", ${formattedValue});`);
        }
    }

    #emitSave(step: InteractionStep): void {
        // Emit attribute value changes before save
        if (step.attributeChanges && step.attributeChanges.length > 0) {
            this.#emitComment("Set attribute values");
            for (const change of step.attributeChanges) {
                const formattedValue = this.#formatValue(change.value, change.type);
                this.#emitIndented(`await ${step.saveTargetVar}.setAttributeValue("${change.name}", ${formattedValue});`);
            }
            this.#emitBlankLine();
        }

        // Emit AsDetail changes (push new objects, deletes, modifications) before save
        for (const detail of step.asDetailChanges ?? []) {
            const attrVarName = detail.attrVar;

            // Declare the AsDetail attribute if not already declared by a QueryAction step
            if (detail.newObjectVars.length === 0) {
                this.#needsAsDetailImport = true;
                this.#emitIndented(`const ${attrVarName} = ${detail.parentVar}.getAttribute("${detail.attributeName}") as PersistentObjectAttributeAsDetail;`);
            }

            // Push new objects
            for (const newVar of detail.newObjectVars) {
                this.#emitIndented(`${newVar}.parent = ${detail.parentVar};`);
                this.#emitIndented(`${attrVarName}.objects.push(${newVar});`);
            }

            // Delete objects
            for (const objectId of detail.deletedObjectIds) {
                this.#emitComment(`Delete ${detail.attributeName} object (${objectId})`);
                this.#emitIndented(`${attrVarName}.objects.find(o => o.objectId === "${objectId}").isDeleted = true;`);
            }

            // Modify existing objects
            for (const mod of detail.modifiedObjects) {
                this.#emitComment(`Update ${detail.attributeName} object (${mod.objectId})`);
                const objVar = `${attrVarName}Obj${mod.objectId}`;
                this.#emitIndented(`const ${objVar} = ${attrVarName}.objects.find(o => o.objectId === "${mod.objectId}");`);
                for (const change of mod.changes) {
                    const formattedValue = this.#formatValue(change.value, change.type);
                    this.#emitIndented(`await ${objVar}.setAttributeValue("${change.name}", ${formattedValue});`);
                }
            }

            this.#emitBlankLine();
        }

        this.#emitComment(step.description);
        this.#emitIndented(`await ${step.saveTargetVar}.save();`);
    }

    #emitCustomAction(step: InteractionStep): void {
        this.#emitComment(step.description);

        // Declare query variable from parent if needed
        if (step.queryDeclareVar && step.queryDeclareParentVar && step.queryDeclareName) {
            this.#emitIndented(`const ${step.queryDeclareVar} = ${step.queryDeclareParentVar}.queries["${step.queryDeclareName}"];`);
            // Search the query to populate items (needed for selectedItems)
            if (step.queryActionSelectedItemIds?.length)
                this.#emitIndented(`await ${step.queryDeclareVar}.search();`);
        }

        const opts = this.#formatExecuteOptions(step);
        if (step.resultVar)
            this.#emitIndented(`const ${step.resultVar} = await ${step.customActionTargetVar}.getAction("${step.customActionName}").execute(${opts});`);
        else
            this.#emitIndented(`await ${step.customActionTargetVar}.getAction("${step.customActionName}").execute(${opts});`);
    }

    #emitImports(): void {
        const typeImports: string[] = [];
        if (this.#needsReferenceImport)
            typeImports.push("PersistentObjectAttributeWithReference");
        if (this.#needsAsDetailImport)
            typeImports.push("PersistentObjectAttributeAsDetail");

        if (this.#hasInitialize) {
            this.#emit(`import { Service } from "@vidyano/core";`);
            if (typeImports.length > 0)
                this.#emit(`import type { ${typeImports.join(", ")} } from "@vidyano/core";`);
        }
        else {
            const imports = ["Service", ...typeImports];
            this.#emit(`import type { ${imports.join(", ")} } from "@vidyano/core";`);
        }
    }

    #emitComment(text: string): void {
        this.#emitIndented(`// ${text}`);
    }

    #emitIndented(line: string): void {
        this.#lines.push(this.#indent + line);
    }

    #emitBlankLine(): void {
        this.#lines.push("");
    }

    #emit(line: string): void {
        this.#lines.push(line);
    }

    #formatValue(value: any, type: string): string {
        if (value === null || value === undefined)
            return "null";

        if (type === "Boolean" || type === "NullableBoolean")
            return value === "True" || value === true ? "true" : "false";

        if (["Int32", "Int64", "NullableInt32", "NullableInt64", "Decimal", "NullableDecimal", "Double", "NullableDouble"].includes(type))
            return String(value);

        // Default: string
        return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }

    #formatValueArray(values: string[]): string {
        return `[${values.map(v => this.#formatValue(v, "String")).join(", ")}]`;
    }

    #formatExecuteOptions(step: InteractionStep): string {
        const parts: string[] = [];

        if (step.queryActionSelectedItemIds?.length) {
            const ids = step.queryActionSelectedItemIds;
            const idsFilter = ids.length === 1
                ? `i => i.id === "${ids[0]}"`
                : `i => [${ids.map(id => `"${id}"`).join(", ")}].includes(i.id)`;
            parts.push(`selectedItems: ${step.customActionTargetVar ?? step.sourceQueryVar}.items.filter(${idsFilter})`);
        }

        if (step.actionMenuOption != null)
            parts.push(`menuOption: ${step.actionMenuOption}`);

        if (step.actionParameters)
            parts.push(`parameters: ${JSON.stringify(step.actionParameters)}`);

        if (parts.length === 0)
            return "";

        return `{ ${parts.join(", ")} }`;
    }

    #attrVarName(attributeName: string): string {
        const base = attributeName[0].toLowerCase() + attributeName.slice(1);
        return base + "Attr";
    }
}
