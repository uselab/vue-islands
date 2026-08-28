import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';

export default tseslint.config(
    {
        ignores: ['node_modules/**', 'build/**', 'dist/**', 'coverage/**'],
    },
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
        languageOptions: {
            globals: globals.browser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        linterOptions: {
            reportUnusedDisableDirectives: 'error',
        },
        rules: {
            'no-console': 'error',
        },
    },
    {
        files: ['**/*.js'],
        extends: [tseslint.configs.disableTypeChecked],
    },
    {
        files: [
            'playwright.config.ts',
            'tests/specs/**/*.ts',
            'tests/harness/vite.config.ts',
        ],
        languageOptions: {
            globals: globals.node,
        },
        rules: {
            'no-console': 'off',
        },
    },
    prettierRecommended
);
