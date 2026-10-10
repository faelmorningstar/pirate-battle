import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // Limitamos navegadores simultâneos para não saturar a renderização WebGL local.
  workers: 2,
  retries: 0,
  snapshotPathTemplate: '{testDir}/visual-baselines/{projectName}/{arg}{ext}',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', testIgnore: '**/visual/mobile.spec.ts', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', testIgnore: '**/visual/desktop.spec.ts', use: { ...devices['Pixel 5'] } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
})
