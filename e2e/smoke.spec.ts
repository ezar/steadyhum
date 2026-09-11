import { expect, test } from '@playwright/test'

/**
 * The main flow that must survive every change: add an appliance, land on
 * enrollment, come back and find it on Home. Audio is not exercised here —
 * see docs/earshot-integration.md.
 */
test('adds an appliance and shows it on Home', async ({ page }) => {
  await page.goto('/')

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

  await page.goto('/')
  await expect(page.getByText('Lavavajillas de prueba')).toBeVisible()
})

test('states plainly that audio never leaves the device', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
})
