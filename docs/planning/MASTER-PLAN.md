# CRM-RepairPro: Master Development Plan

**Status: approved for the repository 2026-10-20. A living plan, updated as phases are approved and merged.**

This plan uses three sources:
- the Word document "CRM notes for changes on RepairPro October 2026"
- the owner's planning message of 2026-10-16
- a review of the actual code and database on PR #5's latest commit (259c20d)

It goes with three other files:

| File | Contents |
|---|---|
| `REQUIREMENTS-REGISTER.md` | Every request, with an ID and status |
| `MANAGEMENT-DECISIONS.md` | Questions for you, in the order they are needed |
| This file | Summary, roadmap, pull request plan, data audit, testing strategy, missing references |

---

## 1. Executive summary (Deliverable 1)

### Where RepairPro stands

RepairPro already has a broad set of features:
- customers and vehicles
- estimates for every service, with line items, tax and approvals
- work orders, production tracking and scheduling
- invoices, payments, and accounts receivable aging
- a report builder, roles and permissions, and audit history
- backups, and a private Codespaces demo

The last four phases made it **safer and more dependable**:
- **Phase 0 and Phase 1:** setup, security and permissions.
- **Phase 2.1:** saved individual dents, and fixes to the New Estimate customer and vehicle workflow.
- **Phase 2.2 (PR #5, waiting for your test):** a dent and crease price list management can edit, per-dent pricing, package pricing with manager approval, and clear messages when the demo loses its server.

### What is not finished

- **Everyday data entry has rough edges:**
  - zeros in price boxes
  - service writers can't be chosen as salespeople
  - searches start at 2 characters in some places and are missing in others
- **Only the PDR price list can be edited.** Window tint, interior, upholstery, labor rates and materials are read-only sample prices that were never verified.
- **R&I (removal and reinstallation)** doesn't exist yet beyond a hand-typed line.
- **Hail pricing** is automatic only for State Farm, using a 2025 document that may be out of date.
- **Upholstery** has no yardage or labor calculator. The diagrams for booths and medical, dental, chiropractic and massage tables don't exist, and the furniture style list is short.
- **The dashboard** shows simple counts. Much of the information the dashboard specification needs isn't collected yet:
  - technician hours worked
  - leads and walk-ins
  - dealer visits
  - customer segments
  - lost-sale reasons
  - targets
- **Marketing** is mostly a placeholder. Campaigns can't be created, and nothing sends.
- **Tax:** the document's tax requests partly match the CRM and partly conflict with it. They must wait for the accountant.
- **Before going live** (already on the backlog): an independent security review, refunds and credit notes, QuickBooks, a 40-user load test, and hosting.

### Several problems in the document come from one cause

These items describe what happened when the Codespaces demo lost contact with its server, or ran an outdated version:
- "Failed to fetch" on Scheduling
- "Catalog request failed (404)"
- "0 stored entries across 0 categories" with every price at $0.00
- "Could not create the customer" with no reason

PR #5 already fixes how RepairPro reacts:
- plain-English messages instead of empty screens
- a version label in the sidebar
- automatic restart of an outdated demo server

Your retest of PR #5 will confirm this. Two real defects remain on top of that, and both are planned:
- empty price cells show "$0.00" instead of "Not priced"
- most price tables cannot be edited

### Remaining priorities, in order

1. **Finish Phase 2.2** (your test of PR #5).
2. **Fix everyday data entry and search** (A1, A2).
3. **Make every price list editable by management** (B1), then audit hail (B2).
4. **Start collecting the information the dashboard will need** (E1), so history builds up while other work continues.
5. **Build R&I** (B3, B4).
6. **Tax changes** once the accountant answers (G1). Ask now.
7. **Scheduling and technician time tracking** (D1, D2), then **the dashboard** (E2, E3).
8. **Upholstery and furniture** (C1 to C3), once you provide the style list and the finished yardage guide.
9. **Marketing** (F1, F2), after a security and email deliverability review.

---

## 2. What the Word document contains

The document has 43 pages as laid out by Word (the file properties say 40). It contains 6 pictures, 3 embedded data listings and 2 specifications. Page numbers are approximate.

| Pages | Content | Register IDs |
|---|---|---|
| 1 | Tax on parts and shipping, not labor; use-tax option; salesperson; Add Line Item zeros | TAX-001–005, CRM-001, CRM-002 |
| 2–3 | New customer error with no explanation | CRM-003, CRM-004 |
| 4–10 | Upholstery yardage system: design discussion, defaults, labor, management-only rates, developer specification and acceptance tests | UPH-001–012, UPH-015 |
| 10–17 | Yardage reference data: 26 styles, all unverified | UPH-013, FURN-002 |
| 18 | Search after 3 characters, everywhere | CRM-005–007 |
| 19 | Scheduling page "Failed to fetch"; empty week | SCHED-001, DASH-001 |
| 20–26 | Operations Dashboard specification (13 sections) | DASH-002–014 |
| 28–41 | Upholstery component splat charts: 5 product photos and component data (30 components) | UPH-014 |
| 42 | Pricing catalog 404; matrices empty and not editable | PRC-001–003 |
| 43 | More furniture and booth styles (list cut off; one chart picture) | FURN-001 |

**Not in the Word document:** R&I, hail matrix verification, marketing and most scheduling items. These come from your planning message and are registered with source "OWNER".

---

## 3. Development roadmap (Deliverable 3)

Each step is one pull request, tested by you in Codespaces and merged only with your approval. Each new branch starts from the latest approved `main`.

| # | PR | Section | Size | Main reason for its position |
|---|---|---|---|---|
| 0 | **PR #5: Phase 2.2 PDR pricing** (open) | B | — | Already built. Everything in pricing builds on it. |
| 1 | **A1: Core data-entry fixes and screen-health safeguards** | A | Medium | Daily annoyances, low risk. Its automatic screen checks protect every later PR. |
| 1b | **B0: PDR panel details and customer expectations** (roof rails, factory paint or repaint, aluminum or steel, expected % of factory condition), added 2026-10-20 | B | Medium | Builds directly on Phase 2.2's dent records and price adjustments, and affects estimate accuracy every day. |
| 2 | **A2: Shared 3-character search and the customer file** (also: edit the customer from inside the estimate, full contact details in the estimate header, address, salesperson and technicians on the work order list) | A | Medium–Large | Used on every screen; R&I, scheduling and the dashboard all rely on finding records quickly. |
| 3 | **B1: Editable pricing for all services** | B | Medium | Directly answers DOC p.42. R&I and upholstery need editable labor rates and materials first. |
| 3b | **A3: Line items and job costs redesign** (what we charge the customer, kept separate from job costs), added 2026-10-20 | A | Medium | Same form as tax. Done before G1 with the tax rules unchanged, so G1 only changes the rules. |
| 3c | **D0: Team profiles** (salespeople and technicians: skills, commission and pay types recorded, jobs they are on, several technicians per job), added 2026-10-20 | D | Medium | Needed by the dispatcher board (skills) and the dashboard (attribution). |
| 4 | **B2: Hail audit and pricing sources** | B | Small–Medium | Mostly testing and source records. Must come before R&I is connected to hail. |
| 5 | **E1: Start collecting dashboard data** | E | Medium | Small and low risk. Every month without segments, lead sources and lost reasons is a month of missing dashboard history. |
| 6 | **B3: R&I catalog, rates and safety checks** | B | Large | The R&I data and rules, before linking them to estimates. |
| 7 | **B4: R&I on estimates, without double charges, including hail** | B | Medium–Large | Builds on B3, the PR #5 package rules and B2's hail review. |
| — | **G1: Tax treatment** | G | Medium | **Placed whenever the accountant answers.** Kept separate so a tax change is never mixed with other work. |
| 7b | **A4: Several services on one estimate** (interior, exterior, upholstery, furniture), added 2026-10-20 | A | Large | Changes how departments and tax are recorded per line, so it needs the department decision (M-20) first. |
| 8 | **D1: Dispatcher scheduling board** (30+ technicians, 60 jobs a day, drag and drop, conflicts open the calendar, sort by technician, area and skill) | D | Large (likely split in two) | Needs B4, so approved R&I tasks flow into work orders. One scheduler instead of two. |
| 9 | **D2: Technician time tracking** | D | Medium–Large | Gives "hours sold vs worked" its data. Needed for utilization on the dashboard. |
| 10 | **E2: Dashboard foundation and Executive Overview** | E | Large | By now E1 and D2 have collected real data. A mockup is approved before coding (DOC §13). |
| 11 | **E3: Remaining dashboard tabs and alerts** | E | Large (may split in two) | Builds on E2's tested numbers. |
| 12 | **C1: Furniture, booth and medical diagram library** | C | Medium | Can move earlier (after B1) if you want it sooner. Needs your style list (M-28). |
| 13 | **C2: Upholstery pricing matrix and labor recommendations** | C | Medium–Large | Needs C1 and the rates (M-32). **We'll remind you to provide the finished yardage guide at this point.** |
| 14 | **C3: Upholstery yardage calculator** | C | Large | Needs the finished guide (M-30). The cutting-layout logic is the most complex calculation in the plan. |
| 15 | **F1: Leads, follow-ups and referrals** | F | Medium | Builds on E1's lead records. No outside sending. |
| 16 | **F2: Email campaigns** | F | Large | Only after a separate security and deliverability review (M-34). May be deferred. |
| Later | Credits/refunds, QuickBooks, payment portal, dealer portal, load test, security review, hosting | G / launch | — | Already on the backlog. Required before going live. |

### Why this order

- **Reliability before features.** A1's automatic "every screen loads" check means a broken screen is caught before you test, not by you.
- **Shared pieces first.** Search (A2) and editable rates (B1) are reused by R&I, scheduling, upholstery and the dashboard. Building them once avoids rework.
- **Estimating accuracy is the core of the business**, so PDR, hail and R&I come before reporting.
- **Collect data early, report later.** E1 is cheap and starts the history the dashboard needs. A dashboard built on six months of real data is far more useful than one built on an empty database.
- **Waiting on outside information never stops the line:**
  - Tax waits for the accountant.
  - Upholstery waits for the yardage guide.
  - Hail prices wait for carrier documents.
  - Each of these is a separate PR, so the rest continues.
- **Unrelated systems never share a PR.** Upholstery, tax and marketing are always separate.

### Possible changes to the order (your choice)

- **Furniture and booth diagrams sooner:** C1 can move to right after B1. It is independent of R&I.
- **Tax sooner:** G1 starts the moment the accountant answers. It does not depend on the other work.

---

## 4. Proposed pull request plan (Deliverable 4)

Every PR follows your 12-step process: branch from `main` → build → automated tests → browser test (desktop and phone) → PR → Codespaces steps → your test → fixes on the same PR → merge only with approval → check `main` CI.

Every acceptance checklist below **also** includes the standard checks in §7.

### PR A1: Core data-entry fixes and screen-health safeguards
- **Features:**
  - CRM-001: no leading zeros in any number box
  - CRM-002: salesperson eligibility (M-01)
  - CRM-003 / CRM-004: clear field-level messages on every data-entry form
  - PRC-002: "Not priced" instead of $0.00 on every price table
  - QA-001: automatic check that every screen loads
  - QA-002: demo database guard and "DEMO DATA" banner
  - QA-003: demo logins for every role
  - CRM-008 / CRM-009: verify customer and vehicle workflows
  - Any small items from M-03
- **Depends on:** PR #5 merged; M-01, M-02, M-04.
- **Complexity:** Medium.
- **Likely affected:**
  - estimate builder line-item form
  - invoice payment form
  - hail estimator
  - the New Estimate and customer forms
  - employee settings
  - sales-team routes
  - the pricing matrix page
  - `demo.sh`
  - the browser test scripts
- **Risks:**
  - The salesperson change touches sales-credit checks at invoice time. Mitigation: existing invoices' credits must stay the same, verified by a test.
  - The demo database guard must not block real installs. Mitigation: tested both ways.
- **What changes for you:**
  - Prices type normally.
  - Service writers can be chosen as salespeople.
  - Every error tells you what to do.
  - Blank prices say "Not priced".
  - You can sign in as each role to check permissions.
- **Codespaces acceptance checklist:**
  1. Open the demo and confirm the sidebar version matches the PR's latest commit.
  2. Estimate → Add Line Item: type 600 in Customer unit price and 250 in Purchase unit cost. The boxes show "600" and "250" (no leading 0), and the total is $600.00. Save, refresh: still $600.00.
  3. Repeat with the quantity, the invoice payment amount and a hail dent count.
  4. Settings → Employees: tick "Can be credited as a salesperson" on a support-role employee. That employee now appears in the estimate's salesperson list. Untick it: they disappear. An older invoice's sales credits are unchanged.
  5. New Estimate → New customer → Commercial:
     - leave the company blank: the message is next to the field
     - enter a bad email: specific message
     - enter an existing company: duplicate warning with a choice
  6. Simulate a lost connection: run the stop command given in the PR's instructions in the codespace terminal, then try to save. The plain-English connection message appears. Start the demo again with `bash .devcontainer/demo.sh start`.
  7. Pricing Matrix → every tab: blank cells read "Not priced". Print all pricing: the same in print.
  8. Sign in as the demo advisor, technician and accountant. Each sees only their allowed screens.
  9. The red "DEMO DATA" banner is visible on every screen.
  10. Phone: repeat steps 2, 5 and 7.

### PR A2: Shared 3-character search
- **Features:**
  - CRM-005 / CRM-006 / CRM-007: one search with suggestions from 3 characters, in New Estimate, New Work Order, the top bar, and the Customers, Estimates, Invoices, Work Orders/Jobs and Operations lists
  - Search fields: name, company, contact, phone, email, VIN/HIN, plate, year/make/model, street, city, ZIP, customer and document numbers
  - Selecting a vehicle fills both customer and vehicle
  - The customer file shows all linked records
  - MKT-005: verify customer history
- **Depends on:** A1 merged; M-09.
- **Complexity:** Medium.
- **Likely affected:** the customer lookup API and component, list pages, the header search, and the New Estimate dialog.
- **Risks:**
  - Speed with many records. Mitigation: search runs on the server with indexes and a test of 5,000 demo customers.
  - Results must respect permissions. Mitigation: a security test.
- **What changes for you:** start typing 3 letters of anything (name, phone, VIN, city) on any screen and pick the match.
- **Codespaces acceptance checklist:**
  1. New Estimate: type 2 letters of a demo customer (no suggestions), then a 3rd (suggestions appear).
  2. Type the last 6 of a demo VIN: choosing it fills customer **and** vehicle.
  3. Type the first 3 digits of a phone number, then a city name, then an invoice number. Each finds the right record.
  4. Top search bar: choosing a customer opens their file with vehicles, estimates, work orders, invoices and balance.
  5. Estimates, Invoices and Work Orders lists: the search box narrows the list.
  6. Sign in as a technician: search shows only what the technician may see.
  7. Phone: steps 1, 2 and 4.

### PR B1: Editable pricing for all services
- **Features:**
  - PRC-003: management can edit Window Tint, Interior Vinyl, Interior Fabric, Upholstery items, Labor Rates, Materials and Generic Hail
  - Furniture splat list prices move into the database
  - Every change is audited
  - "Unverified sample price" labels (M-12)
  - Estimates keep their prices, with an explicit "reprice" action
  - The print catalog shows the new values
- **Depends on:** PR #5 and A1 merged; M-12.
- **Complexity:** Medium.
- **Likely affected:**
  - pricing matrix page and routes
  - `pricing_matrices` table, with new source and verified fields
  - furniture splat pricing
  - estimate damage-map pricing
  - print catalog
- **Risks:**
  - Changing where furniture splat prices come from could change suggested prices. Mitigation: the migration copies today's values exactly, and a test compares old and new suggestions for every panel.
  - Existing estimates must not change. Mitigation: release-integrity tests.
- **What changes for you:** a manager can change any price on screen, without programming. Estimators see the new price on new estimates.
- **Codespaces acceptance checklist:**
  1. As the demo owner: Pricing Matrix → Window Tint → change one price → save. The audit history shows who, when, the old value and the new value.
  2. A new tint estimate uses the new price. An older tint estimate is unchanged.
  3. Interior Vinyl: clear a cell. It shows "Not priced", and a new estimate asks for a typed price for that item.
  4. Each unverified sample price shows its label until saved or confirmed.
  5. Furniture splat: the suggested prices are the same as before the change. Edit one, and a new furniture estimate uses it.
  6. Print all pricing: shows the edits.
  7. As the demo advisor: the price boxes are read-only, and a direct save attempt is refused.
  8. Refresh and sign in again: the edits are still there.
  9. Phone: steps 1 and 3.

### PR B2: Hail audit and pricing sources
- **Features:**
  - HAIL-001: end-to-end hail tests, with every defect reported first
  - HAIL-002: source fields (document, revision, effective date, checked date, approved by) for every carrier matrix, shown on estimates and in print
  - Retire the legacy carrier rows from the screen (M-18)
  - HAIL-003: the hail reference test runs in CI
- **Depends on:** B1 merged; M-10, M-11, M-18. Can start the audit before M-11 arrives.
- **Complexity:** Small–Medium.
- **Likely affected:** `shared/hail-reference.ts`, the hail estimator, the pricing matrix Insurance Hail tab, hail tests and the hail docs.
- **Risks:**
  - Finding a pricing defect in existing hail estimates. Mitigation: report it before fixing; old estimates are never repriced silently.
- **What changes for you:** every automatic hail price shows its source and date. Carriers without a confirmed document clearly require a typed amount.
- **Codespaces acceptance checklist:**
  1. Write down the expected total for a State Farm hood (count, size) using the carrier document. Build it in the CRM: the totals match, through invoice and print.
  2. The estimate shows "State Farm PDR matrix, revision …, effective …".
  3. A carrier without an approved document asks for a typed amount with a remark.
  4. A count above the published range asks for a typed amount (never $0).
  5. Pricing Matrix → Insurance Hail shows each carrier's source status.

### PR E1: Start collecting dashboard data
- **Features:**
  - Customer segment list (DASH-004, MKT-010)
  - Lead source and referral list (MKT-004)
  - Lead and walk-in records that can become estimates (MKT-006, DASH-007)
  - Lost-sale reasons (DASH-007)
  - Estimate sent, declined and expired dates (DASH-011)
  - Dealer visit log (DASH-008, MKT-009)
  - Department rule per M-20 (DASH-003)
  - Parent accounts (M-27)
  - A first draft of the metric dictionary (DASH-011)
  - Data-completeness counts (for example, "12 customers without a segment")
- **Depends on:** A2 merged; M-20, M-22, M-26a, M-27.
- **Complexity:** Medium.
- **Likely affected:** the customers table and form, estimates, a new leads table, a new visits table, operations follow-ups, and the activities log.
- **Risks:**
  - Changing the customer type from free text to a list. Mitigation: existing values are kept, and anything that doesn't match is shown as "needs a segment" rather than being guessed.
  - Extra data entry for staff. Mitigation: dropdowns and defaults, few required fields.
- **What changes for you:**
  - Staff record where a customer came from, what kind of customer it is, and why a sale was lost.
  - Outside sales logs dealer visits.
  - The dashboard (E2) will have months of real history.
- **Codespaces acceptance checklist:**
  1. Edit a customer: choose a segment and a lead source. The audit history records the change.
  2. Log a walk-in lead, then turn it into an estimate: the estimate shows the lead source.
  3. Decline an estimate: choose a lost reason. The decline date is recorded.
  4. Log a dealer visit with a next follow-up date. It appears on My Work on that date.
  5. A parent account shows its locations.
  6. A data-completeness card lists customers missing a segment.
  7. Old customers keep their old type text, shown as "needs a segment".
  8. Phone: steps 2 and 4.

### PR B3: R&I catalog, rates and safety checks
- **Features:**
  - RNI-001: the parts catalog, with panels and vehicle categories
  - RNI-002: sourced labor times only (M-13)
  - RNI-003: the R&I rate(s) (M-15a), overrides with reasons
  - RNI-006: safety-flagged parts and procedure records (M-15)
  - Management screen and audit
- **Depends on:** B1 merged (B2 recommended); M-13, M-14, M-15, M-15a, M-15b.
- **Complexity:** Large.
- **Likely affected:** new R&I tables and routes, the pricing matrix page, the estimate section 3 panel, the permissions list, and the approval gate.
- **Risks:**
  - Licensing of labor times. Mitigation: only shop or licensed data, with the source recorded on every time.
  - Blocking approval could stop urgent jobs. Mitigation: an authorized "procedure not available" path with a reason.
- **What changes for you:** a consistent R&I price list. Estimators add R&I with one click, and safety checks are recorded.
- **Codespaces acceptance checklist:**
  1. As a manager: add an R&I part (for example, Headliner), link it to the roof panel, give it a time with its source, and set the rate. The audit history records it.
  2. On a PDR estimate: add Headliner R&I. Its price = time × rate. Override it with a reason: the suggested and final prices are both kept.
  3. A safety-flagged part (for example, a curtain-airbag area): approval is blocked until the procedure is recorded, or "not available" with a reason.
  4. As an advisor: the catalog is read-only.
  5. Existing estimates are unchanged.
  6. Phone: step 2.

### PR B4: R&I on estimates, without double charges, including hail
- **Features:**
  - RNI-004: one R&I linked to several dents or panels
  - RNI-005: R&I on hail estimates (replaces the manual line on new estimates; old ones keep theirs)
  - RNI-007: no duplicate R&I charges (database rule)
  - R&I inside packages only when chosen
  - Suggestions shown from damaged panels (nothing added automatically)
- **Depends on:** B3 merged; B2 merged.
- **Complexity:** Medium–Large.
- **Likely affected:** estimate dents, the R&I tables, the dent billing panel, the hail estimator, the print and invoice details, and the approval gate.
- **Risks:**
  - Interaction with PR #5 packages and locks. Mitigation: the PR #5 regression suites plus new double-charge tests.
- **What changes for you:** removing one part that gives access to five dents is charged once, on both PDR and hail estimates.
- **Codespaces acceptance checklist:**
  1. Five roof dents: the panel suggests Headliner R&I. Add it once and link it to all five. One R&I line appears.
  2. Try to add the same R&I again: refused, with an explanation.
  3. Put the roof dents in a package and choose "include R&I". The R&I line shows $0 and the package lists it. Approval rules from PR #5 still apply.
  4. Hail estimate: add Headliner R&I. It prints with its source.
  5. Convert to an invoice: R&I appears exactly once. The totals match hand-calculated values.
  6. Remove the R&I: the dents remain and are unlinked.

### PR G1: Tax treatment (only after written accountant answers)
- **Features:**
  - TAX-001 to TAX-006 per M-05 to M-08a:
    - the fabrication labor rule
    - the shipping rule
    - the "use tax paid by shop" line option with a note, permission and report
    - tax-only changes on work orders before invoicing
    - the Settings default rate connected or removed
  - BL-EST-01 if the accountant decides
- **Depends on:** the accountant's written answers. Independent of the other PRs.
- **Complexity:** Medium.
- **Likely affected:** `shared/estimate-rules.ts` (taxable categories), `server/billing.ts` tax calculation, the line-item form, work orders, settings, print, reports and the tax tests.
- **Risks:** **High.** Tax affects every document. Mitigation:
  - Only new estimates use new rules.
  - Issued invoices never change (database locks).
  - The accountant's example cases become automated tests.
  - Your test includes the accountant's examples.
- **What changes for you:** tax follows the accountant-approved Idaho treatment, including the use-tax option.
- **Codespaces acceptance checklist:**
  1. For each accountant example (labor only, parts plus labor, shipping, use-tax-paid part, exempt customer), build the estimate and compare tax to the accountant's figure to the cent.
  2. An existing estimate and invoice keep their old tax.
  3. Mark a part "use tax paid by shop" (requires a note). The customer copy shows it as non-taxable, and the use-tax report lists it.
  4. As an advisor without tax permission: the option is refused.
  5. Work order before invoicing: a tax-only change is allowed with a reason and recorded in the audit history. Prices cannot be changed this way.

### PR D1: Scheduling and work-order planning
- **Features:**
  - SCHED-002: one scheduling screen (replacing the legacy board)
  - SCHED-004: gaps and capacity by department and technician
  - SCHED-005: the "waiting to be scheduled" list
  - SCHED-006: verify status tracking
  - RNI-008: R&I tasks into work orders
  - SCHED-008 check
- **Depends on:** B4 merged; M-19.
- **Complexity:** Large.
- **Likely affected:** the scheduling page, the capacity calendar, operations, work orders, schedule slots and bookings.
- **Risks:**
  - Moving booking requests off the legacy board. Mitigation: legacy data is kept and shown read-only until it is moved.
- **What changes for you:** one screen shows who is free, which approved jobs are waiting, and where the gaps are.
- **Codespaces acceptance checklist:**
  1. Approve a demo estimate. It appears in "waiting to be scheduled".
  2. Schedule it into a technician's opening. Double-booking is refused with an explanation.
  3. Add technician leave: capacity drops for that day.
  4. The gap view for the next 7 days matches the hours you can count by hand.
  5. An approved estimate with R&I shows the R&I task on the work order.
  6. The estimate page still has scheduling at the very bottom.
  7. Phone: steps 2 and 4.

### PR D2: Technician time tracking
- **Features:**
  - SCHED-009: start and stop time per job on the phone (billable, non-billable, travel, rework)
  - Manager corrections with a reason
  - SCHED-003: sold vs worked hours per job and technician
  - SCHED-007: productivity data for E3
- **Depends on:** D1 merged; M-21.
- **Complexity:** Medium–Large.
- **Risks:**
  - Employee adoption. Mitigation: two-tap start and stop on My Work.
  - Payroll is out of scope (backlog FIN-01).
- **What changes for you:** you can see hours sold vs hours worked for every job.
- **Codespaces acceptance checklist:**
  1. As the demo technician on a phone: start a job, stop it after a few minutes. The entry shows on the job.
  2. Manager corrects the entry with a reason. The original is kept in the audit history.
  3. The job shows sold hours vs worked hours.
  4. A technician cannot see other technicians' time or company financials.

### PR E2: Dashboard foundation and Executive Overview
- **Features:**
  - The approved metric dictionary
  - Tested KPI calculations that reconcile to invoices and payments
  - Executive Overview tab (DASH-002) with filters, KPI cards, trends and drill-downs
  - Dashboard permissions (DASH-012)
  - "Missing data" labels, never 0
  - Financial basics (DASH-009)
- **Depends on:** E1, D1 and D2 merged; M-23, M-24, M-25, M-26. **A mockup is approved before coding.**
- **Complexity:** Large.
- **Risks:**
  - Misleading numbers. Mitigation: reconciliation tests (departments add up to the company; no double technician credit; booked, completed, invoiced and collected kept separate).
- **What changes for you:** a daily management screen with real figures, and clear labels where information is missing.
- **Codespaces acceptance checklist:**
  1. The Executive Overview loads with the demo data. Every card shows its "as of" time.
  2. Booked, completed, invoiced and collected are four different numbers. Each one drills down to its records, and the records add up to the card.
  3. Department totals add up to the company total for the same period.
  4. A job shared by two technicians counts its revenue once.
  5. Cards with no data say "No data collected yet", not $0.
  6. As an advisor: restricted cards are absent, and a direct request for them is refused.
  7. Desktop first; phone shows the cards stacked and readable.

### PR E3: Remaining dashboard tabs and alerts
- **Features:**
  - Tabs: Sales & Pipeline, Scheduling & Capacity, Labor & Employees, Departments, Customer Segments, Outside Sales, Financial / AR, Management Settings (DASH-003 to DASH-010)
  - Alerts with management-set thresholds (DASH-013)
  - CSV export and a printable report
- **Depends on:** E2 merged; M-25. May be split into E3a (sales, segments, outside sales) and E3b (labor, scheduling, financial, alerts).
- **Complexity:** Large.
- **Codespaces acceptance checklist:** per tab: totals reconcile to E2, drill-downs open the matching records, exports respect permissions, alerts fire only after thresholds are set, and incomplete data is labeled.

### PR C1: Furniture, booth and medical diagram library
- **Features:**
  - UPH-014: booth, medical exam, dental, chiropractic and massage diagrams with clickable components (RB01–MT06)
  - FURN-002: six booth styles
  - FURN-001: confirmed chair, recliner, ottoman, sofa and other styles (M-28)
  - Fix the fallback to "chair" for hotel, office, RV and other pieces
- **Depends on:** B1 merged (diagram list prices are editable); M-28.
- **Complexity:** Medium.
- **Likely affected:** `lib/furniture-geometry.ts`, the furniture splat, the estimate damage map, and the splat page.
- **Risks:**
  - Existing furniture estimates' saved marks. Mitigation: old diagram IDs are kept; new styles only add.
- **What changes for you:** many more styles in the dropdown, and diagrams for booths and medical equipment.
- **Codespaces acceptance checklist:**
  1. Furniture estimate: the style dropdown lists the confirmed styles for each piece type.
  2. A restaurant booth shows its style choices and components (seat, back, end panels, top cap, kick panel). Click a component: it is selected.
  3. Dental chair diagram: the 6 components are clickable.
  4. An old furniture estimate reopens with its marks in the same places.
  5. Phone: the diagrams can be tapped accurately.

### PR C2: Upholstery pricing matrix and labor recommendations
- **Features:**
  - UPH-007 / UPH-009: Management → Upholstery Pricing, with rates by category and component, multipliers and minimum charges; a new "see upholstery rates" permission
  - UPH-006: recommended hours with an override and a reason
  - UPH-002: component vs complete selection
  - UPH-008: snapshots
  - UPH-015: foam and materials lines
- **Depends on:** C1 merged; M-32, M-33. **Reminder: ask for the finished Yardage Guide and workbook at the start of C2.**
- **Complexity:** Medium–Large.
- **Risks:**
  - Estimators inferring rates (accepted in DOC p.9).
  - Server-side enforcement is tested.
- **Codespaces acceptance checklist:**
  1. As a manager: set the dental chair rate and the backrest hours range.
  2. As an estimator: select dental chair → backrest. The recommended hours and calculated charge appear, and the rate table is not visible. A direct request for the rates is refused.
  3. Override the hours with a reason: both values are kept.
  4. Change the rate: the existing estimate keeps the old rate until an explicit reprice.

### PR C3: Upholstery yardage calculator
- **Features:**
  - UPH-001 / UPH-003 / UPH-004 / UPH-005: measurements, nesting on a 54" roll (adjustable), grain and pattern repeat, calculated vs ordering yardage, ¼-yard rounding
  - UPH-010 / UPH-013: reference data import, only once verified
  - UPH-011: safeguards
  - UPH-012: the document's 6 tests
- **Depends on:** C2 merged; **the finished guide (M-30)**; M-31.
- **Complexity:** Large.
- **Risks:**
  - Calculation accuracy. Mitigation: the document's 6 tests, worked examples from the finished guide, and exact decimal math.
- **Codespaces acceptance checklist:**
  1. Enter two 24"-wide cushions. The layout places them side by side on the 54" roll and uses less yardage than one after the other.
  2. A 60" piece on a 54" roll warns and requires a seam or rotation choice.
  3. Directional vinyl is never rotated.
  4. Calculated and ordering yardage are both shown; ordering is rounded up to ¼ yard.
  5. Quantity 3 multiplies the range without hidden waste.
  6. The material and labor lines appear in section 3 with normal tax and totals. The estimate keeps them after the guide values change.

### PR F1: Leads, follow-ups and referrals
- **Features:**
  - MKT-008: follow-up reminders on My Work and the dashboard
  - MKT-004: referral linking ("referred by customer")
  - MKT-009: target dealer list and "days since last visit"
  - MKT-007: marketing report from actual records
- **Depends on:** E1 merged (ideally E2).
- **Complexity:** Medium.
- **Codespaces acceptance checklist:** a follow-up due today shows on My Work; a referral links two customers; the target dealer list shows days since last visit; the report counts match the records.

### PR F2: Email campaigns (after a separate review)
- **Features:**
  - MKT-002 / MKT-003: campaign creation, audience from segments, unsubscribe, delivery results
  - The real email provider connection
- **Depends on:** F1; **an approved security and deliverability review** (M-34).
- **Complexity:** Large.
- **Codespaces acceptance checklist:** defined after the review. All demo sending goes only to the internal test mailbox.

---

## 5. Requirements traceability

| Section | Register IDs | PRs |
|---|---|---|
| A: Core CRM | CRM-001–012, QA-001–003 | A1, A2 |
| B: PDR, hail, R&I | PDR-001–010, PRC-001–003, HAIL-001–003, RNI-001–007 | PR #5, A1, B1, B2, B3, B4 |
| C: Upholstery and furniture | UPH-001–015, FURN-001–002 | C1, C2, C3 |
| D: Scheduling and operations | SCHED-001–009, RNI-008 | PR #5, D1, D2 |
| E: Dashboard | DASH-001–014 | E1, E2, E3 |
| F: Marketing | MKT-001–010 | E1, A2, F1, F2 |
| G: Accounting and tax | TAX-001–006, FIN-001–002, BL-* | G1, later |

---

## 6. Dashboard data audit (DOC §13 Phase A)

This is what the database collects **today**, checked against the dashboard specification's data requirements (DOC p.25).

| Information | Today | What's needed | Planned in |
|---|---|---|---|
| Estimate created | Yes | — | — |
| Estimate sent | Partly: delivery attempts are logged; there is no "sent" date | Sent date | E1 |
| Estimate approved | Yes (approved date) | — | — |
| Estimate declined / expired | Status only, no date | Dates and lost reason | E1 |
| Status history | Generic audit history only | A readable status timeline | E1 |
| Scheduled / started / completed | Partly (scheduled date, production start, completion) | Actual start time | D1/D2 |
| Invoiced / paid | Yes (issue date, payment dates, partial payments) | Invoice "paid in full" date (calculated) | E2 |
| Refunds / credits | **No** | Credit notes and refunds (backlog BILL-01) | later G2 |
| A/R aging | Calculated on demand | — | E2 |
| Lead source / referral | Free text | Standard list | E1 |
| Leads, walk-ins, calls | **No** (only web booking requests) | Lead records | E1 |
| Customer segment | Free text "type" | Standard list (DOC §3) | E1 |
| Parent accounts / locations | **No** | Parent account link | E1 |
| Department | On production cases; line category | One agreed list (M-20) | E1 |
| Salesperson attribution | Yes (sales team with % shares) | — | — |
| Technician attribution | Yes (labor credits with % shares, assignments) | — | — |
| Technician time | Partly (minutes by productive, rework or travel; no clock in/out, no billable flag) | Time clock per job | D2 |
| Available hours | Partly (working hours and leave in the capacity engine; not confirmed by default) | Confirmed hours (M-19) | D1 |
| Sold labor hours | Partly (estimated task minutes; labor lines in hours) | Consistent sold hours | D2 |
| Material / labor cost | Partly (purchase cost per line; job costs; no pay rates) | Cost rules (M-23) | E2 |
| Dealer visits | **No** | Visit log | E1 |
| Targets / thresholds | **No** (only PDR package threshold) | Targets (M-25) | E3 |

**What can be trusted today:**
- booked estimates
- approved estimates
- invoiced revenue and tax
- payments
- A/R balance
- salesperson and technician credit shares

**What cannot be trusted yet:**
- utilization and efficiency
- close rates by lead source
- segment and department reporting
- gross margin
- dealer visit results

The dashboard will label these "data incomplete" until E1 and D2 have collected them.

---

## 7. Testing strategy (Deliverable 6)

### Every PR is tested at three levels before you see it

1. **Automated suites (in CI on every push).** All existing suites must pass; none may be weakened to make a change pass:
   - verify
   - fresh install
   - security
   - estimating
   - pricing
   - calculation
   - release integrity
   - demo self-test
   - the dependency audit gate

   Each PR adds tests for its own requirements and for every defect found.
2. **Real-browser runs** with the demo owner account and the role accounts, clicking through each full workflow on a fresh `demo.sh reset`, on **desktop and phone sizes**. Like the Phase 2.2 owner checklist (32 checks), each PR gets a script that follows its acceptance checklist.
3. **Your Codespaces test,** using the PR's checklist.

**A feature is never reported complete because unit tests pass.**

### Standard checks in every PR's checklist

| Check | How |
|---|---|
| Correct version | The sidebar "Version" matches the PR's latest commit. `bash .devcontainer/demo.sh status` agrees. |
| Screens load | The automatic screen-health check (A1) opens every main screen and every Pricing Matrix tab. No error card; required data visible. |
| Data shows | Demo records appear where expected (never an empty table without an explanation). |
| Saves work | Save → refresh → still there. Sign out → sign in → still there. |
| Permissions | Repeat the key step as the advisor, technician and accountant demo logins. The server refuses what each role may not do. |
| Calculations | Expected totals are written down **before** running the app, then compared to the cent, through estimate, invoice and print. |
| Nothing else broke | The automated regression suites, plus a short click-through of: New Estimate → line items → approve → work order → invoice → payment → print. |
| Connection failure | Stop the demo server mid-task. The screen shows the plain-English message, and nothing shows $0 or empty data as if it were real. |
| Phone | The workflow on a phone-sized screen; no sideways scrolling; buttons reachable. |
| Estimate layout | Scheduling, work planning and technicians remain at the very bottom of the estimate page. |

### Keeping a stable, testable CRM

- `main` holds only approved, merged work. CI runs on `main` after every merge.
- Each PR is a separate branch from the latest `main`. You can open a private codespace on that branch, test it, and leave `main` untouched.
- The demo uses demo data only, in its own database. A1 adds a guard so the demo can never start on a non-demo database.
- No production deployment and no real customer records until the pre-launch items (security review, hosting, backups, load test) are approved.

### Codespaces steps (included in every PR)

1. On GitHub, open the PR, then **Code → Codespaces → Create codespace on [branch]** (or reopen your existing codespace and run `git pull`).
2. Wait for the setup to finish. The "RepairPro demo" terminal shows the log.
3. Open the **Ports** tab → **RepairPro demo (5000)** → globe icon. Sign in with the login in `DEMO-LOGIN.md`.
4. Check the sidebar version matches the PR's latest commit.
5. Follow the PR's checklist.
6. To start fresh: `bash .devcontainer/demo.sh reset`.

---

## 8. Missing and incomplete references (Deliverable 7)

These are referenced in the Word document but were **not** provided, or are incomplete. They were not reviewed beyond what appears inside the Word document itself.

| Reference | Where mentioned | What we have | Needed for |
|---|---|---|---|
| **McDowells_Upholstery_Yardage_Guide.xlsx** (workbook: five category tabs, low/high yardage, dimensions, allowances, notes) | DOC p.4, 17 (a link to a Downloads folder on another computer) | **Not provided.** You said it is still being developed. | C2/C3 (M-30) |
| **"Claude Code Implementation Instructions"** (developer instructions file) | DOC p.4 | **Not provided as a file.** A specification of about 1 page inside the document (p.10) is probably its content, but this cannot be confirmed. | C3 |
| **McDowells_Yardage_Reference.json** (importable yardage database) | DOC p.4, 10 | Text of 26 records is pasted into the document (p.10–17), all `verified=false`. Not received as a file. Data issues noted in UPH-013. | C3 (after verification) |
| **McDowells Operations Dashboard specification** (Word and PDF, 5 pages, 13 sections) | DOC p.20 | **Files not provided.** The 13 sections appear in full inside the document (p.21–26), and this plan uses that text. | E1–E3 |
| **McDowells Upholstery Component Splat Charts** (5-page illustrated PDF with numbered exploded-parts drawings) | DOC p.28 | **Not provided.** Instead, the document has 5 product photos from retailer websites (a booth, a Viva exam table, a dental chair, a Coverall chiropractic table, an EarthLite massage table). They are useful as visual reference only. They are not our drawings and must not be copied into the CRM. | C1 |
| **Component data JSON** (splat charts) | DOC p.28 | Text pasted into the document (p.35–41): 5 categories × 6 components, status "schematic_reference_not_validated". | C1/C2 |
| **Furniture and booth style list** | DOC p.43 ("including" then nothing) | **Cut off.** Only a third-party chart picture (© 2017 Leather Hide Store, about 52 chair, recliner and ottoman styles with leather yardages). | C1 (M-28) |
| **Carrier hail matrices** (current documents) | OWNER §4B | Only State Farm revision 125278.13 (2025-04-29) is recorded. | B2 (M-10, M-11) |
| **Hail reference text file** used by the hail test (`hail-research/pages.jsonl`) | AUDIT (code) | **Not in the repository.** | B2 |
| **R&I part list, labor times and rates** | OWNER §4B | **None provided.** | B3 (M-13, M-15a, M-15b) |
| **Accountant's tax guidance** | OWNER §4G | **Not yet requested.** | G1 (M-05 to M-08a) |
| **Usability complaint list** | OWNER §4A | **Not provided.** | A1 (M-03) |

### Documents not counted as "reviewed"

- **The six pictures were viewed.** Only the chart picture contains text (style names and yardages), and we use its style names only as candidates.
- **The links in the document** ("Download Excel workbook", "Download developer instructions", "Download JSON data", "Download Word Document", "Download PDF Version", "Download 5-Page Illustrated PDF", "Download JSON File") are just words. The files behind them were not included.
