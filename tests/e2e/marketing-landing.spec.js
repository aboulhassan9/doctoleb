import { test, expect } from '@playwright/test'

// Local E2E smoke for the marketing landing page. Runs against the
// preview-served `apps/marketing` build. Catches regressions in the public
// surface (hero, pricing, FAQ, lead-capture form) before they ship to
// Vercel. Does NOT submit a real lead — that would hit the live
// marketing-capture-lead Edge Function and the prospect_leads table.

test.describe('marketing landing page', () => {
  test('renders the hero, pricing tiers, FAQ, and lead-capture form', async ({ page }) => {
    await page.goto('/')

    // Hero
    await expect(page).toHaveTitle(/DoctoLeb/i)
    await expect(page.getByRole('heading', { name: /Your clinic,/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Start your clinic/i }).first()).toBeVisible()

    // Trust band
    await expect(page.getByText(/Per-clinic database/i)).toBeVisible()
    await expect(page.getByText(/Zero-PHI control plane/i)).toBeVisible()

    // Features
    await expect(page.getByRole('heading', { name: /Smart scheduling/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Clinical encounters/i })).toBeVisible()

    // Pricing
    await expect(page.getByRole('heading', { name: 'Solo' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Enterprise' })).toBeVisible()
    await expect(page.getByText('Most clinics pick this')).toBeVisible()

    // FAQ — expand the first one
    const firstFaq = page.getByRole('button', { name: /Who owns the patient data/i })
    await expect(firstFaq).toBeVisible()
    await firstFaq.click()
    await expect(page.getByText(/Each clinic gets its own Postgres database/i)).toBeVisible()

    // CTA form is present (we do not submit it in the smoke)
    await expect(page.getByLabel(/^Email$/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /Reserve my spot/i })).toBeVisible()
  })

  test('lead-capture form rejects invalid emails before submit', async ({ page }) => {
    await page.goto('/#cta')
    const emailInput = page.getByLabel(/^Email$/i)
    await emailInput.fill('not-an-email')
    const submit = page.getByRole('button', { name: /Reserve my spot/i })
    await submit.click()
    // The native HTML5 validation should prevent submission.
    // We confirm we're still on the same page and the form isn't in the
    // success state.
    await expect(page).toHaveURL(/#cta/)
    await expect(page.getByText(/You're on the list/i)).toHaveCount(0)
  })
})
