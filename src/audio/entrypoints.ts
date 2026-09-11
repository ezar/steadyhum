/**
 * earshot's two out-of-band entry points.
 *
 * The worker is TypeScript and Vite bundles it as a worker chunk. The capture
 * worklet is deliberately plain JavaScript: `audioWorklet.addModule` hands the
 * URL straight to the browser, so a `?worker&url` import of a `.ts` file would
 * deliver TypeScript to the audio thread. It takes a plain `?url`.
 */
import workletUrl from 'earshot/capture-worklet?url'
import workerUrl from 'earshot/worker?worker&url'

export { workerUrl, workletUrl }
