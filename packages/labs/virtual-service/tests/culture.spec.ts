import { test, expect } from "@playwright/test";
import { CultureInfo } from "@vidyano/core";
import { VirtualService } from "../src/index.js";

test.describe("VirtualService culture", () => {
    // CultureInfo.currentCulture is a shared singleton; reset it so cases don't leak.
    test.beforeEach(() => {
        CultureInfo.currentCulture = CultureInfo.invariantCulture;
    });

    test.afterEach(() => {
        CultureInfo.currentCulture = CultureInfo.invariantCulture;
    });

    test("adopts an already established global culture", async () => {
        CultureInfo.currentCulture = CultureInfo.cultures["nl-BE"];

        const service = new VirtualService();
        service.registerPersistentObject({ type: "Person", attributes: [{ name: "Name", type: "String" }] });
        await service.initialize();

        expect(CultureInfo.currentCulture.name).toBe("nl-BE");
    });

    test("establishes the default culture when no global culture is set", async () => {
        expect(CultureInfo.currentCulture).toBe(CultureInfo.invariantCulture);

        const service = new VirtualService();
        service.registerPersistentObject({ type: "Person", attributes: [{ name: "Name", type: "String" }] });
        await service.initialize();

        expect(CultureInfo.currentCulture.name).toBe("en-US");
    });

    test("establishes the configured desired culture when no global culture is set", async () => {
        expect(CultureInfo.currentCulture).toBe(CultureInfo.invariantCulture);

        const service = new VirtualService({ culture: "nl-BE" });
        service.registerPersistentObject({ type: "Person", attributes: [{ name: "Name", type: "String" }] });
        await service.initialize();

        expect(CultureInfo.currentCulture.name).toBe("nl-BE");
    });

    test("configured culture is a desired default, not an override of an established global", async () => {
        CultureInfo.currentCulture = CultureInfo.cultures["nl-BE"];

        const service = new VirtualService({ culture: "fr-BE" });
        service.registerPersistentObject({ type: "Person", attributes: [{ name: "Name", type: "String" }] });
        await service.initialize();

        expect(CultureInfo.currentCulture.name).toBe("nl-BE");
    });

    test("warns when the desired culture is not a registered culture", async () => {
        expect(CultureInfo.currentCulture).toBe(CultureInfo.invariantCulture);

        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = (...args: any[]) => warnings.push(args.map(String).join(" "));

        try {
            const service = new VirtualService({ culture: "xx-YY" });
            service.registerPersistentObject({ type: "Person", attributes: [{ name: "Name", type: "String" }] });
            await service.initialize();
        } finally {
            console.warn = originalWarn;
        }

        expect(warnings.some(w => w.includes('desired culture "xx-YY" is not a registered culture'))).toBe(true);
        expect(CultureInfo.currentCulture).toBe(CultureInfo.invariantCulture);
    });

    test("does not warn when adopting an established global, even with an unregistered desired culture", async () => {
        CultureInfo.currentCulture = CultureInfo.cultures["nl-BE"];

        const warnings: string[] = [];
        const originalWarn = console.warn;
        console.warn = (...args: any[]) => warnings.push(args.map(String).join(" "));

        try {
            const service = new VirtualService({ culture: "xx-YY" });
            service.registerPersistentObject({ type: "Person", attributes: [{ name: "Name", type: "String" }] });
            await service.initialize();
        } finally {
            console.warn = originalWarn;
        }

        expect(warnings.some(w => w.includes("desired culture"))).toBe(false);
        expect(CultureInfo.currentCulture.name).toBe("nl-BE");
    });
});
