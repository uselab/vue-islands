import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
    plugins: [dts({ bundleTypes: true, entryRoot: 'src' })],
    build: {
        lib: {
            entry: 'src/vue-islands.ts',
            name: 'VueIslands',
            fileName: 'vue-islands',
            formats: ['es'],
        },
        rollupOptions: {
            external: ['vue', 'zod', 'lodash', /^lodash\//],
        },
    },
});
