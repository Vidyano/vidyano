import * as Vidyano from "vidyano"
import * as Polymer from "polymer"
import "components/error/error"
import { AppServiceHooks } from "components/app-service-hooks/app-service-hooks"
import { WebComponent } from "components/web-component/web-component"

const ProgramUnitPresenter_Activated = Symbol("ProgramUnitPresenter_Activated");

interface IProgramUnitPresenterRouteParameters {
    programUnitName: string;
}

@WebComponent.register({
    properties: {
        programUnit: {
            type: Object,
            readOnly: true,
            observer: "_programUnitChanged"
        },
        error: {
            type: String,
            readOnly: true
        }
    },
    listeners: {
        "app-route-activate": "_activate",
        "app-route-deactivate": "_deactivate"
    }
}, "vi-program-unit-presenter")
export class ProgramUnitPresenter extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="program-unit-presenter.html">`; }

    readonly programUnit: Vidyano.ProgramUnit; private _setProgramUnit: (programUnit: Vidyano.ProgramUnit) => void;
    readonly error: string; private _setError: (error: string) => void;

    private _activate(e: CustomEvent) {
        const { parameters }: { parameters: IProgramUnitPresenterRouteParameters; } = e.detail;

        if (!this.service || !this.service.application)
            return;

        this._setProgramUnit(this.service.application.programUnits.find(pu => pu.name === parameters.programUnitName || pu.nameKebab === parameters.programUnitName));
        if (this.programUnit)
            this._activateProgramUnit(this.programUnit);
        else {
            e.preventDefault();
            this._setError(this.translateMessage("NotFound"));
        }
    }

    private _deactivate(e: CustomEvent) {
        if (this.programUnit)
            this._deactivateProgramUnit(this.programUnit);
    }

    private _programUnitChanged(programUnit: Vidyano.ProgramUnit, oldProgramUnit: Vidyano.ProgramUnit) {
        if (oldProgramUnit) {
            this._deactivateProgramUnit(oldProgramUnit);
            this.empty();
        }

        this.fire("title-changed", { title: programUnit ? programUnit.title : null }, { bubbles: true });

        if (!programUnit)
            return;

        this._activateProgramUnit(programUnit);

        const config = this.app.configuration.getProgramUnitConfig(programUnit.name);
        if (!!config && config.hasTemplate)
            this.appendChild(config.stamp(programUnit, config.as || "programUnit"));
    }

    private _activateProgramUnit(programUnit: Vidyano.ProgramUnit) {
        if (!programUnit[ProgramUnitPresenter_Activated] && this.app?.hooks instanceof AppServiceHooks) {
            programUnit[ProgramUnitPresenter_Activated] = true;
            this.app.hooks.onProgramUnitActivated(programUnit, { presenter: this });
        }
    }

    private _deactivateProgramUnit(programUnit: Vidyano.ProgramUnit) {
        if (programUnit[ProgramUnitPresenter_Activated] && this.app?.hooks instanceof AppServiceHooks) {
            programUnit[ProgramUnitPresenter_Activated] = false;
            this.app.hooks.onProgramUnitDeactivated(programUnit, { presenter: this });
        }
    }
}