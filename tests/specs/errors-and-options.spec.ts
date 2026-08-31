import { test, expect, type ProbeDump } from './fixtures';

test('logs an error and leaves the element unmounted when the component is not registered', async ({
    page,
    mountIsland,
}) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    await mountIsland(`<div data-component="does-not-exist"></div>`, ['probe']);

    await expect(page.locator('[data-testid="probe"]')).toHaveCount(0);
    await expect
        .poll(() => errors.some((text) => text.includes('does-not-exist')))
        .toBe(true);

    const el = page.locator('[data-component="does-not-exist"]');
    await expect(el).toHaveCount(1);
    await expect(el.locator('[data-mount-element]')).toHaveCount(0);
});

test('logs a info message before mounting in dev mode', async ({
    page,
    mountIsland,
}) => {
    const infos: string[] = [];
    page.on('console', (msg) => {
        if (msg.type() === 'info') infos.push(msg.text());
    });

    await mountIsland(`<div data-component="probe"></div>`, ['probe'], {
        isDevMode: true,
    });

    await expect(page.locator('[data-testid="probe"]')).toBeVisible();
    await expect
        .poll(() =>
            infos.some((text) => text.includes('Rendering component: probe'))
        )
        .toBe(true);
});

test('applies configureApp before mounting the component', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(`<div data-component="probe"></div>`, ['probe'], {
        withTheme: 'dark',
    });

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();
    const dump = await readProbeDump(probe);
    expect(dump.theme).toBe('dark');
});

test('scans an alternate document via options.doc instead of the global document', async ({
    page,
}) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
        const altDoc = document.implementation.createHTMLDocument('alt');
        altDoc.body.innerHTML =
            '<div data-component="probe" some-title="Alt"></div>';
        window.__vueIslands.mount(['probe'], { doc: altDoc });

        return {
            mainHasProbe: !!document.body.querySelector(
                '[data-testid="probe"]'
            ),
            altProbeText:
                altDoc.body.querySelector('[data-testid="probe"]')
                    ?.textContent ?? null,
        };
    });

    expect(result.mainHasProbe).toBe(false);
    expect(result.altProbeText).not.toBeNull();
    const dump = JSON.parse(result.altProbeText ?? '{}') as ProbeDump;
    expect(dump.rawProps.someTitle).toBe('Alt');
});
