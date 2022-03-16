import * as Polymer from "../../libs/polymer/polymer.js"
import { WebComponent } from "../web-component/web-component.js"

export interface IFileDropDetails {
    name: string;
    contents: string;
}

@WebComponent.register({
    properties: {
        "dragOver": {
            type: Boolean,
            readOnly: true,
            reflectToAttribute: true,
            value: false
        }
    },
    listeners: {
        "dragenter": "_dragEnter",
        "dragover": "_dragOver",
        "dragleave": "_dragLeave",
        "drop": "_drop"
    }
})
export class FileDrop extends WebComponent {
    static get template() { return Polymer.html`<link rel="import" href="file-drop.html">` }

    readonly dragOver: boolean; private _setDragOver: (val: boolean) => void;

    private _dragEnter(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();

        this._setDragOver(true);
    }

    private _dragOver(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        this._setDragOver(true);
    }

    private _dragLeave(e: DragEvent) {
        debugger;
        const target = <Node>this.todo_checkEventTarget(e.target);
        if (target !== this.$.overlay && !!this.findParent(node => node === this, target))
            return;

        this._setDragOver(false);
    }

    private async _drop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        this._setDragOver(false);

        if (!e.dataTransfer.files[0])
            return;

        const readers = Array.from(e.dataTransfer.files).map(file => {
            return new Promise((resolve: (details: IFileDropDetails) => void) => {
                const reader = new FileReader();
                reader.onload = loadEvent => {
                    resolve({
                        name: file.name,
                        contents: (<any>loadEvent.target).result.match(/,(.*)$/)[1]
                    });
                };

                reader.readAsDataURL(file);
            });
        });

        this.fire("file-dropped", await Promise.all(readers));
    }
}