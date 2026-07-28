# Invoice Calculation Review

## Scope

This review covers exact-cent invoice math, session finalization rollups, split allocation rules, and backend PDF generation verified on **Tuesday, July 28, 2026**.

The automated backend tests run against a fixed application clock of **January 15, 2026**, so invoice numbers and dated fixtures below use that test date intentionally.

## Verified Coverage

Targeted test run:

```bash
php artisan test \
  tests/Feature/Finance/InvoiceManagementApiTest.php \
  tests/Feature/Finance/SessionInvoiceFinalizationTest.php \
  tests/Feature/Finance/InvoicePdfDownloadTest.php \
  tests/Feature/InvoiceSplitApiTest.php \
  tests/Feature/OrderWorkflowTest.php \
  tests/Feature/TableSessionSecurityTest.php \
  tests/Unit/OrderInvoiceCalculatorTest.php \
  tests/Unit/InvoiceSplitServiceTest.php
```

Result: **64 passed, 1595 assertions**

Covered behaviors:

- Manual invoice creation from one order-equivalent payload and multi-line payloads.
- Exact subtotal, discount, taxable subtotal, service charge, VAT, total, currency, and exchange-rate persistence.
- Server-side recalculation on manual invoice update, ignoring client-side total tampering.
- Empty manual invoice rejection.
- Sequential invoice-number generation.
- Invoice status and paid timestamp handling.
- Cross-tenant invoice read/update/download isolation.
- Session finalization from one accounted order and multiple accounted orders.
- Repeated finalization reuse for already-invoiced accounted orders.
- Unpaid orders excluded from session invoice finalization.
- Cancelled items preserved with zero line totals.
- Equal split remainder handling.
- Selected-item split with mixed quantities, more people than assigned items, duplicate-assignment rejection, and unassigned remainder tracking.
- Property-style split invariants proving allocated totals exactly equal the source invoice totals.
- PDF generation for standard invoices and split invoices.
- PDF download authorization, invalid invoice ID handling, tenant-scoped storage, and forced generation failure handling.
- Arabic, English, and mixed-language PDF text extraction checks.
- Large invoice PDF rendering and long restaurant-name rendering.

## Verified Calculation Examples

### Manual invoice rounding

Input:

- `1.125 x 3.33`
- `2 x 2.50`

Verified result:

- first line: `3.75`
- second line: `5.00`
- subtotal: `8.75`
- total: `8.75`

### Manual invoice with discount, service charge, VAT, and exchange rate

Input:

- subtotal: `23.75`
- discount: `12.50%`
- service charge: `5.50%`
- VAT: `10.00%`
- currency: `EUR`
- exchange rate: `1.2345`

Verified result:

- discount amount: `2.97`
- taxable subtotal: `20.78`
- service charge: `1.14`
- VAT: `2.08`
- total: `24.00`

### Session finalization with service charge and VAT

Input:

- subtotal: `40.00`
- discount: fixed `2.50`
- taxable subtotal: `37.50`
- service charge: `10.00%`
- VAT: `5.00%`

Verified result:

- service charge: `3.75`
- VAT: `1.88`
- total: `43.13`
- stored currency: `LBP`
- stored exchange rate: `89500.7500`

### Equal split remainder

Input:

- invoice total: `10.00`
- split count: `3`

Verified result:

- person 1: `3.34`
- person 2: `3.33`
- person 3: `3.33`
- split sum: `10.00`

### Selected-item split conservation with discount, service charge, and VAT

Input:

- subtotal: `25.00`
- discount amount: `2.00`
- taxable subtotal: `23.00`
- service charge amount: `2.30`
- VAT amount: `1.15`

Verified allocation:

- person 1 total: `10.58`
- person 2 total: `15.87`
- allocated subtotal sum: `25.00`
- allocated discount sum: `2.00`
- allocated service charge sum: `2.30`
- allocated VAT sum: `1.15`
- allocated total sum: `26.45`

### PDF verification

Verified through generated PDFs plus `pdftotext` extraction:

- standard invoice content includes long restaurant names and mixed Arabic/English item names
- split invoice content includes split summary rows and person labels
- generated files are stored under `invoices/{restaurant_id}/...`

## Remaining Risks

These remain worth tracking after the current implementation:

- **True simultaneous split writes are not stress-tested.** The suite covers repeated requests and invariant preservation, but it does not spin up parallel writers to prove race behavior under real concurrency.
- **PDF generation depends on headless Chrome plus `pdftotext` being present on the host.** Functional coverage exists in this environment, but deployment environments need the same binaries installed.
- **PDF text extraction is browser-version sensitive.** The suite validates extracted content, but exact line wrapping and glyph ordering can vary slightly across Chrome builds.

## Implementation Notes

Invoice-critical paths now use explicit minor-unit arithmetic instead of float-sum assumptions for:

- manual invoice item normalization
- order accounting calculations
- session finalization invoice rollups
- split allocation math
- PDF summary rendering inputs

The backend now persists:

- `discount_type`
- `discount_value`
- `discount_amount`
- `taxable_subtotal`
- `service_charge_rate`
- `service_charge_amount`
- `vat_rate`
- `vat_amount`
- `currency`
- `exchange_rate`
- `payment_method`
- `payment_reference`
- generated PDF storage metadata

## Conclusion

The invoice, split, and PDF surfaces requested in this review are implemented and covered by the targeted regression suite with exact-decimal expectations.
