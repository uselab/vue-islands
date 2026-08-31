import { test, expect } from './fixtures';

test('groups slot content by slot/data-slot attribute, matches a camelCase component key against its kebab-case data-component value, and renders nested islands as components', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<div data-component="slots-probe">
            <p>Default text</p>
            <span slot="named">Named content</span>
            <span data-slot="named">More named content</span>
            <em data-component="probe" title="inner"></em>
        </div>`,
        ['slotsProbe', 'probe']
    );

    const defaultSlot = page.locator('[data-testid="default-slot"]');
    const namedSlot = page.locator('[data-testid="named-slot"]');

    await expect(defaultSlot).toContainText('Default text');
    await expect(namedSlot).toContainText('Named content');
    await expect(namedSlot).toContainText('More named content');

    const nestedProbe = defaultSlot.locator('[data-testid="probe"]');
    await expect(nestedProbe).toBeVisible();
    const dump = await readProbeDump(nestedProbe);
    expect(dump.rawProps.title).toBe('inner');

    await expect(namedSlot.locator('[data-testid="probe"]')).toHaveCount(0);
});

test('adds bare text nodes and comment nodes to the default slot', async ({
    page,
    mountIsland,
}) => {
    await mountIsland(
        `<div data-component="slots-probe">
            Bare text
            <!-- a comment -->
        </div>`,
        ['slotsProbe']
    );

    const defaultSlot = page.locator('[data-testid="default-slot"]');

    await expect(defaultSlot).toContainText('Bare text');

    const hasComment = await defaultSlot.evaluate((el) =>
        Array.from(el.childNodes).some(
            (node) =>
                node.nodeType === Node.COMMENT_NODE &&
                node.textContent?.includes('a comment')
        )
    );
    expect(hasComment).toBe(true);
});
