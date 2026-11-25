import { Buffer } from 'node:buffer'
import { test, expect } from '@playwright/test'

test.describe('Vanni Phase 9 E2E (Two Browsers, Realtime, Groups, Security, Mobile, Accessibility)', () => {
  test('register/login, live 1:1 chat with receipts, XSS safety, group flow, and 360px mobile layout', async ({ browser }) => {
    test.setTimeout(120000)
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

    let allowExpected400 = false
    const uncaughtErrors = []
    pageA.on('pageerror', (err) => uncaughtErrors.push(err.message))
    pageA.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text()
        if (text.includes('status of 401')) return
        if (allowExpected400 && text.includes('status of 400')) return
        uncaughtErrors.push(text)
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

    // 5. Typing indicator + Ravi replies and Asha sees it live (plus same-user second tab sync)
    const pageA2 = await ctxA.newPage()
    await pageA2.goto(`/app`)
    await expect(pageA2.getByRole('button', { name: new RegExp(`Ravi ${ts}`) })).toBeVisible({ timeout: 10000 })

    const composerB = pageB.getByPlaceholder(/Type a message/i)
    await composerB.pressSequentially('Hi ', { delay: 40 })
    await expect(pageA.getByText(/typing/i)).toBeVisible({ timeout: 5000 })

    await composerB.fill('Hi Asha, received loud and clear!')
    await composerB.press('Enter')
    await expect(pageA.getByRole('log').getByText('Hi Asha, received loud and clear!')).toBeVisible({ timeout: 10000 })
    await expect(pageA2.getByRole('button', { name: new RegExp(`Hi Asha, received loud and clear!`) })).toBeVisible({ timeout: 10000 })
    await pageA2.close()

    // Asha edits her own message, adds a reaction, and uploads a valid PNG + rejected spoofed .exe.png
    const myMsgBubble = pageA.locator('[id^="msg-"]').filter({ hasText: 'Hello Ravi' }).first()
    await myMsgBubble.hover()
    await myMsgBubble.getByRole('button', { name: 'Edit message' }).click()
    const editComposerA = pageA.getByPlaceholder('Edit your message...')
    await editComposerA.fill('Hello Ravi edited!')
    await editComposerA.press('Enter')
    await expect(pageB.getByRole('log').getByText('Hello Ravi edited!')).toBeVisible({ timeout: 10000 })
    await expect(pageA.getByRole('log').getByText('edited', { exact: true })).toBeVisible({ timeout: 10000 })

    // Attachment upload: valid 1x1 PNG works, spoofed MZ .exe renamed .png rejected with alert
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const fileInputA = pageA.locator('input[type="file"]').first()
    await fileInputA.setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from(pngBase64, 'base64'),
    })
    await expect(pageA.getByRole('button', { name: 'Send message' })).toBeEnabled({ timeout: 10000 })
    await pageA.getByRole('button', { name: 'Send message' }).click()
    await expect(pageB.getByRole('log').locator('img[alt="photo.png"]')).toBeVisible({ timeout: 10000 })

    allowExpected400 = true
    await fileInputA.setInputFiles({
      name: 'malware.png',
      mimeType: 'image/png',
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]),
    })
    await expect(pageA.getByRole('alert').first()).toBeVisible({ timeout: 10000 })
    allowExpected400 = false
    await pageA.getByRole('button', { name: 'Remove attachment' }).click()

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
    await pageA.getByPlaceholder(/@ to mention/i).fill('Welcome to the squad!')
    await pageA.getByPlaceholder(/@ to mention/i).press('Enter')

    // Mira opens group and sees the group message, then Asha removes Mira
    await pageC.getByRole('button', { name: new RegExp(`E2E Squad ${ts}`) }).click({ timeout: 10000 })
    await expect(pageC.getByRole('log').getByText('Welcome to the squad!')).toBeVisible({ timeout: 10000 })

    await pageA.getByRole('button', { name: 'Group Info' }).click()
    const miraRow = pageA.locator('aside div.flex.items-center.justify-between').filter({ hasText: `Mira ${ts}` }).first()
    const [delResp] = await Promise.all([
      pageA.waitForResponse((r) => r.url().includes('/members/') && r.request().method() === 'DELETE'),
      miraRow.getByRole('button', { name: 'Remove member' }).click(),
    ])
    expect(delResp.status()).toBe(204)
    await expect(pageC.getByRole('heading', { name: /Welcome to Vanni/i })).toBeVisible({ timeout: 10000 })

    // 6b. Phase 11 Mentions flow: Ravi switches away & mutes group -> Asha @mentions Ravi -> Ravi sees @ badge & clears on read
    await pageB.goto('/app')
    const squadRowB = pageB.locator('aside div.relative.group').filter({ hasText: `E2E Squad ${ts}` }).first()
    await squadRowB.hover()
    await squadRowB.getByRole('button', { name: 'Chat options' }).click()
    await pageB.getByText('Off (Muted)').click()
    await pageB.waitForTimeout(250)

    const groupComposerA = pageA.getByPlaceholder(/@ to mention/i)
    await groupComposerA.fill('Hey @Ravi')
    await expect(pageA.getByRole('listbox', { name: /Mention suggestions/i })).toBeVisible()
    await groupComposerA.press('Enter')
    await groupComposerA.press('Enter')

    await expect(pageA.getByRole('log').getByRole('button', { name: new RegExp(`@Ravi ${ts}`) })).toBeVisible({ timeout: 10000 })
    await expect(squadRowB.getByLabel('Unread mentions')).toBeVisible({ timeout: 10000 })

    // Ravi opens the group, sees highlighted mention pill, and @ badge clears
    await squadRowB.click()
    await expect(pageB.getByRole('log').getByRole('button', { name: new RegExp(`@Ravi ${ts}`) })).toBeVisible({ timeout: 10000 })
    await expect(squadRowB.getByLabel('Unread mentions')).toHaveCount(0, { timeout: 10000 })

    // 7. Mobile 390px viewport check on Context B
    await pageB.setViewportSize({ width: 390, height: 844 })
    await expect(pageB.getByRole('button', { name: 'Back to conversations' })).toBeVisible()
    const hasOverflow = await pageB.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(hasOverflow).toBe(false)

    // Back button returns to sidebar list on 390px mobile
    await pageB.getByRole('button', { name: 'Back to conversations' }).click()
    await expect(pageB.getByRole('button', { name: 'New Chat' })).toBeVisible()

    // Verify reconnect / reload resilience (page reload rehydrates session + messages cleanly)
    await pageA.reload()
    await expect(pageA.getByRole('log').getByText('Welcome to the squad!')).toBeVisible({ timeout: 10000 })

    // Verify Light / Dark theme toggle visibly updates the document and persists
    await pageA.goto('/settings')
    await expect(pageA.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await pageA.getByRole('button', { name: 'Dark', exact: true }).click()
    await expect(pageA.locator('html')).toHaveClass(/\bdark\b/)

    let darkBg = ''
    await expect(async () => {
      darkBg = await pageA.evaluate(() => getComputedStyle(document.body).backgroundColor)
      expect(darkBg).not.toContain('0.984')
    }).toPass({ timeout: 3000 })

    await pageA.getByRole('button', { name: 'Light', exact: true }).click()
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
