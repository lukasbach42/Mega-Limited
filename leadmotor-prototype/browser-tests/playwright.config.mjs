import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'flow.spec.mjs', workers: 1, retries: 0,
  timeout: 30000, reporter: 'list',
  use: { browserName:'chromium', viewport:{width:1100,height:900}, screenshot:'only-on-failure', trace:'off' },
});
