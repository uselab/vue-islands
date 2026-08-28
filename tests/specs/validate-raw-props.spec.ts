import { test, expect } from './fixtures';

test('logs a Zod validation error including the raw props when validation fails', async ({
    page,
    mountIsland,
}) => {
    const logged: { text: string; rawProps: unknown }[] = [];
    page.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        void msg
            .args()[1]
            ?.jsonValue()
            .then((rawProps) => {
                logged.push({ text: msg.text(), rawProps });
            });
    });

    await mountIsland(
        `<section data-component="validated-probe" name="Al"></section>`,
        ['validatedProbe']
    );

    const probe = page.locator('[data-testid="validated-probe"]');
    await expect(probe).toContainText('"valid":false');

    await expect.poll(() => logged.length).toBeGreaterThan(0);
    expect(logged[0]?.text).toContain('Props validation error in component');
    expect(logged[0]?.rawProps).toMatchObject({ name: 'Al' });
});

test('does not log anything when Zod validation succeeds', async ({
    page,
    mountIsland,
}) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    await mountIsland(
        `<section data-component="validated-probe" name="Alice"></section>`,
        ['validatedProbe']
    );

    const probe = page.locator('[data-testid="validated-probe"]');
    await expect(probe).toContainText('"valid":true');
    expect(errors).toEqual([]);
});
