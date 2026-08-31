import { h, Comment, Text, type Slots, type VNode } from 'vue';
import groupBy from 'lodash/groupBy';
import { getPropsFromElement, isHtmlElement } from './dom-props';
import type { GetVNodeFunction } from './types';

export const getVNodeFromElement = (
    element: HTMLElement,
    vnodesGetter: GetVNodeFunction,
    options: { isDevMode: boolean }
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
            if (node.nodeType === Node.COMMENT_NODE && node.textContent) {
                // comment
                return [...result, h(Comment, node.textContent)];
            }
            if (isHtmlElement(node)) {
                if (
                    node.dataset.component &&
                    node.dataset.keepSemanticHtml !== undefined &&
                    options.isDevMode
                ) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `[semantic-html-to-vue] data-keep-semantic-html has no effect on nested component "${node.dataset.component}" — it only applies to root data-component elements.`
                    );
                }

                return [
                    ...result,
                    getVNodeFromElement(node, vnodesGetter, options),
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
        if (options.isDevMode) {
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
