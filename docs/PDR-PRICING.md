# PDR dent and crease pricing (Phase 2.2)

This guide explains, in plain terms, how paintless dent repair prices work and how management edits them.

## Who can do what

| Action | Who |
|---|---|
| View prices (Pricing Matrix page) | Anyone with pricing access: owner, administrator, manager, advisor, accountant, auditor |
| Edit prices, ranges, adjustments, vehicle categories and the approval threshold ("Manage pricing") | Owner, administrator, manager |
| Approve a package priced below its calculated total ("Approve package prices") | Owner, administrator, manager |
| Price dents, enter override prices and create packages on an estimate | Anyone who can edit estimates |

Every change is saved in the audit history with who made it and when.

## Where to edit

Go to **Pricing Matrix → PDR Dent & Crease**. The page has seven numbered sections:

1. **Vehicle categories:** Sedan and SUV/Truck to start. Each estimate diagram body style (Sedan, SUV, Pickup) is priced by exactly one category. You can rename a category, add a new one (for example "Full-size truck"), and choose which body styles it prices. Assigning a body style to a category moves it from its old one.
2. **Standard dent prices:** the price of one dent, by size and vehicle category. These are the prices the CRM already had.
3. **Length ranges:** for example 1"–6", 7"–12". Whole inches from 1 to 36. Ranges cannot overlap. They are used for crease prices and for optional length adjustments on standard dents.
4. **Crease prices:** length range × severity (Shallow, Medium, Deep), for each vehicle category. **These start empty. No amounts are filled in for you.**
5. **Crease adjustments (optional):** by location difficulty and by panel.
6. **Standard dent adjustments (optional):** by severity, location difficulty, length range and panel. All blank to start, so standard prices are unchanged.
7. **Package price approval:** the threshold described below.

Type a price in a cell and press Enter, or click elsewhere, to save it. **Clearing a cell means "not priced".**

## How a dent's suggested price is calculated

> **Suggested price = base price + dollar adjustments + percentage adjustments**

- The **base price** is the standard dent price for that size, or the crease price for that length range and severity, for the vehicle's category.
- Each **percentage** is a percent of the base price.
- Adjustments only apply to the dents they match. A blank adjustment means none.

**Example:**
- A 4" deep crease on a sedan hood, in a difficult location.
- Base price: $200 (crease 1"–6", Deep, Sedan).
- Adjustments: +10% for a difficult location, and +$25 for the hood.
- Suggested price: $200 + $20 + $25 = **$245**.

**Pricing incomplete:** if a needed price is missing (no crease range covers the length, a blank cell, or a glass or plastic panel), the dent shows **"Pricing incomplete"**. It is **never treated as $0**. The estimator enters a price for that dent.

## Estimates keep their prices

- Each dent saves the price calculated when it was priced.
- **Changing the matrix never changes an estimate that was already priced.** On an estimate, **"Reprice from current matrix"** applies the current prices to dents that are not yet billed. That action is recorded in the audit history.
- Lines already on an estimate, and invoices, never change.
- **Overrides:** an estimator can enter a different price for a dent. The CRM records the calculated price at that moment, the final price, who changed it, when, and why. A reason is required whenever a calculated price existed.

## Billing methods

On the estimate, section 3, **Dent pricing and billing**:

**Billing a dent individually**
- One separately priced line per dent.

**Packages: panel or whole vehicle**
- One line at a price the estimator types in.
- The screen shows the calculated total (the sum of the dents' own prices), the package price, and the dollar and percentage difference.
- If any dent's price is missing, it shows "Pricing incomplete".

**Rules for both**
- Every dent keeps its own record and price, and is billed in exactly one place.
- Moving dents between methods never loses data or charges twice:
  - Removing a package or a line returns its dents to "Not yet billed", with their prices kept.
  - Moving individually billed dents into a package removes their individual lines in the same step.
- Nothing is discounted automatically.

## Package approval

A package priced **below** its calculated total needs approval from an owner, administrator or manager.

**What it blocks until approved:** sending the estimate, marking it approved, starting production, or converting it to an invoice.

**How approval works**
- Approval is for the exact price shown. **If the package price changes, a new approval is needed.**
- The CRM records who approved and when.

**Threshold**
- **Not set (the default):** every reduction below the calculated total needs approval.
- **Set:** only reductions larger than that percentage need approval.
- Packages with incomplete pricing always need approval.

## What customers see

Printed estimates and invoices follow the billing method: one line per dent, one line per panel package, or one line for a whole-vehicle package.

**"Show dent details to customer"**
- A switch on each estimate, off by default.
- When on, it lists each dent's panel, size, length and severity under its line. The amount billed is unchanged.
- Invoices keep the details as they were when the invoice was issued.

**Never shown to customers:**
- the "Paint damage correctable?" answer
- estimator notes
- calculated prices, overrides and override reasons
- package comparisons
- internal costs
