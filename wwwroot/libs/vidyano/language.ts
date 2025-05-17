import type * as Dto from "./typings/service.js";
import { Observable } from "./common/observable.js";
import type { ServiceObject } from "./service-object.js";

/**
 * Represents a language with culture, name, default status, and messages.
 */
export class Language extends Observable<ServiceObject> implements Dto.Language {
    #language: Dto.Language;
    #culture: string;

    /**
     * Initializes a new instance of the Language class.
     * @param language The language DTO.
     * @param culture The culture string.
     */
    constructor(language: Dto.Language, culture: string) {
        super();

        this.#language = language;
        this.#culture = culture;
    }

    /**
     * Gets the culture of the language.
     */
    get culture(): string {
        return this.#culture;
    }

    /**
     * Gets the name of the language.
     */
    get name(): string {
        return this.#language.name;
    }

    /**
     * Gets whether this language is the default.
     */
    get isDefault(): boolean {
        return this.#language.isDefault;
    }

    /**
     * Gets or sets the messages for this language.
     */
    get messages(): { [key: string]: string; } {
        return this.#language.messages;
    }

    set messages(value: { [key: string]: string; }) {
        const oldMessages = this.#language.messages;
        this.notifyPropertyChanged("messages", (this.#language.messages = value), oldMessages);
    }
}