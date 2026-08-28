import type { Slots, VNode } from 'vue';

export type GetVNodeProps = Record<string, unknown>;

export type GetVNode = (props: GetVNodeProps, slots?: Slots) => VNode;

export type GetVNodeFunction = (name?: string) => GetVNode | undefined;

export type WithRawProps<
    Props extends Record<string, unknown> = Record<string, unknown>,
> = {
    rawProps?: Partial<Props>;
};
