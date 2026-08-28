import { test, expect } from './fixtures';

test('parses props from attributes, *-json attributes, and data-props query strings', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section
            data-component="probe"
            some-title="Hello"
            data-count-json="42"
            data-flag-json="True"
            data-my-label="Widget"
            data-props="label=data-my-label&bio=text-content"
        >  Hi there  </section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.someTitle).toBe('Hello');
    expect(dump.rawProps.count).toBe(42);
    expect(dump.rawProps.flag).toBe(true);
    expect(dump.rawProps.label).toBe('Widget');
    expect(dump.rawProps.bio).toBe('Hi there');
});

test('collects props from data-props attributes on descendant elements at any depth', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section data-component="probe" some-title="Hello">
            <div>
                <span data-props="bio=text-content">  Nested bio  </span>
            </div>
            <p data-props="label=data-color" data-color="teal"></p>
        </section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.someTitle).toBe('Hello');
    expect(dump.rawProps.bio).toBe('Nested bio');
    expect(dump.rawProps.label).toBe('teal');
});

test("ignores a nested child component's sub-element props when resolving the parent's own props", async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section data-component="probe" some-title="Parent">
            <span data-props="bio=text-content">Parent bio</span>
            <em data-component="probe" title="Child">
                <span data-props="bio=text-content">Child bio should be ignored</span>
            </em>
        </section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();
    await expect(page.locator('[data-testid="probe"]')).toHaveCount(1);

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.someTitle).toBe('Parent');
    expect(dump.rawProps.bio).toBe('Parent bio');
});

test('resolves dot and bracket notation in prop names into nested objects and arrays, including from sub elements', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section
            data-component="probe"
            user.name="John"
            tags[0]="urgent"
            data-role="admin"
            data-props="user.role=data-role"
        >
            <span data-props="user.email=text-content">john@example.com</span>
            <span data-props="colors[0]=text-content">red</span>
            <em data-props="tags[1]=data-tag" data-tag="high-priority"></em>
        </section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.user).toEqual({
        name: 'John',
        role: 'admin',
        email: 'john@example.com',
    });
    expect(dump.rawProps.tags).toEqual(['urgent', 'high-priority']);
    expect(dump.rawProps.colors).toEqual(['red']);
});

test('normalizes a data-prefixed, non-JSON attribute name by stripping the prefix and camelCasing it, without keeping the raw key', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section
            data-component="probe"
            data-user-role="admin"
        ></section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.userRole).toBe('admin');
    expect(dump.rawProps).not.toHaveProperty('data-user-role');
});

test('parses JSON when a plain attribute name ends in -json', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section
            data-component="probe"
            data-count-json="42"
            data-items-json="[1,2,3]"
            data-meta-json='{"active":true}'
            data-flag-json="True"
            data-empty-json="null"
        ></section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.count).toBe(42);
    expect(dump.rawProps.items).toEqual([1, 2, 3]);
    expect(dump.rawProps.meta).toEqual({ active: true });
    expect(dump.rawProps.flag).toBe(true);
    expect(dump.rawProps.empty).toBeNull();
});

test('parses JSON via a data-props reference when the referenced attribute name ends in -json', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section
            data-component="probe"
            data-items-json="[1,2,3]"
            data-props="parsedItems=data-items-json"
        ></section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.parsedItems).toEqual([1, 2, 3]);
});

test('parses JSON via a data-props text-content mapping when the target prop key ends in -json', async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section data-component="probe" data-props="items-json=text-content">[1,2,3]</section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.items).toEqual([1, 2, 3]);
});

test("parses JSON sourced from a sub element's data-props, via both text-content and an attribute reference", async ({
    page,
    mountIsland,
    readProbeDump,
}) => {
    await mountIsland(
        `<section data-component="probe" some-title="Root">
            <span data-props="items-json=text-content">[1,2,3]</span>
            <em
                data-props="meta=data-payload-json"
                data-payload-json='{"active":true}'
            ></em>
        </section>`,
        ['probe']
    );

    const probe = page.locator('[data-testid="probe"]');
    await expect(probe).toBeVisible();

    const dump = await readProbeDump(probe);
    expect(dump.rawProps.someTitle).toBe('Root');
    expect(dump.rawProps.items).toEqual([1, 2, 3]);
    expect(dump.rawProps.meta).toEqual({ active: true });
});
