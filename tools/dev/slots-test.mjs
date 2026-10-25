// @playwright/test as the dev supervisor's test runs see it (see slots.cjs): the same exports, with a `test` that waits
// for a test slot. slots.cjs resolves vidyano-dev-playwright to the playwright/test of the checkout that runs, which
// @playwright/test re-exports.
import { test as playwrightTest } from 'vidyano-dev-playwright';
import slots from './slots.cjs';

export * from 'vidyano-dev-playwright';
export const test = slots.gate(playwrightTest);
// Playwright's default export is its test too
export default test;
