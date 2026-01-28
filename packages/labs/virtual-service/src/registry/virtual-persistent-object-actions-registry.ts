import { Dto } from "@vidyano/core";
import { VirtualPersistentObjectActions } from "../virtual-persistent-object-actions.js";
import { VirtualPersistentObject, VirtualPersistentObjectAttribute, ConversionContext, createVirtualPersistentObject, createVirtualPersistentObjectAttribute, unwrapVirtualPersistentObject } from "../virtual-persistent-object.js";
import { VirtualQueryExecuteResult } from "../types.js";
import { fromServiceValue, toServiceValue } from "../virtual-service-data-type.js";
import type { BusinessRuleValidator } from "../business-rules.js";

/** Lifecycle methods that can be overridden in VirtualPersistentObjectActions */
type LifecycleMethod = "onSave" | "onNew" | "onDelete" | "onRefresh" | "onLoad" | "onConstruct" | "onConstructQuery" | "onSelectReference" | "onExecuteQuery" | "getEntities";

/** Mapping of overridden lifecycle methods to actions */
interface OverrideInfo {
    overriddenMethods: Set<LifecycleMethod>;
}

/**
 * Registry for managing VirtualPersistentObjectActions classes
 * Provides methods to register actions classes and execute lifecycle hooks
 */
export class VirtualPersistentObjectActionsRegistry {
    #actionsClasses = new Map<string, typeof VirtualPersistentObjectActions>();
    #overrideInfo = new Map<string, OverrideInfo>();
    #validator: BusinessRuleValidator;

    constructor(validator: BusinessRuleValidator) {
        this.#validator = validator;
    }

    /**
     * Registers a VirtualPersistentObjectActions class for a specific type
     * @param type - The PersistentObject type name
     * @param ActionsClass - The VirtualPersistentObjectActions class constructor
     */
    register(type: string, ActionsClass: typeof VirtualPersistentObjectActions): void {
        this.#actionsClasses.set(type, ActionsClass);

        // Detect overridden methods
        const overriddenMethods = this.#detectOverriddenMethods(ActionsClass);
        this.#overrideInfo.set(type, { overriddenMethods });
    }

    /**
     * Detects which lifecycle methods are overridden in the given class
     * @param ActionsClass - The VirtualPersistentObjectActions class constructor
     * @returns Set of overridden method names
     */
    #detectOverriddenMethods(ActionsClass: typeof VirtualPersistentObjectActions): Set<LifecycleMethod> {
        const overridden = new Set<LifecycleMethod>();
        const baseProto = VirtualPersistentObjectActions.prototype;
        const classProto = ActionsClass.prototype;

        const methodsToCheck: LifecycleMethod[] = [
            "onSave", "onNew", "onDelete", "onRefresh",
            "onLoad", "onConstruct", "onConstructQuery", "onSelectReference", "onExecuteQuery", "getEntities"
        ];

        for (const methodName of methodsToCheck) {
            if (classProto[methodName] !== baseProto[methodName])
                overridden.add(methodName);
        }

