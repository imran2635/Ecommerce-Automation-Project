const { chromium } = require('playwright');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_RESULTS = path.join(PROJECT_ROOT, 'test-results');
const ADMIN_PHONE = process.env.ADMIN_PHONE || process.env.STOREFRONT_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.STOREFRONT_PASSWORD;

function requireCredential(value, name) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    downloadsPath: path.join(PROJECT_ROOT, 'downloads'),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const admin = 'https://imranfashion.store.bponi.com/admin/login/?next=%2Forder%2F';

  try {
    console.log('1) Admin login');
    await page.goto(admin);

    if (/\/admin\/login\//.test(page.url())) {
      await page.waitForTimeout(2000);
      const phone = page.getByPlaceholder('Enter phone');
      if (await phone.isVisible().catch(() => false)) {
        await phone.click();
        await phone.press('Control+A');
        await phone.pressSequentially(requireCredential(ADMIN_PHONE, 'ADMIN_PHONE'), { delay: 80 });
        await phone.press('Tab');
        console.log('Admin phone before submit:', await phone.inputValue());
        await page.getByRole('button', { name: /continue/i }).click();
      }

      const password = page.locator('input[type="password"]');
      await password.waitFor({ state: 'visible', timeout: 15000 });
      await password.fill(requireCredential(ADMIN_PASSWORD, 'ADMIN_PASSWORD'));
      await page.getByRole('button', { name: /sign in/i }).click();
    }

    await page.waitForURL(/\/admin\/order\//, { timeout: 30000 });
    console.log('2) Open first/latest order');
    const orderAction = page.locator("button[aria-label*='Order actions']").first();
    await orderAction.waitFor({ state: 'visible' });
    await orderAction.click();
    await page.getByText('Open order', { exact: true }).click();
    await page.waitForURL(/\/admin\/order\/\?ref=/);
    const ref = new URL(page.url()).searchParams.get('ref');
    console.log('Latest order:', ref);

    console.log('3) Confirm order');
    const confirmed = page.getByRole('button', { name: /^confirmed$/i });
    await confirmed.waitFor({ state: 'visible' });
    await confirmed.click();

    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible' });
    const note = dialog.locator('textarea');
    if (await note.isVisible().catch(() => false)) {
      await note.fill('Customer and order details are confirmed.');
    }
    await dialog.getByRole('button', { name: /^confirm order$/i }).click();
    await page.waitForTimeout(2500);

    const body = await page.locator('body').innerText();
    if (!/Confirmed/i.test(body)) throw new Error('Confirmed status not found after update.');
    await page.screenshot({ path: path.join(TEST_RESULTS, 'checkout-flow-final.png'), fullPage: true });
    console.log('Admin confirmation verified:', ref);
  } catch (error) {
    console.error('Admin recovery failed at URL:', page.url());
    console.error('Visible controls:', await page.locator('input, button, [role="button"]').evaluateAll((nodes) =>
      nodes.filter((node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return rect.width && rect.height && style.display !== 'none' && style.visibility !== 'hidden';
      }).map((node) => ({
        tag: node.tagName,
        type: node.getAttribute('type'),
        placeholder: node.getAttribute('placeholder'),
        text: (node.innerText || node.getAttribute('aria-label') || '').trim(),
      }))
    ));
    await page.screenshot({ path: path.join(TEST_RESULTS, 'admin-recovery-debug.png'), fullPage: true });
    throw error;
  } finally {
    await browser.close();
  }
})();
