#!/usr/bin/env node
/**
 * Asserts that `dist/` is actually deployable at the base path it was built for.
 *
 * A wrong base path is the failure mode this guards: every step goes green, the
 * artifact uploads, Pages publishes — and the site serves a blank page because
 * every asset 404s. Nothing upstream notices, because nothing upstream looks at
 * the HTML.
 *
 * Usage:
 *   node scripts/verify-build.mjs            expects base "/"
 *   node scripts/verify-build.mjs /steadyhum/  expects that base
 *   BASE_PATH=/steadyhum/ node scripts/verify-build.mjs
 */
import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(rootDir, 'dist')

const base = process.argv[2] ?? process.env['BASE_PATH'] ?? '/'
if (!base.startsWith('/') || !base.endsWith('/')) {
  console.error(`base must start and end with "/", got ${JSON.stringify(base)}`)
  process.exit(1)
}

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const html = await readFile(join(dist, 'index.html'), 'utf8')

/*
 * Every absolute reference must resolve to a file that is actually in dist.
 *
 * Checking the prefix is not enough, and the check has to be this literal to be
 * worth having: with base "/", the string test passes for any absolute path at
 * all, including one carrying somebody else's base. Resolving the reference the
 * way a browser would and looking for the file catches a base that is too long,
 * too short or simply wrong, which is the whole point.
 */
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1])
check(references.length > 0, 'index.html references no assets at all')

for (const reference of references) {
  if (!reference.startsWith('/')) continue
  if (!reference.startsWith(base)) {
    failures.push(`index.html points at ${reference}, which is outside the base ${base}`)
    continue
  }
  const onDisk = join(dist, reference.slice(base.length))
  check(
    await exists(onDisk),
    `index.html points at ${reference}, which is not in dist (it would 404 at ${base})`,
  )
}

// At least one hashed asset, or the page has no app in it.
check(
  references.some((reference) => /assets\/index-[\w-]+\.js$/.test(reference)),
  'index.html does not reference a built app bundle',
)

// GitHub Pages serves 404.html for unmatched paths; without it, reloading a
// deep link like /appliances/<id> loses the app.
check(await exists(join(dist, '404.html')), 'dist/404.html is missing: deep links will 404')

const manifest = JSON.parse(await readFile(join(dist, 'manifest.webmanifest'), 'utf8'))
check(manifest.start_url === base, `manifest start_url is ${manifest.start_url}, expected ${base}`)
check(manifest.scope === base, `manifest scope is ${manifest.scope}, expected ${base}`)

// The engine is useless without its models, and they are fetched, not committed,
// so an absent models:fetch would otherwise ship a silently broken app.
for (const file of ['yamnet_classifier.tflite', 'yamnet_embedder.tflite']) {
  check(await exists(join(dist, 'models', file)), `dist/models/${file} is missing`)
}
const wasm = (await exists(join(dist, 'models', 'wasm')))
  ? await readdir(join(dist, 'models', 'wasm'))
  : []
check(
  wasm.some((file) => file.endsWith('.wasm')),
  'dist/models/wasm holds no .wasm files',
)

// earshot's two out-of-band entry points must be real files, not inlined.
const assets = await readdir(join(dist, 'assets'))
for (const entry of ['capture-worklet', 'engine-worker']) {
  check(
    assets.some((file) => file.startsWith(entry) && file.endsWith('.js')),
    `dist/assets holds no ${entry} chunk`,
  )
}

if (failures.length > 0) {
  console.error(`dist/ is not deployable at ${base}:`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}

console.log(`ok: dist/ is deployable at ${base} (${references.length} references checked)`)
