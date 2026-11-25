import { test, expect } from '@playwright/test'

test.describe('Vanni Phase 9 E2E (Two Browsers, Realtime, Groups, Security, Mobile, Accessibility)', () => {
  test('register/login, live 1:1 chat with receipts, XSS safety, group flow, and 360px mobile layout', async ({ browser }) => {
    const ts = Date.now()
    const ashaEmail = `asha.${ts}@vanni.app`
    const raviEmail = `ravi.${ts}@vanni.app`
    const miraEmail = `mira.${ts}@vanni.app`

    // Check HTTP security headers + keyboard focusability on login page
    const ctxA = await browser.newContext()
    const ctxB = await browser.newContext()
    const ctxC = await browser.newContext()

    const pageA = await ctxA.newPage()
    const pageB = await ctxB.newPage()
    const pageC = await ctxC.newPage()

    let alertTriggered = false
    pageA.on('dialog', () => {
      alertTriggered = true
    })
    pageB.on('dialog', () => {
      alertTriggered = true
    })

    const uncaughtErrors = []
    pageA.on('pageerror', (err) => uncaughtErrors.push(err.message))
    pageA.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('status of 401')) {
        uncaughtErrors.push(msg.text())
      }
    })

    // 1. Security headers + keyboard navigation on /login
    const loginResp = await pageA.goto('/login')
    expect(loginResp.headers()['x-content-type-options']).toBe('nosniff')
    expect(loginResp.headers()['x-frame-options']).toBe('DENY')
    expect(loginResp.headers()['content-security-policy']).toContain("default-src 'self'")

    // Keyboard tab order check (wait for AuthContext hydration so LoginPage form renders)
    await expect(pageA.getByLabel(/Email Address/i)).toBeVisible({ timeout: 10000 })
    await pageA.keyboard.press('Tab')
    await expect(pageA.locator(':focus')).toBeVisible()

    // 2. Register User A (Asha), User B (Ravi), User C (Mira)
    await pageA.goto('/register')
    await pageA.getByLabel(/Full Name/i).fill(`Asha ${ts}`)
    await pageA.getByLabel(/Email Address/i).fill(ashaEmail)
    await pageA.getByLabel(/^Password$/i).fill('Password123')
    await pageA.getByLabel(/Confirm Password/i).fill('Password123')
    await pageA.getByRole('button', { name: /Create Account/i }).click()
    await expect(pageA).toHaveURL(/\/app/)

    await pageB.goto('/register')
    await pageB.getByLabel(/Full Name/i).fill(`Ravi ${ts}`)
    await pageB.getByLabel(/Email Address/i).fill(raviEmail)
    await pageB.getByLabel(/^Password$/i).fill('Password123')
    await pageB.getByLabel(/Confirm Password/i).fill('Password123')
    await pageB.getByRole('button', { name: /Create Account/i }).click()
    await expect(pageB).toHaveURL(/\/app/)

    await pageC.goto('/register')
    await pageC.getByLabel(/Full Name/i).fill(`Mira ${ts}`)
    await pageC.getByLabel(/Email Address/i).fill(miraEmail)
    await pageC.getByLabel(/^Password$/i).fill('Password123')
    await pageC.getByLabel(/Confirm Password/i).fill('Password123')
    await pageC.getByRole('button', { name: /Create Account/i }).click()
    await expect(pageC).toHaveURL(/\/app/)

    // 3. Asha opens New Chat, searches for Ravi, starts DM
    await pageA.getByRole('button', { name: 'New Chat' }).click()
    await pageA.getByPlaceholder('Search by name or email...').fill(`Ravi ${ts}`)
    await pageA.getByRole('button', { name: new RegExp(`Ravi ${ts}`) }).click()
    await expect(pageA).toHaveURL(/\/app\/c\/\d+/)

    // Verify accessible role="log" on message container once a message is sent
    const composerA = pageA.getByPlaceholder(/Type a message/i)
    await composerA.fill('Hello Ravi <script>alert("xss")</script> https://example.com')
    await composerA.press('Enter')

    await expect(pageA.getByRole('log')).toHaveAttribute('aria-live', 'polite')
    await expect(pageA.getByRole('log').getByText(/Hello Ravi <script>alert\("xss"\)<\/script>/)).toBeVisible()

    // 4. Ravi receives conversation + message live in browser B and sends read receipt by opening it
    await pageB.getByRole('button', { name: new RegExp(`Asha ${ts}`) }).click()
    await expect(pageB.getByRole('log').getByText(/Hello Ravi <script>alert\("xss"\)<\/script>/)).toBeVisible({ timeout: 10000 })
    expect(alertTriggered).toBe(false)

    // Asha should see Read tick on her message
    await expect(pageA.locator('[aria-label="Read"]').first()).toBeVisible({ timeout: 10000 })

    // 5. Ravi replies and Asha sees it live
    const composerB = pageB.getByPlaceholder(/Type a message/i)
    await composerB.fill('Hi Asha, received loud and clear!')
    await composerB.press('Enter')
    await expect(pageA.getByRole('log').getByText('Hi Asha, received loud and clear!')).toBeVisible({ timeout: 10000 })

    // 6. Group flow: Asha creates group with Ravi and Mira
    await pageA.getByRole('button', { name: 'New Group' }).click()
    const groupDialog = pageA.getByRole('dialog')
    await groupDialog.getByPlaceholder('e.g. Design Team, Book Club').fill(`E2E Squad ${ts}`)
    const groupMemberSearch = groupDialog.getByPlaceholder('Search users by name or email...')
    await groupMemberSearch.fill(`Ravi ${ts}`)
    await groupDialog.getByRole('button', { name: new RegExp(`Ravi ${ts}`) }).click()
    await groupMemberSearch.fill(`Mira ${ts}`)
    await groupDialog.getByRole('button', { name: new RegExp(`Mira ${ts}`) }).click()
    await groupDialog.getByRole('button', { name: 'Create Group' }).click()

    await expect(pageA.getByRole('heading', { name: `E2E Squad ${ts}` })).toBeVisible({ timeout: 10000 })
    await pageA.getByPlaceholder(/Type a message/i).fill('Welcome to the squad!')
    await pageA.getByPlaceholder(/Type a message/i).press('Enter')

    // Mira opens group and sees the group message
    await pageC.getByRole('button', { name: new RegExp(`E2E Squad ${ts}`) }).click({ timeout: 10000 })
    await expect(pageC.getByRole('log').getByText('Welcome to the squad!')).toBeVisible({ timeout: 10000 })

    // 7. Mobile 360px viewport check on Context B
    await pageB.setViewportSize({ width: 360, height: 740 })
    await expect(pageB.getByRole('button', { name: 'Back to conversations' })).toBeVisible()
    const hasOverflow = await pageB.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasOverflow).toBe(false)

    // Back button returns to sidebar list on 360px mobile
    await pageB.getByRole('button', { name: 'Back to conversations' }).click()
    await expect(pageB.getByRole('button', { name: 'New Chat' })).toBeVisible()

    // Verify reconnect / reload resilience (page reload rehydrates session + messages cleanly)
    await pageA.reload()
    await expect(pageA.getByRole('log').getByText('Welcome to the squad!')).toBeVisible({ timeout: 10000 })

    // Verify Light / Dark theme toggle visibly updates the document and persists
    await pageA.goto('/settings')
    await expect(pageA.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await pageA.getByRole('button', { name: 'Dark' }).click()
    await expect(pageA.locator('html')).toHaveClass(/\bdark\b/)

    let darkBg = ''
    await expect(async () => {
      darkBg = await pageA.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(darkBg).not.toContain('0.984')
    }).toPass({ timeout: 3000 })

    await pageA.getByRole('button', { name: 'Light' }).click()
    await expect(pageA.locator('html')).not.toHaveClass(/\bdark\b/)

    await expect(async () => {
      const lightBg = await pageA.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(lightBg).not.toBe(darkBg)
    }).toPass({ timeout: 3000 })

    expect(uncaughtErrors).toEqual([])

    await ctxA.close()
    await ctxB.close()
    await ctxC.close()
  })
})
