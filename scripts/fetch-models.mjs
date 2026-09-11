#!/usr/bin/env node
/**
 * Downloads the P0 models into public/models/ and verifies their checksums.
 *
 * The app must never depend on a third-party CDN at runtime for these files, so
 * they are self-hosted and cached by the service worker. The Vercel build runs
 * this before `vite build`.
 *
 * Usage:
 *   node scripts/fetch-models.mjs              fetch what is missing, verify all
 *   node scripts/fetch-models.mjs --verify-only verify without downloading
 *   node scripts/fetch-models.mjs --force       re-download everything
 */
import { createHash } from 'node:crypto'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
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

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  await mkdir(modelsDir, { recursive: true })

  let failures = 0
  let unpinned = 0

  for (const entry of manifest.files) {
    const target = join(modelsDir, entry.name)
    const present = await exists(target)

    if (!present && verifyOnly) {
      console.error(`missing: ${entry.name}`)
      failures += 1
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
    if (entry.sha256 === '') {
      console.warn(`unpinned: ${entry.name} sha256 is ${digest} — paste it into manifest.json`)
      unpinned += 1
    } else if (entry.sha256 !== digest) {
      console.error(`checksum mismatch: ${entry.name} expected ${entry.sha256}, got ${digest}`)
      failures += 1
    } else {
      console.log(`ok: ${entry.name} (${(bytes.byteLength / 1e6).toFixed(1)} MB)`)
    }
  }

  if (failures > 0) {
    console.error(`${failures} model file(s) failed verification`)
    process.exitCode = 1
    return
  }
  if (unpinned > 0) {
    console.warn(`${unpinned} model file(s) have no pinned checksum yet`)
  }
}

await main()
