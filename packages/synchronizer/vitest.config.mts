import path from 'node:path';
import { defineConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';
import tsconfig from './tsconfig.json';

const pathAlias = Object.fromEntries(
  Object.entries(tsconfig.compilerOptions.paths).map(([key, [value]]) => [key.replace('/*', ''), path.resolve(__dirname, value.replace('/*', ''))])
);

const reporters: Exclude<ViteUserConfig['test'], undefined>['reporters'] = ['default', 'html'];

if (process.env.GITHUB_ACTIONS) {
  reporters.push('github-actions');
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          setupFiles: ['./tests/configurations/vite.setup.ts'],
          include: ['tests/unit/**/*.spec.ts'],
          environment: 'node',
        },
        resolve: {
          alias: pathAlias,
        },
      },
      {
        test: {
          name: 'integration',
          setupFiles: ['./tests/configurations/vite.setup.ts'],
          globalSetup: ['./tests/configurations/globalSetup.ts'],
          include: ['tests/integration/**/*.spec.ts'],
          environment: 'node',
        },
        resolve: {
          alias: pathAlias,
        },
      },
    ],
    reporters,
    coverage: {
      enabled: true,
      reporter: ['text', 'html', 'json', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: [
        '**/vendor/**',
        'node_modules/**',
        'src/common/tracing',
        'src/common/db/connection',
        'src/containerConfig',
        'src/index.ts',
        'src/app',
        'src/serverBuilder',
        'src/sync/fileReader',
        'src/sync/cron.ts',
        'src/common/s3',
      ],
      reportOnFailure: true,
      thresholds: {
        global: {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
});
