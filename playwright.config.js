// @ts-check
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: '.',
  /* Worktrees nested in .claude/ are checkouts of their own; their specs are not this checkout's */
  testIgnore: [new RegExp(`${path.resolve(__dirname, '.claude').replaceAll('\\', '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`, 'i')],
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* A hung run in the dev supervisor would hold back every queued run, so it ends after 90 minutes */
  globalTimeout: process.env.VIDYANO_DEV_EVENTS ? 90 * 60_000 : 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [['list'], ...(process.env.VIDYANO_DEV_EVENTS ? [['./tools/dev/reporter.mjs']] : [])],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects */
  projects: [
    {
      name: 'core',
      testMatch: 'packages/core/tests/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      /* Core tests share a database - run serially with 1 worker */
      fullyParallel: false,
      workers: 1,
    },
    {
      name: 'vidyano',
      testMatch: 'packages/vidyano/tests/**/*.spec.ts',
      grepInvert: /@timing/,
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      fullyParallel: true,
      workers: 4,
    },
    {
      name: 'vidyano-perf',
      testMatch: 'packages/vidyano/tests/**/*.spec.ts',
      grep: /@timing/,
      /* Timings need a quiet machine: one worker and no retries that could hide regressions */
      use: { ...devices['Desktop Chrome'], channel: 'chrome', viewport: { width: 1280, height: 720 } },
      fullyParallel: false,
      workers: 1,
      retries: 0,
    },
    {
      name: 'virtual-service',
      testMatch: 'packages/labs/virtual-service/tests/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
      fullyParallel: true,
      workers: 4,
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npx http-server . -p 8888 -c-1',
  //   url: 'http://localhost:8888',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 30 * 1000,
  // },
});

