import { Action } from "./action.js";
import { CultureInfo } from "./cultures.js";
import { _internal, PersistentObjectAttributeSymbols } from "./_internals.js";
import { ServiceObject } from "./service-object.js";
import { DataType } from "./service-data-type.js";
import type { KeyValuePair } from "./typings/common.js";
import type * as Dto from "./typings/service.js";
import type { PersistentObject } from "./persistent-object.js";
import type { PersistentObjectAttributeGroup } from "./persistent-object-attribute-group.js";
import type { PersistentObjectAttributeTab } from "./persistent-object-tab.js";
import type { PersistentObjectAttributeWithReference } from "./persistent-object-attribute-with-reference.js";
import type { Service } from "./service.js";

export type PersistentObjectAttributeOption = KeyValuePair<string, string>;

/**
 * Represents an attribute of a persistent object.
 */
export class PersistentObjectAttribute extends ServiceObject {
    #actions: Array<Action> & Record<string, Action>;
    #cachedValue: any;
    readonly #column: number;
    readonly #columnSpan: number;
    #displayValue: string;
    #displayValueSource: any;
    #group: PersistentObjectAttributeGroup;
    #groupKey: string;
    readonly #id: string;
    #input: HTMLInputElement;
    #isReadOnly: boolean;
    #isRequired: boolean;
    readonly #isSensitive: boolean;
    readonly #isSystem: boolean;
    #isValueChanged: boolean;
    #isVisible: boolean;
    #label: string;
    #lastParsedValue: string;
    readonly #name: string;
    #offset: number;
    #options: string[] | PersistentObjectAttributeOption[];
    #parent!: PersistentObject;
    #refreshServiceValue: string;
    #rules: string;
    #serviceOptions: string[];
    #serviceValue: string;
    #tag: any;
    #tab: PersistentObjectAttributeTab;
    #tabKey: string;
    #toolTip: string;
    #triggersRefresh: boolean;
    readonly #type: string;
    #typeHints: Record<string | symbol, any>;
    #validationError: string;
    #visibility: Dto.PersistentObjectAttributeDto["visibility"];

    protected _shouldRefresh: boolean = false;

