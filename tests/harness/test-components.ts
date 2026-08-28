import { defineComponent, h, inject } from 'vue';
import { z } from 'zod';
import {
    createVNodeFunction,
    validateRawProps,
    type GetVNode,
} from '../../src/vue-islands';

const Probe = defineComponent({
    name: 'Probe',
    props: {
        rawProps: { type: Object, default: () => ({}) },
    },
    setup(props, { attrs }) {
        const theme = inject<string | null>('theme', null);
        return () =>
            h(
                'div',
                { 'data-testid': 'probe' },
                JSON.stringify({ attrs, rawProps: props.rawProps, theme })
            );
    },
});

const SlotsProbe = defineComponent({
    name: 'SlotsProbe',
    setup(_props, { slots }) {
        return () =>
            h('div', { 'data-testid': 'slots-probe' }, [
                h(
                    'div',
                    { 'data-testid': 'default-slot' },
                    slots.default ? slots.default() : []
                ),
                h(
                    'div',
                    { 'data-testid': 'named-slot' },
                    slots.named ? slots.named() : []
                ),
            ]);
    },
});

const nameSchema = z.object({ name: z.string().min(3) });

const ValidatedProbe = defineComponent({
    name: 'ValidatedProbe',
    props: {
        name: { type: String, required: true },
        rawProps: { type: Object, default: () => ({}) },
    },
    setup(props) {
        const result = nameSchema.safeParse({ name: props.name });
        validateRawProps(result, props);
        return () =>
            h(
                'div',
                { 'data-testid': 'validated-probe' },
                JSON.stringify({ valid: result.success })
            );
    },
});

export const components: Record<string, GetVNode> = {
    probe: createVNodeFunction(Probe),
    slotsProbe: createVNodeFunction(SlotsProbe),
    validatedProbe: createVNodeFunction(ValidatedProbe),
};
