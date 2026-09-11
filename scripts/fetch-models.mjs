#!/usr/bin/env node
/**
 * Puts the models earshot needs into public/models/.
 *
 * The two YAMNet `.tflite` files are downloaded and checked against the SHA-256
 * pinned in manifest.json. The MediaPipe WASM runtime is copied out of the
 * installed `@mediapipe/tasks-audio` package rather than downloaded, so it can
 * never drift from the version the app was built against.
 *
 * The app must never depend on a third-party CDN at runtime for any of this, so
 * everything is self-hosted and precached by the service worker. The deployment
 * runs this before `vite build`, via `pnpm vercel-build`.
 *
 * Usage:
 *   node scripts/fetch-models.mjs               fetch what is missing, verify all
 *   node scripts/fetch-models.mjs --verify-only verify without downloading
 *   node scripts/fetch-models.mjs --force       re-download everything
 */
import { createHash } from 'node:crypto'
import { access, cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const modelsDir = join(rootDir, 'public', 'models')
const manifestPath = join(modelsDir, 'manifest.json')

const verifyOnly = process.argv.includes('--verify-only')
const force = process.argv.includes('--force')

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

async function download(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status} ${response.statusText}`)
  }
  return Buffer.from(await response.arrayBuffer())
}

/**
 * Resolves the wasm directory of the installed @mediapipe/tasks-audio.
 *
 * The package does not expose `./package.json` in its `exports`, so the package
 * root is derived from its main entry, which sits at the root. Resolution is
 * anchored at this project so pnpm's virtual store is followed correctly.
 */
function resolveWasmSource(spec) {
  const [scope, name, ...rest] = spec.split('/')
  const pkg = spec.startsWith('@') ? `${scope}/${name}` : scope
  const subpath = spec.startsWith('@') ? rest : [name, ...rest]
  const require = createRequire(join(rootDir, 'package.json'))
  return join(dirname(require.resolve(pkg)), ...subpath)
}

async function syncWasm(entry) {
  const target = join(modelsDir, entry.to)
  const source = resolveWasmSource(entry.from)

  if (verifyOnly) {
    if (!(await exists(target))) throw new Error(`missing: ${entry.to}/`)
    console.log(`ok: ${entry.to}/ present`)
    return
  }

  await cp(source, target, { recursive: true, force: true })
  const copied = await readdir(target)
  console.log(`ok: ${entry.to}/ (${copied.length} files from ${entry.from})`)
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  await mkdir(modelsDir, { recursive: true })

  const failures = []

  for (const entry of manifest.files) {
    const target = join(modelsDir, entry.name)
    const present = await exists(target)

    if (!present && verifyOnly) {
      failures.push(`missing: ${entry.name}`)
      continue
    }

    let bytes
    if (present && !force) {
      bytes = await readFile(target)
    } else {
      process.stdout.write(`fetching ${entry.name}… `)
      bytes = await download(entry.url)
      await writeFile(target, bytes)
      process.stdout.write('done\n')
    }

    const digest = sha256(bytes)
    if (entry.sha256 !== digest) {
      failures.push(`checksum mismatch: ${entry.name} expected ${entry.sha256}, got ${digest}`)
    } else {
      console.log(`ok: ${entry.name} (${(bytes.byteLength / 1e6).toFixed(1)} MB)`)
    }
  }

  try {
    await syncWasm(manifest.wasm)
  } catch (error) {
    failures.push(error.message)
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(failure)
    console.error(`${failures.length} model asset(s) failed`)
    process.exitCode = 1
  }
}

await main()
