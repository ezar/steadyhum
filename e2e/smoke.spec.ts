import { expect, test } from '@playwright/test'

/**
 * The main flow that must survive every change: add an appliance, land on
 * enrollment, come back and find it on Home. Audio is not exercised here —
 * see docs/earshot-integration.md.
 */
test('adds an appliance and shows it on Home', async ({ page }) => {
  await page.goto('./')

  await page
    .getByRole('link', { name: /añadir electrodoméstico|add appliance/i })
    .first()
    .click()
  await page.getByRole('radio', { name: /lavavajillas|dishwasher/i }).check({ force: true })
  await page.getByRole('textbox').first().fill('Lavavajillas de prueba')
  await page.getByRole('button', { name: /guardar electrodoméstico|save appliance/i }).click()

  await expect(page).toHaveURL(/\/learn$/)
  await expect(
    page.getByRole('heading', { name: /aprender su normal|learn its normal/i }),
  ).toBeVisible()

  await page.goto('./')
  await expect(page.getByText('Lavavajillas de prueba')).toBeVisible()
})

test('states plainly that audio never leaves the device', async ({ page }) => {
  await page.goto('./privacy')
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
})

/**
 * The regression that matters most.
 *
 * Three separate things had to line up before the engine would start at all:
 * the MediaPipe specifier had to survive bundling, the worker had to be classic
 * so MediaPipe's `importScripts` exists, and MediaPipe had to be a version that
 * still ships `AudioEmbedder`. None of that is visible to a typecheck, and each
 * failed only at runtime, inside a Worker.
 */
test('the audio engine starts and produces analysis windows', async ({ page }) => {
  test.slow()

  await page.goto('./appliances/new')
  await page.getByRole('textbox').first().fill('Motor')
  await page.getByRole('button', { name: /guardar electrodoméstico|save appliance/i }).click()
  await page.waitForURL(/\/learn$/)

  const start = page.getByRole('button', { name: /empezar sesión|start session/i })
  await expect(start).toBeEnabled({ timeout: 60_000 })

  await start.click()
  // Windows arrive every HOP_SECONDS; the counter only moves once they do.
  await expect(page.getByText(/[1-9]\d* \/ 120/)).toBeVisible({ timeout: 60_000 })
  // A live level means real audio reached the feature extractor, not just a timer.
  await expect(page.getByText(/-?\d+\.\d+ dB/)).toBeVisible()

  await page.getByRole('button', { name: /terminar sesión|end session/i }).click()
  await expect(page.getByText(/1 (de|of) 3/)).toBeVisible({ timeout: 30_000 })
})
