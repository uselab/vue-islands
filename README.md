# vue-islands

Progressively mount Vue components ("islands") into server-rendered semantic HTML, using
`data-component` attributes to declare which elements should become Vue components.

Components can be used as Vue islands as well as in the normal Vue way, so you can mix and match server-rendered HTML with client-side.

## Install

```bash
npm install @uselab/vue-islands vue
```

`vue` (`^3.0.0`) is a peer dependency, so use whichever Vue 3 version your project already depends
on. `zod` (`^4.0.0`) is also an optional peer dependency, only required if you use
`validateRawProps`:

```bash
npm install zod
```

## Usage

Mark up your server-rendered HTML with `data-component` (and optionally `data-props`)
attributes:

```html
<div data-component="my-widget" data-title="Hello" data-count-json="3"></div>
```

Then, in your TypeScript entry point, register the matching Vue components and call
`initiateVueIslands` once the DOM is ready:

```ts
import {
    initiateVueIslands,
    createVNodeFunction,
    type GetVNode,
} from '@uselab/vue-islands';
import MyWidget from './MyWidget.vue';

const components: Record<string, GetVNode> = {
    'my-widget': createVNodeFunction(MyWidget),
};

initiateVueIslands(components, {
    // Optional: enable dev-only console logging of which islands get mounted.
    devMode: import.meta.env.DEV,
});
```

Component names can be written in `camelCase` in the `components` map (as above); `data-component`
attributes in the HTML are matched case-insensitively against the `kebab-case` form of these keys,
so `menu`, `heavyChart`, and `imageCarousel` above match `data-component="menu"`,
`data-component="heavy-chart"`, and `data-component="image-carousel"` respectively.

Each matching element is replaced (or, with `data-keep-semantic-html`, appended into) with a
mounted Vue app rendering the corresponding component, using attributes/`data-props` as props and
child elements as slots.

## Declaring components and props in HTML

- `data-component="my-widget"` — marks an element for mounting; the value is matched
  case-insensitively against the `kebab-case` form of the key in your `components` map.
- `data-component-tag-name="div"` — overrides the tag name of the mounted root element (e.g.
  `<ol data-component="my-widget" data-component-tag-name="div">` mounts into a `<div>` instead of
  an `<ol>`). When omitted, the tag name of the original element is used.
- `data-keep-semantic-html` — when truthy (`""`, `"true"`, or `"1"`), the original server-rendered
  element is kept in the DOM and the mounted component is appended into it, instead of replacing
  it. Useful when the original element must stay in place for SEO, accessibility, or CSS reasons
  (e.g. an `<a>` that should keep behaving like a link until the island takes over).

Props can be defined in several ways:

- As plain attributes: `<div data-component="my-widget" title="Boo">`
- As `data-{name}` attributes: `<div data-component="my-widget" data-title="Boo">`
- As attributes ending in `-json` to pass parsed JSON data: `<div data-component="my-widget"
  data-options-json='{"key":"value"}' data-show-json="true" data-counter-json="12">`
- In `data-props`, as a query string mapping `propName=attributeName`: `<a
  data-component="my-widget" href="/boo" data-props="link-url=href">` sets the `link-url` prop to
  the element's `href` value.
- In `data-props`, using `text-content` to read the element's text: `<div
  data-component="my-widget" data-props="title=text-content">Boo</div>`
- On any descendant element that has `data-props` but **not** `data-component` — useful for
  composing a prop object from several child elements without introducing extra slot markup.

Prop names in `data-props` support dot and bracket notation to build nested objects and arrays:

```html
<div data-component="my-widget">
    <h2 data-props="title=text-content">Boo</h2>
    <img data-props="image.src=src&amp;image.alt=alt" src="/image.jpg" alt="An image" />
    <div data-props="cities[0]=text-content">Amsterdam</div>
    <div data-props="cities[1]=text-content">Rotterdam</div>
</div>
```

Descendant elements that **don't** have `data-props` (and aren't themselves `data-component`
islands) are passed through as slots instead, grouped by their `slot` or `data-slot` attribute:

```html
<div data-component="my-widget">
    <div slot="header">Boo</div>
    <div slot="footer">Baa</div>
</div>
```

## Configuring each mounted app

Every island is its own, independent Vue `App` instance — each `data-component` element gets its
own `createApp(...)`/`mount(...)` call under the hood. Use the `configureApp` option to run setup
logic against every one of these instances before it's mounted, e.g. to register an i18n plugin so
translations are available inside every island, or a shared Pinia instance so islands can read from
and write to the same store:

```ts
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { initiateVueIslands } from '@uselab/vue-islands';

const pinia = createPinia();
const i18n = createI18n({ locale: 'en', messages });

