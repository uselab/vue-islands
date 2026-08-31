import { test, expect } from './fixtures';

test('replaces the element, copies allow-listed attributes, mounts the component', async ({
    page,
    mountIsland,
}) => {
    await mountIsland(
        `<article
            id="widget"
            class="widget widget--large"
            style="color: red"
            role="note"
            aria-label="hello"
            data-foo="should-not-be-copied"
            data-component="probe"
        ></article>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const mounted = page.locator('article');
    await expect(mounted).toHaveCount(1);
    expect(await mounted.getAttribute('data-mount-element')).toBe('');
    expect(await mounted.getAttribute('data-component')).toBe('probe');
    expect(await mounted.getAttribute('id')).toBe('widget');
    expect(await mounted.getAttribute('class')).toBe('widget widget--large');
    expect(await mounted.getAttribute('style')).toContain('color: red');
    expect(await mounted.getAttribute('role')).toBe('note');
    expect(await mounted.getAttribute('aria-label')).toBe('hello');
    expect(await mounted.getAttribute('data-foo')).toBeNull();
});

test('overrides the mounted element tag name via data-component-tag-name', async ({
    page,
    mountIsland,
}) => {
    await mountIsland(
        `<ol data-component="probe" data-component-tag-name="div"></ol>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    await expect(page.locator('ol')).toHaveCount(0);
    const mounted = page.locator('div[data-mount-element]');
    await expect(mounted).toHaveCount(1);
});
