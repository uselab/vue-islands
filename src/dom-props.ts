import camelCase from 'lodash/camelCase';
import kebabCase from 'lodash/kebabCase';
import merge from 'lodash/merge';
import set from 'lodash/set';
import type { GetVNodeProps } from './types';

// Merge props and make arrays from props that are repeated
const mergeProps = (
    base: GetVNodeProps,
    ...otherProps: GetVNodeProps[]
): GetVNodeProps =>
    otherProps.reduce<GetVNodeProps>(
        (result, props) => merge(result, props),
        base
    );

export const isHtmlElement = (node: Node): node is HTMLElement =>
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

export const isTrueishBooleanDataAttribute = (value?: string) =>
    value === '' || value?.toLowerCase() === 'true' || value === '1';

export const getPropsFromElement = (el: HTMLElement) => {
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
            [normalizeKey(key)]: value,
        }),
        {}
    );
};
