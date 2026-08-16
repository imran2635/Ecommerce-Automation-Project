# Ecommerce Automation Project

Playwright automation for the Imran Fashion storefront checkout and admin order-confirmation flow.

## Flow Demo Video

▶️ **[Watch the complete client-site and admin-panel automation flow](https://drive.google.com/file/d/1xP0GqjqgGh_JcEbiA2bXSHGace1EyGNr/view?usp=sharing)**

The video demonstrates the storefront checkout journey, validation cases, Cash on Delivery order placement, and final order confirmation from the admin panel.

## Project structure

- `downloads/` — browser downloads created by tests
- `test-results/` — success, validation, and failure screenshots
- `tests/checkout-flow.js` — checkout validation and full E2E flow
- `tests/confirm-latest-order.js` — admin-only recovery/confirmation flow
- `FLOW-DOCUMENTATION.md` — detailed test sequence and expected validations
- `playwright.config.js` — shared Playwright paths and runtime defaults

## Commands

Set credentials in the current PowerShell session before running tests:

```powershell
$env:STOREFRONT_PHONE="your-storefront-phone"
$env:STOREFRONT_PASSWORD="your-storefront-password"
$env:ADMIN_PHONE="your-admin-phone"
$env:ADMIN_PASSWORD="your-admin-password"
$env:CHECKOUT_PHONE="1700000000"
```

Never commit real credentials. `.env` files are ignored by Git.

```powershell
npm.cmd test
```

Runs safely through checkout validation and stops before placing an order.

```powershell
npm.cmd run test:full
```

Creates a real Cash on Delivery order and confirms the matching latest order in admin.

```powershell
npm.cmd run confirm:latest
```

Opens and confirms only the latest existing admin order.

> `test:full` has real external side effects. Run it only when a new COD order is intended.