initiateVueIslands(components, {
    configureApp: async (app) => {
        app.use(pinia);
        app.use(i18n);
    },
});
```

Because `configureApp` runs for every island, a shared Pinia instance or just a simple vue ref object lets independently mounted
islands stay in sync with each other (and with the rest of the page), and a shared i18n instance
means every island can use the same translations and locale without reconfiguring it per component.

## Lazy loading components

Because a `GetVNode` function is only invoked for elements that actually have a matching
`data-component` attribute on the page, you can wrap the component import in Vue's
`defineAsyncComponent`. This splits your code to code-split it into its own chunk that's only fetched when the island is
actually mounted:

```ts
import {
    initiateVueIslands,
    createVNodeFunction,
    type GetVNode,
} from '@uselab/vue-islands';
import { defineAsyncComponent } from 'vue';
import MyWidget from './MyWidget.vue';

const components: Record<string, GetVNode> = {
    // Loaded eagerly, e.g. because it's needed on (almost) every page.
    'my-widget': createVNodeFunction(MyWidget),

    // Loaded lazily: the chunk for `HeavyChart.vue` is only downloaded when a
    // `data-component="heavy-chart"` element is found and mounted.
    'heavy-chart': createVNodeFunction(
        defineAsyncComponent(() => import('./HeavyChart.vue'))
    ),
};

initiateVueIslands(components);
```

This keeps the initial bundle small: pages without a `heavy-chart` island never download its code,
while `defineAsyncComponent` still shows Vue's built-in loading/error states (via its
`loadingComponent`/`errorComponent` options) while the chunk loads.

## Organizing many components

Projects with dozens of islands tend to converge on a small helper that wraps each component in a
`GetVNode` function, so the `components` map stays a flat, readable list of imports.
`createVNodeFunction` is exported for this purpose: it passes both the raw and the spread props to
the component, so components can use `validateRawProps` to log helpful errors (including the
original, unparsed props) when Zod validation fails:

```ts
import { defineAsyncComponent } from 'vue';
import {
    initiateVueIslands,
    createVNodeFunction,
    type GetVNode,
} from '@uselab/vue-islands';
import Menu from './features/menu.vue';
import Header from './features/header.vue';
import Footer from './features/footer.vue';

const components: Record<string, GetVNode> = {
    // Eagerly loaded components, e.g. because they're needed on (almost) every page.
    menu: createVNodeFunction(Menu),
    header: createVNodeFunction(Header),
    footer: createVNodeFunction(Footer),

    // Lazily loaded components: only fetched when a matching `data-component` element is found.
    heavyChart: createVNodeFunction(
        defineAsyncComponent(() => import('./features/heavy-chart.vue'))
    ),
    imageCarousel: createVNodeFunction(
        defineAsyncComponent(() => import('./features/image-carousel.vue'))
    ),

    // ...more components
};

initiateVueIslands(components);
```

## API

- `initiateVueIslands(components, options?)` — scans the document (or `options.doc`) for
  `[data-component]` elements and mounts the matching Vue components (see "Declaring components
  and props in HTML" above for the supported `data-*` attributes).
  - `options.devMode?: boolean` — enables verbose console logging for debugging (default
    `false`).
  - `options.configureApp?: (app: App) => Promise<void>` — called for each created Vue `App`
    instance before mounting, useful for registering plugins/directives (see "Configuring each
    mounted app" above).
  - `options.doc?: Document` — alternate document to scan (default: global `document`).
- `createVNodeFunction(component)` — helper that turns a Vue `Component` into a `GetVNode`
  function, passing it both the raw and the spread props (as `WithRawProps`) plus slots. Useful
  when registering many components (see "Organizing many components" above).
- `validateRawProps(result, props)` — helper for logging Zod prop-validation errors together with
  the raw (unparsed) props that were passed in. Requires `zod` (^4.0.0) to be installed.

## Development

```bash
npm install
npm run build
npm run quality # runs typecheck, lint, and tests
```

`npm install` also sets up a `pre-push` git hook (via `simple-git-hooks`) that runs
`npm run quality` (lint, typecheck, and tests) before every `git push`, aborting the push if any of
them fail.

## Publishing a new version

1. `npm version patch` (or `minor` / `major`) — runs `npm run quality` first (aborting on failure),
   then bumps `package.json`, commits, tags the commit `vX.Y.Z`, and pushes the commit and tag to
   GitHub.
2. Pushing the `vX.Y.Z` tag triggers the [CI workflow](.github/workflows/ci.yml), which re-runs
   lint, typecheck, and the test suite on GitHub. Wait for it to pass.
3. `npm publish` — builds `dist/` (via the `prepublishOnly` script) and publishes the package to
   npm.
