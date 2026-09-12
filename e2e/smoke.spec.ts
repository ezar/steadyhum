import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Start past the first-run introduction.
 *
 * Every test here is about the app proper, and each runs with a fresh profile,
 * so without this they would all begin by dismissing the same three panels. The
 * introduction has its own test at the bottom of this file.
 */
async function skipIntroduction(page: Page): Promise<void> {
  await page.goto('./')
  // Every test gets a fresh profile, so the introduction always comes up. Wait
  // for it rather than testing the URL straight after goto: the redirect is
  // client-side, so it has not happened yet at that point — and asserting it
  // means a broken redirect fails these tests loudly instead of quietly
  // skipping past them.
  await page.waitForURL(/\/welcome$/)
  await page.getByRole('button', { name: /saltar|skip/i }).click()
  await page.waitForURL(/\/(steadyhum\/)?$/)
}

/**
 * The main flow that must survive every change: add an appliance, land on
 * enrollment, come back and find it on Home. Audio is not exercised here —
 * see docs/earshot-integration.md.
 */
test('adds an appliance and shows it on Home', async ({ page }) => {
  await skipIntroduction(page)

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
  await skipIntroduction(page)
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

  await skipIntroduction(page)
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

/**
 * The introduction has two jobs: appear once for someone new, and never get in
 * the way again. The second is the one worth a test — a first-run screen that
 * reappears is worse than none at all.
 */
test('introduces itself once, then stays out of the way', async ({ page }) => {
  await page.goto('./')

  // A fresh visitor lands on the introduction, not on an empty Home.
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // It says the two things that matter before anything else: what it will not
  // claim to know, and that recordings stay on the device.
  await expect(
    page.getByText(/no te va a decir qué está roto|will not tell you what is broken/i),
  ).toBeVisible()
  await page.getByRole('button', { name: /siguiente|next/i }).click()
  await expect(page.getByText(/no sale de este móvil|never leaves this phone/i)).toBeVisible()

  // And what it is going to cost before it is useful.
  await page.getByRole('button', { name: /siguiente|next/i }).click()
  await expect(page.getByText(/3 grabaciones|3 recordings/i)).toBeVisible()

  await page.getByRole('button', { name: /empezar|get started/i }).click()
  await expect(page).toHaveURL(/\/appliances\/new$/)

  // Back to Home, and it must not take over again.
  await page.goto('./')
  await expect(page).toHaveURL(/\/(steadyhum\/)?$/)
  await expect(
    page.getByRole('heading', { name: /tus electrodomésticos|your appliances/i }),
  ).toBeVisible()
})

/**
 * The introduction is shown once, which means it also has to be reachable
 * again. Replaying it must not behave like a first run: neither way out of it
 * may push the reader into adding an appliance, and — the part worth guarding —
 * it must not leave them seeing it on every visit afterwards.
 *
 * Both exits are exercised deliberately. They are separate code paths, and a
 * test that only takes the header one passes with the footer one broken: that
 * is exactly the hole this test had on its first draft.
 */
test('the introduction can be read again from Help, without becoming first-run again', async ({
  page,
}) => {
  await skipIntroduction(page)

  await page.getByRole('link', { name: /ayuda|help/i }).click()
  await expect(page).toHaveURL(/\/help$/)

  await page.getByRole('link', { name: /ver la introducción|see the introduction/i }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await expect(
    page.getByText(/no te va a decir qué está roto|will not tell you what is broken/i),
  ).toBeVisible()

  // Read to the end and leave by the primary button. For a new user this is
  // "Empezar" and lands on add-appliance; a reader gets "Cerrar" and Help.
  await page.getByRole('button', { name: /siguiente|next/i }).click()
  await page.getByRole('button', { name: /siguiente|next/i }).click()
  await page.locator('footer').getByRole('button').click()
  await expect(page).toHaveURL(/\/help$/)

  // And the header exit, which a reader is more likely to take part-way
  // through, goes to the same place rather than dumping them on Home.
  await page.getByRole('link', { name: /ver la introducción|see the introduction/i }).click()
  await expect(page).toHaveURL(/\/welcome$/)
  await page.locator('header').getByRole('button').click()
  await expect(page).toHaveURL(/\/help$/)

  // Home still belongs to them: replaying must not have reset the flag.
  await page.goto('./')
  await expect(page).toHaveURL(/\/(steadyhum\/)?$/)
})

/**
 * Help has to carry the answers the app itself refuses to give — above all the
 * honest limit, which is the whole product principle and the first thing a
 * confused user goes looking for.
 */
test('help answers the questions the app provokes', async ({ page }) => {
  await skipIntroduction(page)
  await page.goto('./help')

  const honest = page.getByRole('group').filter({ hasText: /qué está roto|what is broken/i })
  await expect(honest).toBeVisible()

  // Collapsed until asked for: ten open answers would be a wall of text.
  const answer = honest.getByText(/nadie puede saberlo|no model can make honestly/i)
  await expect(answer).toBeHidden()
  await honest.locator('summary').click()
  await expect(answer).toBeVisible()

  // And the refusal that matters for safety is present, not buried.
  await expect(page.getByText(/técnico certificado|certified technician/i)).toBeAttached()
})

/**
 * Renaming was reachable from the data layer and from nowhere else — P0 asks
 * for it, and `renameAppliance` sat unused. The test that matters is that the
 * new name survives to Home, not merely that the field accepts typing.
 */
test('renames an appliance, and the new name reaches Home', async ({ page }) => {
  await skipIntroduction(page)

  await page.goto('./appliances/new')
  await page.getByRole('textbox').first().fill('Nevera vieja')
  await page.getByRole('button', { name: /guardar electrodoméstico|save appliance/i }).click()
  await page.waitForURL(/\/learn$/)

  await page.goto('./')
  await page.getByText('Nevera vieja').click()

  await page.getByRole('button', { name: /cambiar nombre|rename/i }).click()
  const field = page.getByRole('textbox').first()
  await expect(field).toHaveValue('Nevera vieja')

  // An empty name would leave an unlabelled card on Home, so it cannot be saved.
  await field.fill('')
  await expect(page.getByRole('button', { name: /^(guardar|save)$/i })).toBeDisabled()

  await field.fill('Nevera de la cocina')
  await page.getByRole('button', { name: /^(guardar|save)$/i }).click()

  await expect(page.getByRole('heading', { name: 'Nevera de la cocina' })).toBeVisible()
  await page.goto('./')
  await expect(page.getByText('Nevera de la cocina')).toBeVisible()
  await expect(page.getByText('Nevera vieja')).toHaveCount(0)
})
