import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'coverage/**', 'out/**']),
  {
    files: ['**/*.test.js', 'jest.setup.js'],
    languageOptions: {
      globals: {
        jest: 'readonly', describe: 'readonly', test: 'readonly', expect: 'readonly',
        beforeEach: 'readonly', afterEach: 'readonly'
      }
    }
  }
]);
