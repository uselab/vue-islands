// comes from Inholland
import {
    createApp,
    defineComponent,
    h,
    Comment,
    Text,
    type Slots,
    type VNode,
    type App,
    getCurrentInstance,
    type Component,
} from 'vue';
import type { ZodSafeParseResult } from 'zod';
import camelCase from 'lodash/camelCase';
import kebabCase from 'lodash/kebabCase';
import groupBy from 'lodash/groupBy';
import merge from 'lodash/merge';
import set from 'lodash/set';
import { memoize } from 'lodash';

type GetVNodeProps = Record<string, unknown>;
export type GetVNode = (props: GetVNodeProps, slots?: Slots) => VNode;
export type GetVNodeFunction = (name?: string) => GetVNode | undefined;

// Merge props and make arrays from props that are repeated
const mergeProps = (
    base: GetVNodeProps,
    ...otherProps: GetVNodeProps[]
): GetVNodeProps =>
    otherProps.reduce<GetVNodeProps>(
        (result, props) => merge(result, props),
        base
    );

const isHtmlElement = (node: Node): node is HTMLElement =>
    node.nodeType === Node.ELEMENT_NODE;

const isJsonKey = (key: string) => kebabCase(key).endsWith('-json');
const parseJson = (value: string): unknown =>
    JSON.parse(value.replace(/^True$/, 'true').replace(/^False$/, 'false'));
const parseValue = (key: string, value?: string): unknown => {
    if (value === undefined) {
        return undefined;
    }
    if (isJsonKey(key)) {
        return parseJson(value);
    }
    return value;
};
const getAttributeValue = (element: HTMLElement, key: string): unknown => {
    const value = element.getAttribute(key);
    return parseValue(key, value ?? undefined);
};

const isTrueishBooleanDataAttribute = (value?: string) =>
    value === '' || value?.toLowerCase() === 'true' || value === '1';

const getPropsFromElement = (el: HTMLElement) => {
    const getPropsFromQueryString = (
        queryString: string | undefined,
        element: HTMLElement
    ): GetVNodeProps => {
        const queryItems = Array.from(
            new URLSearchParams(queryString || '').entries()
        );
        return queryItems.reduce<GetVNodeProps>((result, [key, value]) => {
            const kebabValue = kebabCase(value);
            if (kebabValue === 'text-content') {
                return mergeProps(
                    result,
                    set(
                        {},
                        key,
                        parseValue(key, (element.textContent || '').trim())
                    )
                );
            }
            return mergeProps(
                result,
                set({}, key, getAttributeValue(element, value))
            );
        }, {});
    };

    const getPropsFromAttributeList = (
        attributes: Attr[],
        element: HTMLElement
    ): GetVNodeProps =>
        attributes.reduce<GetVNodeProps>((result, attr) => {
            if (
                ['v-cloak', 'data-v-cloak', 'data-component'].includes(
                    kebabCase(attr.name)
                )
            ) {
                return result;
            }
            if (attr.name.toLowerCase() === 'data-props') {
                return mergeProps(
                    result,
                    getPropsFromQueryString(attr.value, element)
                );
            }
            return mergeProps(
                result,
                set(
                    {},
                    attr.name,
                    isJsonKey(attr.name) ? parseJson(attr.value) : attr.value
                )
            );
        }, {});

    const attrProps = getPropsFromAttributeList(Array.from(el.attributes), el);

    const collectWalkerNodes = (
        walker: TreeWalker,
        nodes: Node[] = []
    ): Node[] => {
        const node = walker.nextNode();
        if (node === null) {
            return nodes;
        }
        return collectWalkerNodes(walker, [...nodes, node]);
    };
    const treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node) =>
            !isHtmlElement(node) || node.dataset.component
                ? NodeFilter.FILTER_REJECT
                : NodeFilter.FILTER_ACCEPT,
    });

    const allDescendantsExceptComponents = collectWalkerNodes(treeWalker);
    const elementsWithDataProps = allDescendantsExceptComponents.filter(
        (element) => isHtmlElement(element) && element.dataset.props
    );

    const allProps = elementsWithDataProps.reduce<GetVNodeProps>(
        (result, child) =>
            mergeProps(
                result,
                isHtmlElement(child)
                    ? getPropsFromQueryString(child.dataset.props, child)
                    : {}
            ),
        attrProps
    );

    // normalize prop names
    const normalizeKey = (key: string) => {
        const kebabKey = kebabCase(key);
        const match = /^(data-)?(.*?)(-json)?$/i.exec(kebabKey);
        if (!match) {
            return kebabKey;
        }
        return camelCase(match[2]);
    };
    return Object.entries(allProps).reduce<GetVNodeProps>(
        (result, [key, value]) => ({
            ...result,
            [key]: value,
            [normalizeKey(key)]: value,
        }),
        {}
    );
};

