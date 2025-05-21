import * as Polymer from "polymer"
import type * as Vidyano from "vidyano"
import { WebComponent } from "components/web-component/web-component"

@WebComponent.register({
    properties: {
        tab: Object,
        selectedTab: Object,
        isSelected: {
            type: Boolean,
            reflectToAttribute: true,
            computed: "_computeIsSelected(tab, selectedTab)"
        },
        label: {
            type: String,
            computed: "_computeLabel(tab.label, query, queryLabel)"
        },
        query: {
            type: Object,
            computed: "_computeQuery(tab)"
        },
        queryLabel: {
            type: String,
            value: null,
            computed: "_computeQueryLabel(query.label, query.filters.currentFilter)"
        },
        badge: {
            type: String,
            computed: "_computeBadge(query.totalItems, query.hasMore)"
        },
        hasBadge: {
            type: Boolean,
            computed: "_computeHasBadge(badge)"
        }
    },
    listeners: {
        "tap": "_select"
    },
    forwardObservers: [
        "query.totalItems",
        "query.label",
        "query.filters.currentFilter.name"
    ]
})
export class PersistentObjectTabBarItem extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="persistent-object-tab-bar-item.html">`; }

    tab: Vidyano.PersistentObjectTab;

    private _select() {
        this.fire("tab-selected", { tab: this.tab }, { bubbles: false });
    }

    private _computeIsSelected(tab: Vidyano.PersistentObjectTab, selectedTab: Vidyano.PersistentObjectTab): boolean {
        return tab === selectedTab;
    }

    private _computeBadge(totalItems: number, hasMore: boolean): string {
        if (totalItems != null && totalItems >= 0)
            return totalItems + (hasMore ? "+" : "");
        return "";
    }

    private _computeHasBadge(badge: string): boolean {
        return !!badge;
    }

    private _computeLabel(tabLabel: string, query: Vidyano.Query, queryLabel: string): string {
        return query && queryLabel || tabLabel;
    }

    private _computeQuery(tab: Vidyano.PersistentObjectQueryTab): Vidyano.Query {
        return tab.query || null;
    }

    private _computeQueryLabel(label: string, currentFilter: Vidyano.QueryFilter): string {
        return label + (currentFilter && currentFilter.name ? " — " + currentFilter.name : "");
    }
}