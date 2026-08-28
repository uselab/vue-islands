import type { App } from 'vue';

export const replaceElementWithVueIsland = (
    element: HTMLElement,
    mountElement: HTMLElement,
    app: App<Element>
) => {
    const copyAttributes = new Set(['id', 'class', 'style', 'role']);

    Array.from(element.attributes).forEach(({ name, value }) => {
        const normalisedName = name.toLowerCase();

        if (
            copyAttributes.has(normalisedName) ||
            normalisedName.startsWith('aria-')
        ) {
            mountElement.setAttribute(name, value);
        }
    });

    const parent = element.parentElement;
    parent!.insertBefore(mountElement, element.nextSibling);

    app.mount(mountElement);

    element.replaceWith(mountElement);

    delete element.dataset.vCloak;
};

export const appendVueIslandInElement = (
    element: HTMLElement,
    mountElement: HTMLElement,
    app: App<Element>
) => {
    // remove text nodes because they cannot be hidden with CSS
    Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .forEach((node) => node.remove());

    // remove the href attribute because the component should be in charge of the behavior.
    element.removeAttribute('href');

    element.appendChild(mountElement);

    app.mount(mountElement);

    delete element.dataset.vCloak;
};
