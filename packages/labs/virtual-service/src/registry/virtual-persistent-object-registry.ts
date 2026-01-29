import { VirtualPersistentObjectConfig } from "../types.js";

/**
 * Registry for managing PersistentObject configurations (pure config store)
 */
export class VirtualPersistentObjectRegistry {
    #configs = new Map<string, VirtualPersistentObjectConfig>();

    /**
     * Registers a PersistentObject configuration
     */
    register(config: VirtualPersistentObjectConfig): void {
        this.#configs.set(config.type, config);
    }

    /**
     * Gets a registered PersistentObject configuration
     */
    getConfig(type: string): VirtualPersistentObjectConfig | undefined {
        return this.#configs.get(type);
    }

    /**
     * Checks if a type has a registered configuration
     */
    hasConfig(type: string): boolean {
        return this.#configs.has(type);
    }
}