const getVNodeFromElement = (
    element: HTMLElement,
    vnodesGetter: GetVNodeFunction,
    devMode: boolean
): VNode => {
    const componentName = element.dataset.component;
    const getVNodesFunction = vnodesGetter(componentName);

    if (componentName && !getVNodesFunction) {
        // eslint-disable-next-line no-console
        console.error(`Component ${componentName} not found.`);
    }

    const nodesToVNodes = (childNodes: Node[]): VNode[] =>
        childNodes.reduce<VNode[]>((result, node) => {
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                // text
                return [...result, h(Text, node.textContent)];
            }
            if (node.nodeType === Node.TEXT_NODE && node.textContent) {
                // comment
                return [...result, h(Comment, node.textContent)];
            }
            if (isHtmlElement(node)) {
                return [
                    ...result,
                    getVNodeFromElement(node, vnodesGetter, devMode),
                ];
            }
            return result;
        }, []);

    const getVNodeSlots = (nodes: Node[]): Slots => {
        const groupedNodes: [string, Node[]][] = Object.entries(
            groupBy(nodes, (node) => {
                if (isHtmlElement(node)) {
                    return (
                        node.getAttribute('slot') ||
                        node.dataset.slot ||
                        'default'
                    );
                }
                return 'default';
            })
        );
        const groupedVNodes: [string, VNode[]][] = groupedNodes.map(
            ([slotName, groupNodes]) => [slotName, nodesToVNodes(groupNodes)]
        );
        return Object.fromEntries(
            groupedVNodes.map(([slotName, vNodes]) => [slotName, () => vNodes])
        );
    };

    if (getVNodesFunction) {
        if (devMode) {
            // eslint-disable-next-line no-console
            console.info(
                `[semantic-html-to-vue] Rendering component: ${componentName}`
            );
        }
        const props = getPropsFromElement(element);
        const childElements = Array.from(element.children).filter(
            (child) =>
                isHtmlElement(child) &&
                (!child.dataset.props || child.dataset.component)
        );
        const slots = getVNodeSlots(childElements);
        return getVNodesFunction(props, slots);
    }

    const childVNodes = nodesToVNodes(Array.from(element.childNodes));
    const props = Object.fromEntries(
        Array.from(element.attributes).map(({ name, value }) => [name, value])
    );
    return h(element.tagName, props, childVNodes);
};

const replaceElementWithVueIsland = (
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

const appendVueIslandInElement = (
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

export const createVNodeFunction =
    (component: Component): GetVNode =>
    (props, slots) =>
        h(
            component,
            { rawProps: props, ...props } satisfies WithRawProps,
            slots
        );

export const initiateVueIslands = (
    components: Record<string, GetVNode>,
    options?: {
        configureApp?: (app: App) => Promise<void>;
        doc?: Document;
        devMode?: boolean;
    }
) => {
    const { configureApp, doc = document, devMode = false } = options || {};

    const componentList: [string, GetVNode][] = Object.entries(components).map(
        ([name, value]) => [kebabCase(name), value]
    );
    const vnodesGetter: GetVNodeFunction = memoize(
        (name?: string): GetVNode | undefined => {
            if (!name) {
                return undefined;
            }
            const kebabName = kebabCase(name);
            const [, component] =
                componentList.find(([n]) => n === kebabName) || [];
            return component;
        }
    );

    Array.from(doc.querySelectorAll<HTMLElement>('[data-component]'))
        .filter(
            (element) => !element.parentElement!.closest('[data-component]')
        )
        .reduce<{ vNode: VNode; element: HTMLElement }[]>((result, element) => {
            const componentName = kebabCase(element.dataset.component);
            if (!vnodesGetter(componentName)) {
                // eslint-disable-next-line no-console
                console.error(`Component ${componentName} not found.`);
                return result;
            }
            return [
                ...result,
                {
                    element,
                    vNode: getVNodeFromElement(
                        element,
                        vnodesGetter,
                        devMode
                    ),
                },
            ];
        }, [])
        .forEach(({ element, vNode }) => {
            void (async () => {
                const nodeName =
                    element.dataset.componentTagName ??
                    element.nodeName.toLowerCase() ??
                    'div';

                try {
                    const mountElement = document.createElement(nodeName);
                    mountElement.dataset.mountElement = '';

                    const app = createApp(defineComponent(() => () => vNode));
                    if (configureApp) {
                        await configureApp(app);
                    }

                    const shouldNotReplace = isTrueishBooleanDataAttribute(
                        element.dataset.keepSemanticHtml
                    );

                    if (shouldNotReplace) {
                        appendVueIslandInElement(element, mountElement, app);
                    } else {
                        replaceElementWithVueIsland(element, mountElement, app);
                    }
                } catch (error) {
                    // eslint-disable-next-line no-console
                    console.error(
                        `[semantic-html-to-vue] Failed to mount component: ${element.dataset.component}`,
                        error
                    );
                }
            })();
        });
};

export type WithRawProps<
    Props extends Record<string, unknown> = Record<string, unknown>,
> = {
    rawProps?: Partial<Props>;
};
export const validateRawProps = <Props extends object & WithRawProps>(
    result: ZodSafeParseResult<Props>,
    props: Props
) => {
    if (!result.success) {
        const instance = getCurrentInstance();
        // eslint-disable-next-line no-console
        console.error(
            `Props validation error in component "${instance?.type.__name}": ${result.error.message}\n\nRaw props:`,
            props.rawProps
        );
    }
};
