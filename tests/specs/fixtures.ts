import { type Locator, test as base, expect } from '@playwright/test';

type MountOptions = {
    devMode?: boolean;
    withTheme?: string;
};

export type ProbeDump = {
    attrs: Record<string, unknown>;
    rawProps: Record<string, unknown>;
    theme: string | null;
};

type Fixtures = {
    mountIsland: (
        html: string,
        names: string[],
        options?: MountOptions
    ) => Promise<void>;
    readProbeDump: (probe: Locator) => Promise<ProbeDump>;
};

export const test = base.extend<Fixtures>({
    mountIsland: async ({ page }, use) => {
        await page.goto('/');
        await use(async (html, names, options) => {
            await page.evaluate(
                ({ html, names, options }) => {
                    document.body.innerHTML = html;
                    window.__vueIslands.mount(names, options);
                },
                { html, names, options }
            );
        });
    },
    // eslint-disable-next-line no-empty-pattern -- Playwright requires the first fixture argument to be an object pattern
    readProbeDump: async ({}, use) => {
        await use(async (probe) => {
            const text = await probe.textContent();
            return JSON.parse(text ?? '{}') as ProbeDump;
        });
    },
});

export { expect };
