import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vitest/config'

const src = (p: string): string => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': src(''),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
