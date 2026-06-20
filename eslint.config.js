import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    'dist/**',
    'test-results/**',
    'coverage/**',
    '.trash/**',
    'media/**',
    'public/media/**',
    'basis_transcoder.js',
    'ammo.wasm.js',
    'visual_logic.js',
    'opentype.js',
    '**/*.bak',
    '**/*.bak2',
    '**/*.log',
    '**/*副本*',
    '**/*.colorfix',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      'react-hooks/immutability': 'off',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
