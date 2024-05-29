import globals from 'globals';
import js from '@eslint/js';

export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            "globals": {
                ...globals.es2021,
                ...globals.browser,
                "iro": "readonly"
            }
        },
        rules: {
            ...js.configs.recommended.rules,
            "no-invalid-this": "error",
            "eqeqeq": "error",
            "prefer-arrow-callback": "error"
        }
    }
];
