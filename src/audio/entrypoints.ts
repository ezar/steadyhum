/**
 * The two earshot entry points that must be loaded as separate bundles.
 *
 * Vite rewrites `?worker&url` imports into URLs of standalone chunks, which is
 * what earshot's factories expect. This file is the only place that names them,
 * so pointing the app at the real package is a two-line edit here.
 *
 * With the real dependency installed these become:
 *   import workerUrl from 'earshot/worker?worker&url'
 *   import workletUrl from 'earshot/worklet?worker&url'
 */
import workerUrl from './earshot-stub/worker.ts?worker&url'
import workletUrl from './earshot-stub/worklet.ts?worker&url'

export { workerUrl, workletUrl }
