import { html } from "lit";
import { WebComponent } from "../../../src/vidyano/web-components/web-component/web-component.js";
import { Observable } from "../../../src/core/observable/index.js";

interface TestTranslationsType {
    Title: Record<string, string>;
    SubmitButton: Record<string, string>;
    CancelButton: Record<string, string>;
}

class MockLanguage extends Observable<any> {
    private _culture: string;
    private _messages: Record<string, string>;

    constructor(culture: string, messages: Record<string, string>) {
        super();
        this._culture = culture;
        this._messages = messages;
    }

    get culture() { return this._culture; }
    set culture(value: string) {
        const old = this._culture;
        this._culture = value;
        this.notifyPropertyChanged('culture', value, old);
    }

    get messages() { return this._messages; }
    set messages(value: Record<string, string>) {
        const old = this._messages;
        this._messages = value;
        this.notifyPropertyChanged('messages', value, old);
    }
}

class MockService extends Observable<any> {
    private _language: MockLanguage;

    constructor(culture: string, messages: Record<string, string>) {
        super();
        this._language = new MockLanguage(culture, messages);
    }

    get language() { return this._language; }
}

class TestTranslations extends WebComponent<TestTranslationsType> {
    constructor() {
        super({
            translations: {
                Title: {
                    "en": "Custom Title in English",
                    "nl": "Aangepaste Titel in het Nederlands",
                    "fr": "Titre personnalisé en français"
                },
                SubmitButton: {
                    "en": "Submit",
                    "nl": "Verzenden",
                    "fr": "Soumettre"
                },
                CancelButton: {
                    "en": "Cancel",
                    "nl": "Annuleren",
                    "fr": "Annuler"
                }
            }
        });
    }

    setMockService(culture: string, messages: Record<string, string>) {
        this.service = new MockService(culture, messages) as any;
    }

    render() {
        return html`
            <p>Tests component-specific translations passed to WebComponent constructor</p>
            <div id="title">${this.translations.Title}</div>
            <div id="submit">${this.translations.SubmitButton}</div>
            <div id="cancel">${this.translations.CancelButton}</div>
            <div id="ok-button">${this.translations.OK}</div>
            <div id="missing">${this.translations.NonExistentKey}</div>
        `;
    }
}

export { TestTranslations };

customElements.define("test-translations", TestTranslations);
