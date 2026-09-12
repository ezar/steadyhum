import { expect, test } from '@playwright/test'

import { executablePath, FAKE_MIC_ARGS, SILENCE_WAV } from './fake-audio.ts'

/*
 * Feed Chromium silence instead of its default tone, so every window is
 * rejected. Launch options replace the project's wholesale, so the base
 * arguments are repeated here rather than extended.
 */
test.use({
  launchOptions: {
    ...(executablePath === undefined ? {} : { executablePath }),
    args: [...FAKE_MIC_ARGS, `--use-file-for-fake-audio-capture=${SILENCE_WAV}%noloop`],
  },
})

/**
 * The point of running the guards inside the worker is that the engine then
 * skips the embedder for windows it rejects — over half the per-window cost,
 * spent on embeddings the app throws away, since nothing ever reads back an
 * embedding for a rejected window.
 *
 * Nothing on screen shows it, and the weaker version of this test — asserting
 * only that a verdict is present — stays green under `embedRejectedWindows`
 * or anything else that keeps the verdict and restores the cost. So assert
 * the thing itself: a rejected window stores no embedding at all.
 */
test('skips the embedder for windows the guards reject', async ({ page }) => {
  test.slow()

  await page.goto('./')
  await page.waitForURL(/\/welcome$/)
  await page.getByRole('button', { name: /saltar|skip/i }).click()
  await page.waitForURL(/\/(steadyhum\/)?$/)

  await page.goto('./appliances/new')
  await page.getByRole('textbox').first().fill('Silencio')
  await page.getByRole('button', { name: /guardar electrodoméstico|save appliance/i }).click()
  await page.waitForURL(/\/learn$/)

  const start = page.getByRole('button', { name: /empezar sesión|start session/i })
  await expect(start).toBeEnabled({ timeout: 60_000 })
  await start.click()
  await expect(page.getByText(/[1-9]\d* \/ 120/)).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: /terminar sesión|end session/i }).click()
  // Silence teaches it nothing, so enrolment stays at zero clean seconds.
  await expect(page.getByText(/0 (de|of) 3|0 \/ 3/)).toBeVisible({ timeout: 30_000 })

  const rows = await page.evaluate(async () => {
    interface Request<T> {
      result: T
      error: unknown
      onsuccess: (() => void) | null
      onerror: (() => void) | null
    }
    interface Row {
      window: { guard?: unknown }
      embedding: { dimensions: number }
      rejectedFor: string[]
    }
    interface Database {
      transaction: (
        store: string,
        mode: string,
      ) => { objectStore: (store: string) => { getAll: () => Request<Row[]> } }
    }
    const open = <T>(request: Request<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        request.onsuccess = () => {
          resolve(request.result)
        }
        request.onerror = () => {
          reject(request.error instanceof Error ? request.error : new Error('IndexedDB failed'))
        }
      })
    const factory = (
      globalThis as unknown as { indexedDB: { open: (name: string) => Request<Database> } }
    ).indexedDB
    const db = await open(factory.open('steadyhum'))
    const all = await open(db.transaction('windows', 'readonly').objectStore('windows').getAll())
    return all.map((row) => ({
      rejected: row.rejectedFor.length > 0,
      reasons: row.rejectedFor,
      dimensions: row.embedding.dimensions,
      fromWorker: row.window.guard !== undefined,
    }))
  })

  expect(rows.length).toBeGreaterThan(0)
  // Silence is silence: every window should have been rejected for it.
  expect(rows.every((row) => row.rejected)).toBe(true)
  expect(rows.every((row) => row.reasons.includes('silence'))).toBe(true)
  // And none of them cost an embedding.
  expect(rows.every((row) => row.dimensions === 0)).toBe(true)
  expect(rows.every((row) => row.fromWorker)).toBe(true)
})