    /**
     * Initializes a new instance of the PersistentObjectAttribute class.
     * 
     * @param service - The service instance providing backend functionality.
     * @param attr - The attribute data from the service.
     * @param parent - The parent persistent object that owns this attribute.
     */
    constructor(service: Service, attr: Dto.PersistentObjectAttributeDto, parent: PersistentObject) {
        super(service);

        this[PersistentObjectAttributeSymbols.IsPersistentObjectAttribute] = true;
        this[PersistentObjectAttributeSymbols.BackupServiceValue] = this.#backupServiceValue.bind(this);
        this[PersistentObjectAttributeSymbols.RefreshFromResult] = this._refreshFromResult.bind(this);
        this[PersistentObjectAttributeSymbols.ToServiceObject] = this._toServiceObject.bind(this);

        this.#id = attr.id;
        this.#parent = parent;
        this.#isSystem = !!attr.isSystem;
        this.#name = attr.name;
        this.#type = attr.type;
        this.#label = attr.label;
        this.#serviceValue = attr.value !== undefined ? attr.value : null;
        this.#groupKey = attr.group;
        this.#tabKey = attr.tab;
        this.#isReadOnly = !!attr.isReadOnly;
        this.#isRequired = !!attr.isRequired;
        this.#isValueChanged = !!attr.isValueChanged;
        this.#isSensitive = !!attr.isSensitive;
        this.#offset = attr.offset || 0;
        this.#toolTip = attr.toolTip || "";
        this.#rules = attr.rules;
        this.validationError = attr.validationError || null;
        this.#typeHints = attr.typeHints;
        this.#triggersRefresh = !!attr.triggersRefresh;
        this.#column = attr.column;
        this.#columnSpan = attr.columnSpan || 0;
        this.visibility = attr.visibility;
        this.#tag = attr.tag;

        if (this.type !== "Reference")
            this.options = attr.options;

        if (this.type === "BinaryFile") {
            const input = document?.createElement("input");
            input.type = "file";
            input.accept = this.getTypeHint("accept", null);

            this.#input = input;
        }

        this.#actions = <any>[];
        Action.addActions(this.service, this.parent, this.#actions, attr.actions || []);
    }

    /**
     * Gets the unique identifier.
     */
    get id(): string {
        return this.#id;
    }

    /**
     * Gets the name.
     */
    get name() {
        return this.#name;
    }

    /**
     * Gets the data type.
     */
    get type() {
        return this.#type;
    }

    /**
     * Gets or sets the label.
     */
    get label(): string {
        return this.#label;
    }
    set label(label: string) {
        const oldLabel = this.#label;
        if (oldLabel !== label)
            this.notifyPropertyChanged("label", this.#label = label, oldLabel);
    }

    /**
     * Gets the group key.
     */
    get groupKey(): string {
        return this.#groupKey;
    }

    /**
     * Gets or sets the group.
     */
    get group(): PersistentObjectAttributeGroup {
        return this.#group;
    }
    set group(group: PersistentObjectAttributeGroup) {
        const oldGroup = this.#group;
        this.#group = group;

        this.#groupKey = group ? group.key : null;

        this.notifyPropertyChanged("group", group, oldGroup);
    }

    /**
     * Gets the column number.
     */
    get column(): number {
        return this.#column;
    }

    /**
     * Gets the column span.
     */
    get columnSpan(): number {
        return this.#columnSpan;
    }

    /**
     * Gets the offset.
     */
    get offset() {
        return this.#offset;
    }

    /**
     * Gets the parent persistent object.
     */
    get parent(): PersistentObject {
        return this.#parent;
    }

    /**
     * Gets the tab key.
     */
    get tabKey(): string {
        return this.#tabKey;
    }

    /**
     * Gets or sets the tab.
     */
    get tab(): PersistentObjectAttributeTab {
        return this.#tab;
    }
    set tab(tab: PersistentObjectAttributeTab) {
        const oldTab = this.#tab;
        this.#tab = tab;

        this.#tabKey = tab ? tab.key : null;

        this.notifyPropertyChanged("tab", tab, oldTab);
    }

    /**
     * Gets whether the attribute is system-defined.
     */
    get isSystem(): boolean {
        return this.#isSystem;
    }

    /**
     * Gets or sets the visibility.
     */
    get visibility(): Dto.PersistentObjectAttributeDto["visibility"] {
        return this.#visibility;
    }
    set visibility(visibility: Dto.PersistentObjectAttributeDto["visibility"]) {
        if (this.#visibility === visibility)
            return;

        const oldIsVisible = this.#isVisible;
        const newIsVisible = visibility.indexOf("Always") >= 0 || visibility.indexOf(this.parent.isNew ? "New" : "Read") >= 0;
        if (newIsVisible !== oldIsVisible)
            this.#isVisible = newIsVisible;

        const oldVisibility = this.#visibility;
        this.notifyPropertyChanged("visibility", this.#visibility = visibility, oldVisibility);

        if (newIsVisible !== oldIsVisible) {
            this.notifyPropertyChanged("isVisible", this.#isVisible, oldIsVisible);

            if (typeof(oldVisibility) !== "undefined" && !this.parent.isBusy)
                _internal(this.parent).refreshTabsAndGroups(this);
        }
    }

    /**
     * Gets the computed visibility status.
     */
    get isVisible(): boolean {
        return this.#isVisible;
    }

    /**
     * Gets or sets the options for the attribute.
     */
    get options(): string[] | PersistentObjectAttributeOption[] {
        return this.#options;
    }
    set options(options: string[]) {
        const oldOptions = this.options ? this.options.slice() : undefined;

        if (!options || options.length === 0) {
            this.#options = this.#serviceOptions = options;
            if (oldOptions && oldOptions.length > 0)
                this.notifyPropertyChanged("options", this.options, oldOptions);

            return;
        }

        this.#serviceOptions = <any[]>options.slice(0);
        const keyValuePairOptionType = ["FlagsEnum", "KeyValueList"].indexOf(this.type) !== -1 || (this.type === "Reference" && (<PersistentObjectAttributeWithReference><any>this).selectInPlace);

        if (!keyValuePairOptionType)
            this.#options = options;
        else {
            this.#options = options.map(o => {
                const optionSplit = o.splitWithTail("=", 2);
                return {
                    key: optionSplit[0],
                    value: optionSplit[1]
                };
            });
        }

        this.notifyPropertyChanged("options", this.options, oldOptions);
    }

    /**
     * Gets or sets the validation error.
     */
    get validationError(): string {
        return this.#validationError;
    }
    set validationError(error: string) {
        const oldValidationError = this.#validationError;
        if (oldValidationError !== error)
            this.notifyPropertyChanged("validationError", this.#validationError = error, oldValidationError);
    }

    /**
     * Gets the validation rules.
     */
    get rules(): string {
        return this.#rules;
    }
    #setRules(rules: string) {
        const oldRules = this.#rules;
        if (oldRules !== rules)
            this.notifyPropertyChanged("rules", this.#rules = rules, oldRules);
    }

    /**
     * Gets or sets if the attribute value is required.
     */
    get isRequired(): boolean {
        return this.#isRequired;
    }
    #setIsRequired(isRequired: boolean) {
        const oldIsRequired = this.#isRequired;
        if (oldIsRequired !== isRequired)
            this.notifyPropertyChanged("isRequired", this.#isRequired = isRequired, oldIsRequired);
    }

    /**
     * Gets the read-only status.
     */
    get isReadOnly(): boolean {
        return this.#isReadOnly;
    }
    #setIsReadOnly(isReadOnly: boolean) {
        const oldisReadOnly = this.#isReadOnly;
        if (oldisReadOnly !== isReadOnly)
            this.notifyPropertyChanged("isReadOnly", this.#isReadOnly = isReadOnly, oldisReadOnly);
    }

    /**
     * Gets the formatted display value.
     */
    get displayValue(): string {
        if (this.#displayValueSource === this.#serviceValue)
            return !String.isNullOrEmpty(this.#displayValue) ? this.#displayValue : "—";
        else
            this.#displayValueSource = this.#serviceValue;

        let format = this.getTypeHint("DisplayFormat", "{0}");

        let value = this.value;
        if (value != null && (this.type === "Boolean" || this.type === "NullableBoolean" || this.type === "YesNo"))
            value = this.service.getTranslatedMessage(value ? this.getTypeHint("TrueKey", "Yes") : this.getTypeHint("FalseKey", "No"));
        else if (this.type === "KeyValueList") {
            if (this.options && this.options.length > 0) {
                const isEmpty = String.isNullOrEmpty(value);
                let option = (<PersistentObjectAttributeOption[]>this.options).find(o => o.key === value || (isEmpty && String.isNullOrEmpty(o.key)));
                if (this.isRequired && option == null)
                    option = (<PersistentObjectAttributeOption[]>this.options).find(o => String.isNullOrEmpty(o.key));

                if (option != null)
                    value = option.value;
                else if (this.isRequired)
                    value = this.options.length > 0 ? (<PersistentObjectAttributeOption>this.options[0]).value : null;
            }
        }
        else if (value != null && (this.type === "Time" || this.type === "NullableTime")) {
            value = value.trimEnd("0").trimEnd(".");
            if (value.startsWith("0:"))
                value = value.substr(2);
            if (value.endsWith(":00"))
                value = value.substr(0, value.length - 3);
        } else if (value != null && (this.type === "User" || this.type === "NullableUser") && this.options.length > 0)
            value = this.options[0];
        else {
            const calculated = this.service.hooks.onGetAttributeDisplayValue(this, value);
            if (typeof calculated !== "undefined")
                return (this.#displayValue = calculated);
        }

        if (format === "{0}") {
            if (this.type === "Date" || this.type === "NullableDate")
                format = "{0:" + CultureInfo.currentCulture.dateFormat.shortDatePattern + "}";
            else if (this.type === "DateTime" || this.type === "NullableDateTime")
                format = "{0:" + CultureInfo.currentCulture.dateFormat.shortDatePattern + " " + CultureInfo.currentCulture.dateFormat.shortTimePattern + "}";
        }

        return !String.isNullOrEmpty(this.#displayValue = value != null ? String.format(format, value) : null) ? this.#displayValue : "—";
    }

    /**
     * Gets the flag indicating if a refresh is needed.
     */
    get shouldRefresh(): boolean {
        return this._shouldRefresh;
    }

    /**
     * Gets the tool tip.
     */
    get toolTip(): string {
        return this.#toolTip;
    }
    #setToolTip(toolTip: string) {
        if (this.#toolTip === toolTip)
            return;

        const oldToolTip = this.#toolTip;
        this.notifyPropertyChanged("toolTip", this.#toolTip = toolTip || "", oldToolTip);
    }

    /**
     * Gets the flag indicating if changing the attribute's value triggers a refresh.
     */
    get triggersRefresh(): boolean {
        return this.#triggersRefresh;
    }
    #setTriggersRefresh(triggersRefresh: boolean) {
        const oldTriggersRefresh = this.#triggersRefresh;
        if (oldTriggersRefresh !== triggersRefresh)
            this.notifyPropertyChanged("triggersRefresh", this.#triggersRefresh = triggersRefresh, oldTriggersRefresh);
    }

    /**
     * Gets or sets the value.
     */
    get value(): any {
        if (this.#lastParsedValue !== this.#serviceValue) {
            this.#lastParsedValue = this.#serviceValue;

            if (!this.parent.isBulkEdit || !!this.#serviceValue)
                this.#cachedValue = DataType.fromServiceString(this.#serviceValue, this.type);
            else
                this.#cachedValue = null;
        }

        return this.#cachedValue;
    }

    set value(val: any) {
        this.setValue(val).catch(() => {});
    }

    /**
     * Sets the value and handles necessary updates.
     *
     * @param val - The new value.
     * @param allowRefresh - Optional flag to allow refresh.
     * @returns A promise resolving to the updated value.
     */
    async setValue(val: any, allowRefresh: boolean = true): Promise<any> {
        if (!this.parent.isEditing || this.parent.isFrozen || this.isReadOnly)
            return this.value;

        this.validationError = null;

        if (val && typeof val === "string") {
            const charactercasing = this.getTypeHint("charactercasing", "");
            if (charactercasing) {
                if (charactercasing.toUpperCase() === "LOWER")
                    val = (<string>val).toLowerCase();
                else if (charactercasing.toUpperCase() === "UPPER")
                    val = (<string>val).toUpperCase();
            }
        }

        const newServiceValue = DataType.toServiceString(val, this.type);

        // If value is equal
        if (this.#cachedValue === val || (this.#serviceValue == null && String.isNullOrEmpty(newServiceValue)) || this.#serviceValue === newServiceValue) {
            if (allowRefresh && this._shouldRefresh)
                await this.triggerRefresh();
        }
        else {
            const oldDisplayValue = this.displayValue;
            const oldServiceValue = this.#serviceValue;
            this.notifyPropertyChanged("value", this.#serviceValue = newServiceValue, oldServiceValue);
            this.isValueChanged = true;

            if (oldDisplayValue !== this.displayValue)
                this.notifyPropertyChanged("displayValue", this.displayValue, oldDisplayValue);

            if (this.triggersRefresh) {
                if (allowRefresh)
                    await this.triggerRefresh();
                else
                    this._shouldRefresh = true;
            }

            this.parent.triggerDirty();
        }

        return this.value;
    }

    /**
     * Gets or sets the flag indicating if the value has changed.
     */
    get isValueChanged(): boolean {
        return this.#isValueChanged;
    }
    set isValueChanged(isValueChanged: boolean) {
        if (isValueChanged === this.#isValueChanged)
            return;

        const oldIsValueChanged = this.#isValueChanged;
        this.notifyPropertyChanged("isValueChanged", this.#isValueChanged = isValueChanged, oldIsValueChanged);
    }

    /**
     * Gets the sensitivity flag.
     */
    get isSensitive(): boolean {
        return this.#isSensitive;
    }

    /**
     * Gets the input element associated with the attribute.
     */
    get input(): HTMLInputElement {
        return this.#input;
    }

    /**
     * Gets the actions available for the attribute.
     */
    get actions(): Array<Action> & Record<string, Action> {
        return this.#actions;
    }
    #setActions(actions: Array<Action> & Record<string, Action>) {
        const oldActions = this.#actions;
        this.notifyPropertyChanged("actions", this.#actions = actions, oldActions);
    }

    /**
     * Gets the associated tag.
     */
    get tag(): any {
        return this.#tag;
    }

    /**
     * Gets the data type hints
     */
    get typeHints(): Record<string | symbol, any> {
        return this.#typeHints ?? (this.#typeHints = {});
    }

    /**
     * Retrieves a type hint value.
     *
     * @param name - The name of the type hint.
     * @param defaultValue - The default value if the hint is not present.
     * @param typeHints - Optional type hints to merge.
     * @param ignoreCasing - Whether to ignore casing for the name.
     * @returns The type hint.
     */
    getTypeHint(name: string, defaultValue?: string, typeHints?: any): string {
        const mergedTypeHints = typeHints ? { ...this.typeHints, ...typeHints } : this.typeHints;

        if (mergedTypeHints) {
            let typeHint = mergedTypeHints[name];
            if (typeHint != null)
            return typeHint;

            typeHint = mergedTypeHints[name.toLowerCase()];
            if (typeHint != null)
            return typeHint;
        }

        return defaultValue;
    }

    /**
     * Triggers a refresh for the attribute.
     *
     * @param immediate - Optional flag to perform immediate refresh.
     * @returns A promise that resolves when the refresh is complete.
     */
    triggerRefresh(immediate?: boolean): Promise<any> {
        this._shouldRefresh = false;
        return this.parent.triggerAttributeRefresh(this, immediate);
    }

    /**
     * Converts the attribute to a service object representation.
     *
     * @param inheritedPropertyValues - Optional inherited property values to incorporate.
     * @returns The service object representation ready for transmission.
     */
    protected _toServiceObject(inheritedPropertyValues?: Record<string, any>) {
        const initialPropertyValues = {
            id: this.id,
            name: this.name,
            label: this.label,
            type: this.type,
            isReadOnly: this.isReadOnly,
            triggersRefresh: this.triggersRefresh,
            isRequired: this.isRequired,
            differsInBulkEditMode: this.parent.isBulkEdit && this.isValueChanged,
            isValueChanged: this.isValueChanged,
            visibility: this.visibility
        };

        const result = this._copyPropertiesFromValues(!inheritedPropertyValues ? initialPropertyValues : { ...initialPropertyValues, ...inheritedPropertyValues});

        result.value = this.#serviceValue;
        result.actions = this.actions.map(a => a.name);

        if (this.options && this.options.length > 0 && this.isValueChanged)
            result.options = (<any[]>this.options).map(o => o ? (typeof (o) !== "string" ? o.key + "=" + o.value : o) : null);
        else
            result.options = this.#serviceOptions;

        return result;
    }

    /**
     * Refreshes the attribute from the service result.
     *
     * @param resultAttr - The result attribute data from the service.
     * @param resultWins - Flag indicating if the result value takes precedence.
     * @returns A flag indicating if visibility has changed.
     */
    protected _refreshFromResult(resultAttr: Dto.PersistentObjectAttributeDto, resultWins: boolean): boolean {
        let visibilityChanged = false;

        this.label = resultAttr.label;

        const newActions = <any>[];
        Action.addActions(this.service, this.parent, newActions, resultAttr.actions || []);
        this.#setActions(newActions);

        if (this.type !== "Reference")
            this.options = resultAttr.options;

        this.#setIsReadOnly(!!resultAttr.isReadOnly);
        this.#setRules(resultAttr.rules);
        this.#setIsRequired(!!resultAttr.isRequired);
        this.#setToolTip(resultAttr.toolTip);

        if (this.visibility !== resultAttr.visibility) {
            this.visibility = resultAttr.visibility;
            visibilityChanged = true;
        }

        const resultAttrValue = resultAttr.value !== undefined ? resultAttr.value : null;
        if (resultWins || (this.#serviceValue !== resultAttrValue && (this.isReadOnly || this.#refreshServiceValue !== resultAttrValue))) {
            const oldDisplayValue = this.displayValue;
            const oldValue = this.value;

            this.#serviceValue = resultAttrValue;
            this.#lastParsedValue = undefined;

            this.notifyPropertyChanged("value", this.value, oldValue);
            this.notifyPropertyChanged("displayValue", this.displayValue, oldDisplayValue);

            if (this.#input)
                this.#input.value = null;

            this.isValueChanged = !!resultAttr.isValueChanged;
        }

        this.#tag = resultAttr.tag;
        this.#refreshServiceValue = undefined;

        this.#setTriggersRefresh(resultAttr.triggersRefresh);
        this.validationError = resultAttr.validationError || null;

        if (resultAttr.typeHints && Object.keys(resultAttr.typeHints).some(k => resultAttr.typeHints[k] !== this.typeHints[k])) {
            const newTypeHints = { ...resultAttr.typeHints };
            for (const name in this.typeHints) {
                if (Object.prototype.hasOwnProperty.call(newTypeHints, name))
                    continue;

                newTypeHints[name] = this.typeHints[name];
            }

            const oldTypeHints = this.typeHints;
            this.notifyPropertyChanged("typeHints", this.#typeHints = newTypeHints, oldTypeHints);
        }

        return visibilityChanged;
    }

    /**
     * Backs up the service value.
     */
    #backupServiceValue() {
        this.#refreshServiceValue = this.#serviceValue;
    }
}