import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const src = (p: string): string => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SteadyHum',
        short_name: 'SteadyHum',
        description:
          'Your appliances have a normal. SteadyHum learns it and tells you when it changes.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f7f4ef',
        theme_color: '#f7f4ef',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The YAMNet task files and the MediaPipe WASM runtime must survive offline.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,wasm,task,tflite}'],
        // A single YAMNet .task file is a few MB; the default 2 MB cap would skip it.
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': src(''),
      /* earshot seam: delete this alias when the real package is installed.
         See docs/earshot-integration.md and docs/decisions/0001-earshot-seam.md. */
      earshot: src('audio/earshot-stub/index.ts'),
    },
  },
  optimizeDeps: {
    // earshot ships TypeScript source; pre-bundling it would break its worker
    // and worklet entry points, which are resolved with `?worker&url` imports.
    exclude: ['earshot'],
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
})
