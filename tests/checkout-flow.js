const { chromium } = require('playwright');
const path = require('path');

const FULL_FLOW = process.argv.includes('--full');
const results = [];
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_RESULTS = path.join(PROJECT_ROOT, 'test-results');
const STOREFRONT_PHONE = process.env.STOREFRONT_PHONE;
const STOREFRONT_PASSWORD = process.env.STOREFRONT_PASSWORD;
const ADMIN_PHONE = process.env.ADMIN_PHONE || STOREFRONT_PHONE;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || STOREFRONT_PASSWORD;
const CHECKOUT_PHONE = process.env.CHECKOUT_PHONE || '1700000000';

function requireCredential(value, name) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

const TEST_FLOW = [
  'Open storefront login page',
  'Login with storefront phone and password',
  'Open the Air pods product details page',
  'Click Add to cart',
  'Click Go to cart and open checkout',
  'Negative: reject an invalid short phone number',
  'Negative: reject a customer name shorter than 4 characters',
  'Negative: reject an empty delivery address',
  'Enter customer phone: 1700000000',
  'Validate that the valid phone shows no phone/contact error',
  'Enter customer name: Test User',
  'Enter delivery address: House 10, Road 5, Dhanmondi, Dhaka',
  'Click Continue to delivery/payment',
  'Select Inside Dhaka delivery',
  'Select Cash on Delivery',
  'Negative: keep Place order disabled until Terms are accepted',
  'Accept Terms and conditions when shown',
  'Validate that Place order is enabled',
  'Full mode only: click Place order and validate Order successful',
  'Full mode only: capture the storefront Order ID',
  'Full mode only: login to the admin order page',
  'Full mode only: open the first/latest order',
  'Full mode only: verify admin Order ID matches storefront Order ID',
  'Full mode only: click Confirmed and then Confirm order',
  'Full mode only: accept an already Confirmed order as a valid idempotent result',
  'Validate the final CONFIRMED status and save a screenshot',
];

function pass(message, category = 'POSITIVE') {
  results.push({ status: 'PASS', category, message });
  console.log(`PASS [${category}]: ${message}`);
}

function skip(message, category = 'POSITIVE') {
  results.push({ status: 'SKIP', category, message });
  console.log(`SKIP [${category}]: ${message}`);
}

function legacyValidate(condition, message, details = '') {
  if (!condition) throw new Error(`FAIL: ${message}${details ? ` — ${details}` : ''}`);
  pass(message);
}

function validate(condition, message, details = '', category = 'POSITIVE') {
  if (!condition) {
    results.push({ status: 'FAIL', category, message });
    throw new Error(`FAIL [${category}]: ${message}${details ? ` - ${details}` : ''}`);
  }
  pass(message, category);
}

function check(condition, message, details = '', category = 'NEGATIVE') {
  if (!condition) {
    results.push({ status: 'FAIL', category, message });
    console.error(`FAIL [${category}]: ${message}${details ? ` - ${details}` : ''}`);
    return false;
  }
  pass(message, category);
  return true;
}

async function replaceValue(locator, value) {
  await locator.waitFor({ state: 'visible' });
  await locator.click();
  await locator.press('Control+A');
  await locator.pressSequentially(value, { delay: 80 });
  await locator.press('Tab');
}

async function typeAfterHydration(locator, value) {
  await replaceValue(locator, value);
  const actualDigits = (await locator.inputValue()).replace(/\D/g, '');
  const expectedDigits = value.replace(/\D/g, '');
  // Phone widgets may normalize a local number to E.164 by prepending 880.
  validate(actualDigits.endsWith(expectedDigits), `Field accepted value ${value}`, `actual digits: ${actualDigits}`);
}

async function dismissNotifications(page) {
  const dismissButtons = page.getByRole('button', { name: /dismiss notification/i });
  const count = await dismissButtons.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const button = dismissButtons.nth(index);
    if (await button.isVisible().catch(() => false)) await button.click();
  }
  await page.waitForTimeout(250);
}

async function enterValidCheckoutPhone(page, locator, value) {
  // Remove messages intentionally produced by a preceding negative test,
  // then verify that the valid value does not create a fresh phone error.
  await dismissNotifications(page);
  await typeAfterHydration(locator, value);
  await page.waitForTimeout(400);
  const visiblePageText = await page.locator('body').innerText();
  const hasPhoneError = /contact required|enter a valid phone number|invalid phone/i.test(visiblePageText);
  validate(!hasPhoneError, 'Valid phone number shows no validation error', hasPhoneError ? 'phone error remained visible' : '');
}

async function returnToContactStep(page, continueButton) {
  if (await continueButton.isVisible().catch(() => false)) return;
  const backButton = page.getByRole('button', { name: /back to cart and address/i });
  await backButton.waitFor({ state: 'visible' });
  await backButton.click();
  await continueButton.waitFor({ state: 'visible' });
}

