# Hail estimating: what data it uses and how reliable it is

**Status (Phase 2.1, 2026-10-10):** the hail estimator is **not production-ready for pricing**. Phase 2.1 does not change it. Hail pricing, the hail screen and all saved hail estimates are exactly as before. This document records what the hail estimator actually uses, so a later pricing review can decide what to keep, replace or approve. It is not a pricing approval. Per PRICE-01 (owner decision 2026-10-06), **all existing pricing is unverified and not approved for production use**.

## What a hail estimate uses today

A Hail estimate (`serviceType = "hail"`) opens the **Carrier hail estimate** screen (`client/src/components/hail-estimator.tsx`). It prices one panel at a time:

1. The estimator picks an **insurance company**, a **panel**, the **regular dent count** and the **majority dent size** (dime, nickel, quarter, half dollar).
2. `priceHailPanel()` in `shared/hail-reference.ts` looks up a rate and builds the estimate lines. Each line records the carrier and source revision in its description (`[HAIL-CARRIER:…]`).
3. Upcharges, oversized dents, glue-pull, R&I and other adjustments become separate lines. Each requires a remark. Only the published State Farm $50 oversized rate is filled in automatically; every other adjustment needs an entered amount.

Hail work is entered **per panel (dent count and majority size), not dent by dent**. The individual dent records added in Phase 2.1 apply to Paintless Dent Repair estimates only.

## Data sources, in order of reliability

| Source | Where it lives | Used for automatic hail prices? | Reliability |
|---|---|---|---|
| **State Farm PDR Pricing Matrix**, revision `125278.13`, dated 2025-04-29, retrieved 2026-09-27 | Code constant `HAIL_REFERENCE_ROWS` in `shared/hail-reference.ts` (transcribed cells, plus "MCE" cells and rules text in `HAIL_RULES`) | **Yes, the only automatic source**, and only when the carrier is State Farm | Transcribed from the carrier-hosted PDF for the **State Farm PDR agreement**. It applies only if the shop is under that agreement and the claim falls under it. It is about 18 months old by revision date and may have been superseded. Re-check the current revision before relying on it. Not a payment guarantee. |
| **Other carriers** (Allstate, Farmers, GEICO, Liberty Mutual/Safeco, Nationwide, Progressive, Travelers, USAA) | Database rows, `pricing_matrices.matrix_type = 'hail_insurance'`, loaded once by the reference catalog into a brand-new database | **No.** For these carriers the hail screen requires a documented manual panel amount. | Legacy seeded data with no recorded source document, revision or date. The Pricing Matrix page labels it "unverified; not used for automatic carrier quoting". It may be incomplete or stale. |
| **State Farm database rows** (`hail_insurance`, State Farm) | Same seeded table | No (the code constant above is used instead) | Older seeded copy; superseded by the code constant. Kept for history only. |
| **Generic hail matrix** (`pdr_hail`: Hood, Roof, Door, Fender; sedan/SUV, size "multiple") | Seeded `pricing_matrices` rows | Only as an **auto-fill suggestion** when someone types a manual `pdr_hail` line in the line editor | Sample shop prices with no source. Not carrier rates. Treat as placeholders. |

### Where each source appears in the app

- **Hail estimate screen:** State Farm code constant only. Every other carrier requires a manual amount.
- **Manual line editor** (Add repair on a hail estimate): may pre-fill a price from the generic `pdr_hail` rows. The estimator can change it.
- **Pricing Matrix page:** shows all of the above. The legacy insurer rows are labeled unverified. The page reports how many State Farm source cells there are.
- **Printed estimate:** shows the saved lines only. It never re-reads a matrix.

## Known limitations

- **Published range.** Counts above the published range (more than 50 dents for most panels; more than 250 on hood, roof and deck lid) and "MCE" (most cost effective) cells have no automatic price; a negotiated amount must be entered. The app never treats a missing cell as $0 and never reuses a lower bracket.
- **Panel mapping.** Liftgate, tailgate, bed sides and "other" panels have no verified mapping and require a manual amount.
- **No live link to carriers.** The app does not retrieve carrier documents automatically. If the State Farm link fails, the saved transcription is shown instead.
- **R&I.** R&I on hail is a manual amount today. The shared R&I catalog (Phase 2.3/2.4) is planned to serve hail as well as PDR.
- **Old estimates.** Existing estimates keep the prices they were saved with. Nothing is repriced silently.

## Before hail pricing can be approved for production

1. Confirm which carrier agreements the shop actually holds. Obtain each **current** matrix document and record its revision and date.
2. Decide whether the seeded legacy insurer rows should be retired, replaced with documented current matrices, or kept as history only.
3. Decide whether the generic `pdr_hail` rows should be replaced with approved shop prices or removed.
4. Re-run `hail-reference-test.ts` and the calculation checks after any change, and record the approval in KNOWN-ISSUES (PRICE-01).
