import {
    createApp,
    defineComponent,
    h,
    type VNode,
    type App,
    getCurrentInstance,
    type Component,
} from 'vue';
import type { ZodSafeParseResult } from 'zod';
import kebabCase from 'lodash/kebabCase';
import { memoize } from 'lodash';

import { getVNodeFromElement } from './vnode';
import { replaceElementWithVueIsland, appendVueIslandInElement } from './mount';
import { isTrueishBooleanDataAttribute } from './dom-props';
import type { GetVNode, GetVNodeFunction, WithRawProps } from './types';

export type { GetVNode, GetVNodeFunction, WithRawProps } from './types';

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
        isDevMode?: boolean;
    }
) => {
    const { configureApp, doc = document, isDevMode = false } = options || {};

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
                    vNode: getVNodeFromElement(element, vnodesGetter, {
                        isDevMode,
                    }),
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
