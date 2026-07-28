import tsBaseConfig from '@map-colonies/eslint-config/ts-base';
import vitestConfig from '@map-colonies/eslint-config/vitest';
import { defineConfig } from 'eslint/config';

export default defineConfig({ ignores: ['**/vitest.config.mts', '**/dist/**'] }, vitestConfig, tsBaseConfig, {
  languageOptions: {
    parserOptions: {
      projectService: {
        noWarnOnMultipleProjects: true,
      },
    },
  },
  settings: {
    'import-x/resolver': {
      typescript: {
        project: ['packages/*/tsconfig.json'],
      },
    },
  },
  rules: {
    // @db is a tsconfig path alias for the local packages/db workspace package,
    // not an npm dependency — whitelist it so the rule doesn't flag it.
    'import-x/no-extraneous-dependencies': ['error', { whitelist: ['@map-colonies/vector-standard-db'] }],
  },
});
