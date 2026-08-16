# Checkout Flow Documentation

## Project resource

- [Google Drive documentation and evidence](https://drive.google.com/file/d/1xP0GqjqgGh_JcEbiA2bXSHGace1EyGNr/view?usp=sharing)

## Run commands

Open PowerShell and go to the project directory:

```powershell
cd "E:\Ecommerce Project Automation\Ecommerce Project"
```

### Safe validation-only run

```powershell
npm.cmd test
```

This runs valid and invalid checkout validations and stops before clicking **Place order**.

### Full E2E run

```powershell
npm.cmd run test:full
```

This can create a real Cash on Delivery order and then verify or confirm the matching latest order in admin.

### Admin-only latest-order confirmation

```powershell
npm.cmd run confirm:latest
```

This skips storefront checkout and opens the latest existing admin order for confirmation.

## Validation-only flow

1. Open the storefront login page.
2. Enter the storefront phone and password.
3. Validate successful login.
4. Open the Air pods product details page.
5. Validate and click **Add to cart**.
6. Validate and click **Go to cart**.
7. Validate that checkout opened.
8. Submit invalid phone `123` and validate that checkout remains on the customer-details step.
9. Submit short name `Ab` and validate that checkout remains on the customer-details step.
10. Submit an empty address and validate that checkout remains on the customer-details step.
11. Enter valid phone `1700000000`.
12. Enter valid name `Test User`.
13. Enter valid address `House 10, Road 5, Dhanmondi, Dhaka`.
14. Validate all valid customer fields.
15. Click **Continue to delivery/payment**.
16. Select **Inside Dhaka**.
17. Select **Cash on Delivery**.
18. Validate that unchecked **Terms and conditions** keeps **Place order** disabled.
19. Accept **Terms and conditions**.
20. Validate that **Place order** becomes enabled.
21. Stop before creating an order and save `test-results/checkout-validation.png`.

## Test-case matrix

| Type | Case | Input/state | Expected result | Latest result |
|---|---|---|---|---|
| Negative | Invalid phone | `123` | Continue is blocked | PASS |
| Negative | Short name | `Ab` | Continue is blocked | FAIL — checkout advanced |
| Negative | Missing address | Empty | Continue is blocked | PASS |
| Negative | Terms not accepted | Checkbox unchecked | Place order is disabled | FAIL — button remained enabled |
| Positive | Valid phone | `1700000000` | Contact validation passes | PASS |
| Positive | Valid phone error state | `1700000000` after invalid input | No phone/contact error remains visible | PASS |
| Positive | Valid name | `Test User` | Name validation passes | PASS |
| Positive | Valid address | `House 10, Road 5, Dhanmondi, Dhaka` | Address validation passes | PASS |
| Positive | Valid delivery | Inside Dhaka | Delivery selection passes | PASS |
| Positive | Valid payment | Cash on Delivery | Payment selection passes | PASS |
| Positive | Valid terms | Checkbox checked | Place order is enabled | PASS |
| Positive | Successful order | Full mode | Order-success page and Order ID appear | PASS — `PB0X` |
| Positive | Admin order match | Storefront ID = latest admin ID | Correct order opens | PASS |
| Positive | Admin confirmation | Pending or already Confirmed | Final Confirmed state is verified | PASS |

## Full E2E additions

1. Click **Place order**.
2. Validate **Order successful** and capture the storefront Order ID.
3. Log in to the admin order page.
4. Open the first/latest order.
5. Validate that the admin Order ID matches the storefront Order ID.
6. Click **Confirmed**.
7. Enter a confirmation note and click **Confirm order**.
8. If already confirmed, validate the existing confirmation state idempotently.
9. Validate the final **CONFIRMED** status.
10. Save `test-results/checkout-flow-final.png`.

On failure, the test writes `test-results/checkout-flow-failure.png` and prints a `PASS`, `FAIL`, and `SKIP` summary.

## Latest execution result

| Item | Result |
|---|---|
| Date | 2026-08-16 |
| Mode | Full E2E with positive and negative validation cases |
| Order ID | `PB0X` |
| Full checkout | Completed |
| Admin confirmation | Completed |
| Process exit code | `1` — caused by detected negative-validation failures |

### Test summary

| Category | Pass | Fail | Skip | Total |
|---|---:|---:|---:|---:|
| Positive | 25 | 0 | 0 | 25 |
| Negative | 2 | 2 | 0 | 4 |
| **Overall** | **27** | **2** | **0** | **29** |

### Defects detected

| # | Validation defect | Actual behavior | Status |
|---:|---|---|---|
| 1 | Short-name validation | `Ab` was accepted and checkout advanced | FAIL |
| 2 | Terms acceptance validation | **Place order** remained enabled while Terms was unchecked | FAIL |

### Latest valid-phone recheck

| Item | Result |
|---|---|
| Mode | Safe validation-only run |
| Valid phone | `1700000000` |
| E.164-normalized value | Accepted |
| Visible phone/contact error | None |
| Valid-phone checks | **2 PASS, 0 FAIL** |
| Complete safe-run counts | **21 PASS, 2 FAIL, 1 SKIP** |
| Order created | No |

The two safe-run failures are the existing short-name and unchecked-terms defects; they are unrelated to valid-phone handling.