(async () => {
  const browser = await chromium.launch({
    headless: false,
    downloadsPath: path.join(PROJECT_ROOT, 'downloads'),
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const site = 'https://imranfashion.store.bponi.com';
  const admin = `${site}/admin/login/?next=%2Forder%2F`;

  try {
    console.log(`Mode: ${FULL_FLOW ? 'FULL E2E (creates and confirms a real COD order)' : 'VALIDATION ONLY (stops before Place order)'}`);
    console.log('\nTest flow');
    TEST_FLOW.forEach((step, index) => console.log(`${String(index + 1).padStart(2, '0')}. ${step}`));

    console.log('\n1) Storefront login');
    await page.goto(`${site}/login/`);
    await page.waitForTimeout(1500);
    await typeAfterHydration(page.getByPlaceholder('Enter phone'), requireCredential(STOREFRONT_PHONE, 'STOREFRONT_PHONE'));
    await page.getByRole('button', { name: /continue/i }).click();
    const storefrontPassword = page.locator('input[type="password"]');
    await storefrontPassword.waitFor({ state: 'visible' });
    pass('Storefront phone step advanced to password');
    await storefrontPassword.fill(requireCredential(STOREFRONT_PASSWORD, 'STOREFRONT_PASSWORD'));
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/https:\/\/imranfashion\.store\.bponi\.com\/?$/);
    pass('Storefront login succeeded');

    console.log('\n2) Product and cart');
    await page.goto(`${site}/product/air-pods/IRqF/`);
    validate(/\/product\/air-pods\/IRqF\//.test(page.url()), 'Air pods product page opened');
    const addToCart = page.locator('#storefront-inline-action-panel button:has-text("Add to cart")');
    await addToCart.waitFor({ state: 'visible' });
    pass('Add to cart button is visible');
    await addToCart.click();
    const goToCart = page.locator('#storefront-inline-action-panel button:has-text("Go to cart")');
    await goToCart.waitFor({ state: 'visible' });
    pass('Product was added to cart');
    await goToCart.click();

    console.log('\n3) Customer details and payment choices');
    await page.waitForURL(/\/checkout\//);
    pass('Checkout page opened');
    await page.waitForTimeout(1500);
    const checkoutPhone = page.locator('input[type="tel"]');
    const checkoutName = page.getByPlaceholder(/enter (your|learner) name/i);
    const checkoutAddress = page.getByPlaceholder(/enter (your delivery|learner) address/i);
    const continueButton = page.getByRole('button', { name: /continue to (delivery|payment)/i });

    console.log('\n3a) Negative customer-detail validations');
    await checkoutName.fill('Test User');
    await checkoutAddress.fill('House 10, Road 5, Dhanmondi, Dhaka');
    await replaceValue(checkoutPhone, '123');
    await continueButton.click();
    await page.waitForTimeout(700);
    check(await continueButton.isVisible().catch(() => false), 'Invalid short phone is rejected');
    await returnToContactStep(page, continueButton);

    await enterValidCheckoutPhone(page, checkoutPhone, CHECKOUT_PHONE);
    await checkoutName.fill('Ab');
    await continueButton.click();
    await page.waitForTimeout(700);
    check(await continueButton.isVisible().catch(() => false), 'Name shorter than 4 characters is rejected');
    await returnToContactStep(page, continueButton);

    await checkoutName.fill('Test User');
    await checkoutAddress.fill('');
    await continueButton.click();
    await page.waitForTimeout(700);
    check(await continueButton.isVisible().catch(() => false), 'Empty delivery address is rejected');
    await returnToContactStep(page, continueButton);

    console.log('\n3b) Positive customer-detail validations');
    await enterValidCheckoutPhone(page, checkoutPhone, CHECKOUT_PHONE);
    await checkoutName.fill('Test User');
    await checkoutAddress.fill('House 10, Road 5, Dhanmondi, Dhaka');
    await checkoutAddress.blur();
    validate((await checkoutName.inputValue()) === 'Test User', 'Customer name validation passed');
    validate((await checkoutAddress.inputValue()) === 'House 10, Road 5, Dhanmondi, Dhaka', 'Delivery address validation passed');

    await continueButton.click();
    const insideDhaka = page.getByRole('button', { name: /inside dhaka/i });
    await insideDhaka.waitFor({ state: 'visible' });
    pass('Contact details accepted and checkout advanced');
    await insideDhaka.click();
    pass('Inside Dhaka delivery selected');

    const cod = page.getByRole('button', { name: /cash on delivery/i });
    await cod.waitFor({ state: 'visible' });
    await cod.click();
    pass('Cash on Delivery selected');

    const placeOrder = page.getByRole('button', { name: /place order/i });
    await placeOrder.waitFor({ state: 'visible' });
    const terms = page.getByRole('checkbox', { name: /terms and conditions/i });
    if (await terms.isVisible().catch(() => false)) {
      if (await terms.isChecked()) await terms.uncheck();
      check(!(await placeOrder.isEnabled()), 'Unchecked terms keep Place order disabled');
      await terms.check();
      validate(await terms.isChecked(), 'Terms and conditions accepted');
    } else {
      skip('Terms checkbox is not present in this checkout layout');
    }

    validate(await placeOrder.isEnabled(), 'Place order button is enabled');

    if (!FULL_FLOW) {
      await page.screenshot({ path: path.join(TEST_RESULTS, 'checkout-validation.png'), fullPage: true });
      pass('Validation-only run stopped before creating a real order');
      skip('Order success and admin confirmation validations require --full');
      return;
    }

    console.log('\n4) Place order and validate success');
    await placeOrder.click();
    await page.waitForURL(/\/checkout\/success\//);
    await page.getByText(/order successful/i).waitFor({ state: 'visible' });
    pass('Storefront displayed Order successful');
    const successText = await page.locator('body').innerText();
    const orderMatch = successText.match(/Order ID:\s*#?\s*([A-Z0-9]+)/i);
    validate(Boolean(orderMatch), 'Storefront order ID is present');
    const storefrontOrderId = orderMatch[1].toUpperCase();
    console.log(`Created order: ${storefrontOrderId}`);

    console.log('\n5) Admin login and latest-order match');
    await page.goto(admin);
    await page.waitForTimeout(2000);
    await typeAfterHydration(page.getByPlaceholder('Enter phone'), requireCredential(ADMIN_PHONE, 'ADMIN_PHONE'));
    await page.getByRole('button', { name: /continue/i }).click();
    const adminPassword = page.locator('input[type="password"]');
    await adminPassword.waitFor({ state: 'visible' });
    pass('Admin phone step advanced to password');
    await adminPassword.fill(requireCredential(ADMIN_PASSWORD, 'ADMIN_PASSWORD'));
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/admin\/order\//);
    pass('Admin login succeeded');

    const orderAction = page.locator("button[aria-label*='Order actions']").first();
    await orderAction.waitFor({ state: 'visible' });
    await orderAction.click();
    await page.getByText('Open order', { exact: true }).click();
    await page.waitForURL(/\/admin\/order\/\?ref=/);
    const adminOrderId = new URL(page.url()).searchParams.get('ref')?.toUpperCase();
    validate(adminOrderId === storefrontOrderId, 'Admin first/latest order matches the storefront order', `${adminOrderId} !== ${storefrontOrderId}`);

    console.log('\n6) Confirm order in admin');
    await page.getByRole('button', { name: /^confirmed$/i }).click();
    const statusDialog = page.getByRole('dialog');
    let confirmationVerified = false;
    const dialogOpened = await statusDialog.waitFor({ state: 'visible', timeout: 4000 })
      .then(() => true)
      .catch(() => false);

    if (dialogOpened) {
      pass('Update status dialog opened');
      const note = statusDialog.locator('textarea');
      if (await note.isVisible().catch(() => false)) {
        await note.fill('Customer and order details are confirmed.');
        validate((await note.inputValue()).length >= 10, 'Confirmation note validation passed');
      }
      await statusDialog.getByRole('button', { name: /^confirm order$/i }).click();
      await statusDialog.waitFor({ state: 'hidden' });
      pass('Confirm order action completed');
      confirmationVerified = true;
    } else {
      const existingNote = page.getByText(/customer and order details are confirmed\./i).first();
      validate(await existingNote.isVisible().catch(() => false), 'Order was already confirmed in admin');
      confirmationVerified = true;
    }

    await page.waitForTimeout(1500);
    const finalAdminText = await page.locator('body').innerText();
    validate(confirmationVerified && /\bconfirmed\b/i.test(finalAdminText), 'Final CONFIRMED status is verified');
    await page.screenshot({ path: path.join(TEST_RESULTS, 'checkout-flow-final.png'), fullPage: true });
    pass(`Full E2E flow completed for order ${storefrontOrderId}`);
  } catch (error) {
    console.error(`\n${error.message}`);
    if (!results.some((result) => result.status === 'FAIL')) {
      results.push({ status: 'FAIL', category: 'RUNTIME', message: error.message });
    }
    await page.screenshot({ path: path.join(TEST_RESULTS, 'checkout-flow-failure.png'), fullPage: true }).catch(() => {});
    console.error('Failure screenshot: test-results/checkout-flow-failure.png');
    process.exitCode = 1;
  } finally {
    console.log('\nValidation summary');
    for (const result of results) console.log(`${result.status.padEnd(4)} | ${result.category.padEnd(8)} | ${result.message}`);
    const count = (status, category) => results.filter((result) => result.status === status && (!category || result.category === category)).length;
    console.log(`TOTAL    | PASS=${count('PASS')} FAIL=${count('FAIL')} SKIP=${count('SKIP')}`);
    console.log(`POSITIVE | PASS=${count('PASS', 'POSITIVE')} FAIL=${count('FAIL', 'POSITIVE')} SKIP=${count('SKIP', 'POSITIVE')}`);
    console.log(`NEGATIVE | PASS=${count('PASS', 'NEGATIVE')} FAIL=${count('FAIL', 'NEGATIVE')} SKIP=${count('SKIP', 'NEGATIVE')}`);
    if (count('FAIL') > 0) process.exitCode = 1;
    await browser.close();
  }
})();
