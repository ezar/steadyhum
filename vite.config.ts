import { copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const src = (p: string): string => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

/**
 * Where the app is served from.
 *
 * Vercel serves it at the root; a GitHub Pages project site serves it under
 * `/<repo>/`. The deploy workflow sets BASE_PATH, and everything that builds a
 * URL — the PWA manifest, the model paths — derives it from `import.meta.env.BASE_URL`
 * rather than assuming a leading slash.
 */
const base = process.env['BASE_PATH'] ?? '/'

/**
 * GitHub Pages has no rewrite rules, so a deep link like `/appliances/<id>`
 * 404s on reload. Pages serves 404.html for any unmatched path, and a copy of
 * index.html there gives the SPA its entry point back.
 */
function spaFallback(): Plugin {
  return {
    name: 'steadyhum:spa-fallback',
    apply: 'build',
    closeBundle() {
      const dist = fileURLToPath(new URL('./dist/', import.meta.url))
      copyFileSync(join(dist, 'index.html'), join(dist, '404.html'))
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    spaFallback(),
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
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f7f4ef',
        theme_color: '#f7f4ef',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The models are ~36 MB. Precaching them would spend that on install,
        // before the user has recorded anything; instead they are cached the
        // first time the engine actually loads them, and stay cached after.
        globIgnores: ['models/**'],
        navigateFallback: `${base}index.html`,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'steadyhum-models',
              expiration: { maxEntries: 32 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': src(''),
    },
  },
  optimizeDeps: {
    // earshot ships TypeScript source; pre-bundling it would break its worker
    // and worklet entry points, which are resolved with `?worker&url` imports.
    exclude: ['earshot'],
  },
  worker: {
    /**
     * Classic, not ES — earshot requires it and its README says so: MediaPipe
     * loads its WASM glue with `importScripts`, which module workers do not
     * have. The setting is global, so this app cannot have module workers of
     * its own.
     */
    format: 'iife',
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    /**
     * earshot's capture worklet must be a real file, not a `data:` URL.
     * `audioWorklet.addModule` is handed the URL directly and support for
     * `data:` URLs there is uneven — Safari on iOS is exactly the browser this
     * app cannot afford to guess about. Everything else keeps Vite's default
     * inlining.
     */
    assetsInlineLimit: (filePath) => (filePath.includes('capture-worklet') ? false : undefined),
  },
})
