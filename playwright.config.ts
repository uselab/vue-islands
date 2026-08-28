import { defineConfig, devices } from '@playwright/test';

const PORT = 5183;

export default defineConfig({
    testDir: 'tests/specs',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                baseURL: `http://localhost:${PORT}`,
            },
        },
    ],
    webServer: {
        command: `vite --config tests/harness/vite.config.ts --port ${PORT} --strictPort`,
        port: PORT,
        reuseExistingServer: !process.env.CI,
    },
});