        return overridden;
    }

    /**
     * Checks if a specific lifecycle method is overridden for a type
     * @param type - The PersistentObject type name
     * @param methodName - The lifecycle method name
     * @returns true if the method is overridden, false otherwise
     */
    isMethodOverridden(type: string, methodName: LifecycleMethod): boolean {
        const info = this.#overrideInfo.get(type);
        if (!info)
            return false;

        return info.overriddenMethods.has(methodName);
    }

    /**
     * Checks if a type has registered actions
     * @param type - The PersistentObject type name
     * @returns true if the type has registered actions, false otherwise
     */
    has(type: string): boolean {
        return this.#actionsClasses.has(type);
    }

    /**
     * Creates a new instance of the actions class for a type
     * Returns a default VirtualPersistentObjectActions if no custom actions are registered
     * Injects validator and translate function into the instance
     * @param type - The PersistentObject type name
     * @returns A new instance of the VirtualPersistentObjectActions class
     */
    createInstance(type: string): VirtualPersistentObjectActions {
        const ActionsClass = this.#actionsClasses.get(type);
        const instance = ActionsClass ? new ActionsClass() : new VirtualPersistentObjectActions();

        // Inject validator and translate function
        instance.setValidator(this.#validator);
        instance.setTranslate(this.#validator.translate);

        return instance;
    }

    /**
     * Executes onConstruct lifecycle hook
     * @param dto - The PersistentObject DTO
     * @param conversionContext - The conversion context for type conversions
     */
    executeConstruct(dto: Dto.PersistentObjectDto, conversionContext: ConversionContext): void {
        const wrappedObj = createVirtualPersistentObject(dto, conversionContext);
        const instance = this.createInstance(dto.type);
        instance.onConstruct(wrappedObj);
    }

    /**
     * Executes onLoad lifecycle hook
     * @param dto - The PersistentObject DTO
     * @param parent - The parent DTO (or null)
     * @param conversionContext - The conversion context for type conversions
     * @returns The updated DTO
     */
    async executeLoad(
        dto: Dto.PersistentObjectDto,
        parent: Dto.PersistentObjectDto | null,
        conversionContext: ConversionContext
    ): Promise<Dto.PersistentObjectDto> {
        const wrappedObj = createVirtualPersistentObject(dto, conversionContext);

        // Wrap parent if provided
        let wrappedParent: VirtualPersistentObject | null = null;
        if (parent) {
            const parentContext = this.#createConversionContext();
            wrappedParent = createVirtualPersistentObject(parent, parentContext);
        }

        const instance = this.createInstance(dto.type);
        const result = await instance.onLoad(wrappedObj, wrappedParent);

        return unwrapVirtualPersistentObject(result);
    }

    /**
     * Executes onNew lifecycle hook
     * @param dto - The PersistentObject DTO
     * @param parent - The parent DTO (or null)
     * @param query - The query DTO (or null)
     * @param parameters - The parameters (or null)
     * @param conversionContext - The conversion context for type conversions
     * @returns The updated DTO
     */
    async executeNew(
        dto: Dto.PersistentObjectDto,
        parent: Dto.PersistentObjectDto | null,
        query: Dto.QueryDto | null,
        parameters: Record<string, string> | null,
        conversionContext: ConversionContext
    ): Promise<Dto.PersistentObjectDto> {
        const wrappedObj = createVirtualPersistentObject(dto, conversionContext);

        // Wrap parent if provided
        let wrappedParent: VirtualPersistentObject | null = null;
        if (parent) {
            const parentContext = this.#createConversionContext();
            wrappedParent = createVirtualPersistentObject(parent, parentContext);
        }

        const instance = this.createInstance(dto.type);
        const result = await instance.onNew(wrappedObj, wrappedParent, query, parameters);

        return unwrapVirtualPersistentObject(result);
    }

    /**
     * Executes onRefresh lifecycle hook
     * @param dto - The PersistentObject DTO
     * @param attribute - The attribute that triggered the refresh (or undefined)
     * @param conversionContext - The conversion context for type conversions
     * @returns The updated DTO
     */
    async executeRefresh(
        dto: Dto.PersistentObjectDto,
        attribute: Dto.PersistentObjectAttributeDto | undefined,
        conversionContext: ConversionContext
    ): Promise<Dto.PersistentObjectDto> {
        const wrappedObj = createVirtualPersistentObject(dto, conversionContext);

        // Wrap attribute if provided
        let wrappedAttribute: VirtualPersistentObjectAttribute | undefined;
        if (attribute)
            wrappedAttribute = createVirtualPersistentObjectAttribute(attribute, conversionContext);

        const instance = this.createInstance(dto.type);
        const result = await instance.onRefresh(wrappedObj, wrappedAttribute);

        return unwrapVirtualPersistentObject(result);
    }

    /**
     * Executes onSave lifecycle hook
     * @param dto - The PersistentObject DTO
     * @param conversionContext - The conversion context for type conversions
     * @returns The updated DTO
     */
    async executeSave(
        dto: Dto.PersistentObjectDto,
        conversionContext: ConversionContext
    ): Promise<Dto.PersistentObjectDto> {
        const wrappedObj = createVirtualPersistentObject(dto, conversionContext);
        const instance = this.createInstance(dto.type);
        const result = await instance.onSave(wrappedObj);

        return unwrapVirtualPersistentObject(result);
    }

    /**
     * Executes onSelectReference lifecycle hook
     * @param parent - The parent DTO
     * @param referenceAttribute - The reference attribute DTO
     * @param query - The query DTO
     * @param selectedItem - The selected item (or null)
     * @param conversionContext - The conversion context for type conversions
     */
    async executeSelectReference(
        parent: Dto.PersistentObjectDto,
        referenceAttribute: Dto.PersistentObjectAttributeDto,
        query: Dto.QueryDto,
        selectedItem: Dto.QueryResultItemDto | null,
        conversionContext: ConversionContext
    ): Promise<void> {
        const wrappedParent = createVirtualPersistentObject(parent, conversionContext);
        const instance = this.createInstance(parent.type);
        await instance.onSelectReference(wrappedParent, referenceAttribute, query, selectedItem);
    }

    /**
     * Executes onDelete lifecycle hook
     * @param parent - The parent DTO (or null)
     * @param query - The query DTO
     * @param selectedItems - The selected items
     */
    async executeDelete(
        parent: Dto.PersistentObjectDto | null,
        query: Dto.QueryDto,
        selectedItems: Dto.QueryResultItemDto[]
    ): Promise<void> {
        // Wrap parent if provided
        let wrappedParent: VirtualPersistentObject | null = null;
        if (parent) {
            const conversionContext = this.#createConversionContext();
            wrappedParent = createVirtualPersistentObject(parent, conversionContext);
        }

        // Get type from query's persistentObject
        const type = query.persistentObject?.type;
        if (!type)
            throw new Error("Query does not have a persistentObject type");

        const instance = this.createInstance(type);
        await instance.onDelete(wrappedParent, query, selectedItems);
    }

    /**
     * Executes onConstructQuery lifecycle hook
     * @param query - The query DTO
     * @param parent - The parent DTO (or null)
     */
    executeConstructQuery(
        query: Dto.QueryDto,
        parent: Dto.PersistentObjectDto | null
    ): void {
        // Wrap parent if provided
        let wrappedParent: VirtualPersistentObject | null = null;
        if (parent) {
            const conversionContext = this.#createConversionContext();
            wrappedParent = createVirtualPersistentObject(parent, conversionContext);
        }

        // Get type from query's persistentObject
        const type = query.persistentObject?.type;
        if (!type)
            throw new Error("Query does not have a persistentObject type");

        const instance = this.createInstance(type);
        instance.onConstructQuery(query, wrappedParent);
    }

    /**
     * Executes onExecuteQuery lifecycle hook
     * @param query - The query DTO with textSearch, sortOptions, skip, top set
     * @param parent - The parent DTO (or null)
     * @param data - Default data from the query config (used if getEntities is not overridden)
     * @returns The query execution result with items and totalItems
     */
    async executeQuery(
        query: Dto.QueryDto,
        parent: Dto.PersistentObjectDto | null,
        data: Record<string, any>[]
    ): Promise<VirtualQueryExecuteResult> {
        // Wrap parent if provided
        let wrappedParent: VirtualPersistentObject | null = null;
        if (parent) {
            const conversionContext = this.#createConversionContext();
            wrappedParent = createVirtualPersistentObject(parent, conversionContext);
        }

        // Get type from query's persistentObject
        const type = query.persistentObject?.type;
        if (!type)
            throw new Error("Query does not have a persistentObject type");

        const instance = this.createInstance(type);
        return await instance.onExecuteQuery(query, wrappedParent, data);
    }

    /**
     * Creates a conversion context for type conversions
     * @returns A ConversionContext with type conversion methods
     */
    #createConversionContext(): ConversionContext {
        return {
            getConvertedValue: (attr: Dto.PersistentObjectAttributeDto) => {
                return fromServiceValue(attr.value, attr.type);
            },
            setConvertedValue: (attr: Dto.PersistentObjectAttributeDto, value: any) => {
                attr.value = toServiceValue(value, attr.type);
                attr.isValueChanged = true;
            }
        };
    }
}
