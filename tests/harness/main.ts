import { initiateVueIslands } from '../../src/vue-islands';
import { components } from './test-components';

type MountOptions = {
    isDevMode?: boolean;
    withTheme?: string;
    doc?: Document;
};

declare global {
    interface Window {
        __vueIslands: {
            mount: (names: string[], options?: MountOptions) => void;
        };
    }
}

window.__vueIslands = {
    mount: (names, options = {}) => {
        const selected = Object.fromEntries(
            Object.entries(components).filter(([name]) => names.includes(name))
        );
        initiateVueIslands(selected, {
            isDevMode: options.isDevMode,
            doc: options.doc,
            configureApp: options.withTheme
                ? (app) => {
                      app.provide('theme', options.withTheme);
                      return Promise.resolve();
                  }
                : undefined,
        });
    },
};
