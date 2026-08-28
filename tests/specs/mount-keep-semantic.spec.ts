import { test, expect } from './fixtures';

for (const truthyValue of ['true', '', '1']) {
    test(`keeps the original element and appends the mounted component as a child, for data-keep-semantic-html=${JSON.stringify(truthyValue)}`, async ({
        page,
        mountIsland,
    }) => {
        await mountIsland(
            `<a
                href="/fallback"
                data-component="probe"
                data-keep-semantic-html="${truthyValue}"
                data-v-cloak
            >Fallback text</a>`,
            ['probe']
        );

        const probe = page.locator('[data-testid="probe"]');
        await expect(probe).toBeVisible();

        const outer = page.locator('a[data-component="probe"]');
        await expect(outer).toHaveCount(1);
        expect(await outer.getAttribute('href')).toBeNull();
        expect(await outer.getAttribute('data-v-cloak')).toBeNull();
        expect((await outer.innerText()).includes('Fallback text')).toBe(false);
        await expect(outer.locator('[data-mount-element]')).toHaveCount(1);
    });
}
