import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import * as path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirrors vite.config.ts. The '@/ee/' rule must precede the general '@/'
    // one, or '@/ee/*' resolves to apps/client/src/ee and the tests exercise
    // enterprise code instead of the CE stubs that actually ship.
    alias: [
      {
        find: '@docmost/editor-ext',
        replacement: path.resolve(
          __dirname,
          '../../packages/editor-ext/src/index.ts',
        ),
      },
      {
        find: /^@\/ee\//,
        replacement: path.resolve(__dirname, './src/ce/ee-stub') + '/',
      },
      { find: /^@\//, replacement: path.resolve(__dirname, './src') + '/' },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // apps/client/src/ee is out of this fork's build (tsconfig excludes it,
    // the alias above redirects every import of it, .dockerignore keeps it out
    // of the image). Its tests must not run either — and they cannot, since
    // packages/base-formula is no longer a workspace package.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**', 'src/ee/**'],
  },
});
