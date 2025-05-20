import * as Polymer from "polymer"
import * as Vidyano from "vidyano"
import { ISize } from "components/size-tracker/size-tracker.js"
import "components/persistent-object-group/persistent-object-group.js"
import { PersistentObjectAttributePresenter } from "components/persistent-object-attribute-presenter/persistent-object-attribute-presenter.js"
import "components/size-tracker/size-tracker.js"
import { ConfigurableWebComponent } from "components/web-component/web-component-configurable.js"

@ConfigurableWebComponent.register({
    properties: {
        tab: Object,
        columns: {
            type: Number,
            computed: "_computeColumns(size, tab.columnCount)"
        },
        groups: {
            type: Array,
            readOnly: true
        },
        size: Object,
        innerSize: {
            type: Object,
            observer: "_innerSizeChanged"
        },
        noAutofocus: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        },
        noScroll: {
            type: Boolean,
            reflectToAttribute: true,
            value: false
        }
    },
    observers: [
        "_autofocus(noAutofocus, tab.parent.isEditing)"
    ],
    listeners: {
        "attribute-loaded": "_attributeLoaded",
        "vi:configure": "_configure"
    },
    forwardObservers: [
        "_updateGroups(tab.attributes.*.isVisible)",
        "tab.parent.isEditing",
        "tab.groups"
    ]
})
export class PersistentObjectTab extends ConfigurableWebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-tab.html">`; }

    private _attributePresenters: PersistentObjectAttributePresenter[];
    private _autofocusTarget: PersistentObjectAttributePresenter;
    readonly groups: Vidyano.PersistentObjectAttributeGroup[]; private _setGroups: (groups: Vidyano.PersistentObjectAttributeGroup[]) => void;
    tab: Vidyano.PersistentObjectAttributeTab;
    noAutofocus: boolean;

    disconnectedCallback() {
        super.disconnectedCallback();

        this._attributePresenters = this._autofocusTarget = null;
    }

    private _computeColumns(size: ISize, defaultColumnCount: number): number {
        if (defaultColumnCount)
            return defaultColumnCount;

        if (size.width >= 1500)
            return 4;
        else if (size.width > 1000)
            return 3;
        else if (size.width > 500)
            return 2;

        return 1;
    }

    private _updateGroups() {
        this._setGroups(this.tab?.groups.filter(g => g.attributes.some(a => a.isVisible)));
    }

    private _autofocus(noAutofocus: boolean, isEditing: boolean) {
        if (!noAutofocus && isEditing && this._autofocusTarget)
            this._focusElement(this._autofocusTarget);
    }

    private _attributeLoaded(e: CustomEvent) {
        if (this.noAutofocus)
            return;

        if (!this._attributePresenters)
            this._attributePresenters = [];

        const presenter = <PersistentObjectAttributePresenter>e.composedPath()[0];
        this._attributePresenters.push(presenter);

        if (this._attributePresenters.length < this.tab.attributes.length)
            return;

        this._attributePresenters = this._attributePresenters.sort((attr1, attr2) => attr1.attribute.offset - attr2.attribute.offset);
        for (const presenter of this._attributePresenters) {
            const focusTarget = Polymer.IronFocusablesHelper.getTabbableNodes(presenter)[0];
            if (!focusTarget)
                continue;

            this._focusElement(focusTarget);
            break;
        }
    }

    private _innerSizeChanged(size: ISize) {
        this.fire("vi-persistent-object-tab-inner-size-changed", size, { bubbles: true});
    }

    private _configure(e: CustomEvent) {
        if (this.tab.target instanceof Vidyano.PersistentObject) {
            if ((<Vidyano.PersistentObject>this.tab.target).isSystem)
                return;
        }

        const tab = <Vidyano.PersistentObjectAttributeTab>this.tab;
        e.detail.push({
            label: `Attribute tab: ${tab.label}`,
            icon: "viConfigure",
            action: () => this.app.changePath(`management/persistent-object.9b7a3b94-cf71-4284-bac3-de4d2790c868/${tab.id}`)
        });
    }
}