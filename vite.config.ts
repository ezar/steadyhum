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
 * Makes earshot's MediaPipe import statically analysable.
 *
 * earshot's default loader holds the specifier in a variable behind a
 * `@vite-ignore` comment, so the bundler leaves `import('@mediapipe/tasks-audio')`
 * in the output. A browser cannot resolve a bare specifier at runtime, and the
 * engine Worker fails to start with "Failed to resolve module specifier". Its
 * own docs say a Vite app should pass `loadTasksAudio` instead — but the loader
 * is a function, `EngineOptions.models` is `Omit<ModelUrls, 'loadTasksAudio'>`,
 * and the models are built inside the Worker, so there is no way to hand one in.
 *
 * Rewriting that one line to a static import lets Vite bundle MediaPipe into the
 * worker chunk. Delete this plugin once earshot can be given a loader (or
 * imports MediaPipe itself). See docs/decisions/0003-earshot-mediapipe-loader.md.
 */
function earshotStaticMediapipe(): Plugin {
  const from = [
    "  const specifier = '@mediapipe/tasks-audio';",
    '  const module: unknown = await import(/* @vite-ignore */ specifier);',
  ].join('\n')
  const to = [
    "  const imported = await import('@mediapipe/tasks-audio');",
    // Rollup may resolve MediaPipe's CommonJS build, which lands the namespace
    // under `default`; the ESM build exposes it directly.
    '  const module: unknown = (imported as { default?: unknown }).default ?? imported;',
  ].join('\n')

  return {
    name: 'steadyhum:earshot-static-mediapipe',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('earshot') || !id.endsWith('tasks-audio.ts')) return null
      if (!code.includes(from)) {
        // earshot changed the loader: stop silently patching something else.
        throw new Error('earshot tasks-audio loader no longer matches the expected shape')
      }
      // Two lines in, two lines out, so every mapping still lines up. Saying so
      // explicitly keeps the bundler from warning that the sourcemap is stale.
      return { code: code.replace(from, to), map: null }
    },
  }
}

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
    earshotStaticMediapipe(),
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
     * Classic, not ES. MediaPipe's WASM loader brings itself in with
     * `importScripts`, which does not exist in a module worker — it fails with
     * "ModuleFactory not set" after fetching the loader. earshot's README
     * suggests `format: 'es'`, but its `createWorker` hook exists precisely so
     * the host can decide, and `src/audio/engine.ts` constructs a classic
     * Worker to match.
     */
    format: 'iife',
    // Worker bundles get their own plugin list; the top-level `plugins` are not
    // applied to them, and the MediaPipe import that needs rewriting is only
    // reachable from the worker.
    plugins: () => [earshotStaticMediapipe()],
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
