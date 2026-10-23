# CRM-RepairPro: Master Requirements Register

**Status: living document. First approved for the repository 2026-10-20.** Updated in every pull request that changes a requirement's status.

This register lists every requested change, so nothing is lost between work sessions. It is updated whenever a phase starts, is tested, or is merged.

## Sources

| Code | Source |
|---|---|
| **DOC p.N** | Word document "CRM notes for changes on RepairPro October 2026" (43 pages as laid out by Word; the file properties say 40). Page numbers are approximate. They come from Word's saved page layout, so they may shift by a page on another computer. |
| **OWNER §N** | The owner's planning message of 2026-10-16 ("Master Development Plan and Requirements Review"), section N. |
| **AUDIT** | A problem found while comparing the document with the code. Nobody asked for it, but it affects a requested item. |
| **BACKLOG** | An item already recorded in `docs/KNOWN-ISSUES.md`. It is carried here so the register is complete. |

**Important:** the Word document covers tax, line items, salesperson, customer errors, search, the dashboard, upholstery, splat diagrams and the pricing matrices. It does **not** mention R&I, hail matrix verification, marketing or most of the scheduling items. Those come from the owner's message (OWNER §4) and from the earlier Phase 2 design report.

## Statuses

| Status | Meaning |
|---|---|
| Not Started | Nothing has been built. |
| Already Implemented — Needs Verification | Code exists. It has not been proven to work the way the request asks. |
| In Progress | Being built on a development branch. |
| Ready for Testing | In a pull request, waiting for the owner's Codespaces test. |
| Approved and Merged | The owner approved it and it is in `main`. |
| Blocked / Awaiting Decision | Cannot start until management (or the accountant) decides something, or provides a file. |
| Deferred | Intentionally later. |

## Priorities

| Priority | Meaning |
|---|---|
| **P1** | Wrong numbers, blocked daily work, or a security or accounting risk. |
| **P2** | An important workflow improvement. |
| **P3** | Valuable, but it can wait. |

## Requirement types (added 2026-10-21)

| Type | Meaning |
|---|---|
| **Approved** | Requested by management (Word document or owner message) or explicitly approved. The *solution* described may still be a proposal. |
| **Proposed** | An idea from Claude or from industry research, awaiting management approval. |
| **Verify** | Functionality exists and must be verified before it is relied on. |
| **Missing info** | Cannot proceed until information or a decision is provided. |
| **Future dependency** | Required later (for example before launch), or depends on outside material not yet provided. |

The estimate-first proposal (`ESTIMATING-STRATEGY.md`) would change several planned PR codes. The current codes below stay until it is approved.

## Planned pull requests

The planned pull request (PR) codes are explained in `MASTER-PLAN.md` §4.

| Code | Pull request |
|---|---|
| A1 | Core data-entry fixes and screen-health safeguards |
| A2 | Shared 3-character search |
| B1 | Editable pricing for all services |
| B2 | Hail audit and pricing sources |
| B3 | R&I catalog, rates and safety checks |
| B4 | R&I on estimates, without double charges, including hail |
| E1 | Start collecting dashboard data |
| G1 | Tax treatment (after accountant approval) |
| D1 | Scheduling and work-order planning |
| D2 | Technician time tracking |
| E2 | Dashboard foundation and Executive Overview |
| E3 | Remaining dashboard tabs and alerts |
| C1 | Furniture, booth and medical diagram library |
| C2 | Upholstery pricing matrix and labor recommendations |
| C3 | Upholstery yardage calculator |
| F1 | Leads, follow-ups and referrals |
| F2 | Email campaigns (after a security and deliverability review) |

---

## Summary table

| ID | Requirement (short) | Source | Status | PR | Priority | Type |
|---|---|---|---|---|---|---|
| **Section A: Core CRM** | | | | | |
| CRM-001 | Price, cost and quantity boxes show an unwanted leading zero | DOC p.1 | Not Started | A1 | P1 | Approved |
| CRM-002 | Service writer not offered as a salesperson | DOC p.1 | Decided 2026-10-20: service writers are service advisors; see CRM-019 | A1 | P1 | Approved |
| CRM-003 | "Could not create the customer" with no reason | DOC p.2–3 | Ready for Testing (PR #5) | PR #5 + A1 | P1 | Approved |
| CRM-004 | Every form explains what went wrong and what to do | DOC p.2 | Partly done; Not Started for a full sweep | A1 | P1 | Approved |
| CRM-005 | Suggestions after 3 characters in every search | DOC p.18 | Already Implemented — Needs Verification (partial) | A2 | P2 | Verify |
| CRM-006 | Search by every useful field | DOC p.18; OWNER §4A | Partial | A2 | P2 | Approved |
| CRM-007 | Choosing a result brings up the whole file | DOC p.18 | Already Implemented — Needs Verification (partial) | A2 | P2 | Verify |
| CRM-008 | Customer creation and editing | OWNER §4A | Already Implemented — Needs Verification | A1 (verify) | P2 | Verify |
| CRM-009 | Vehicle creation and linking | OWNER §4A | Approved and Merged (PR #4) | — (verify in A1) | P2 | Approved |
| CRM-010 | Employee roles and permissions review | OWNER §4A | Partial | A1 (salesperson); E2 (dashboard access) | P2 | Approved |
| CRM-011 | Server connection and Codespaces reliability | OWNER §4A, §7 | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| CRM-012 | General usability and navigation problems | OWNER §4A | Blocked / Awaiting Decision (needs a list, M-03) | A1 / later | P2 | Missing info |
| QA-001 | Automatic "every screen loads" regression check | OWNER §7 | Not Started | A1 | P1 | Approved |
| QA-002 | Guard the demo against production data | OWNER §8 | Partial | A1 | P1 | Approved |
| QA-003 | A demo login for every role | OWNER §7; AUDIT | Not Started | A1 | P2 | Approved |
| **Section B: PDR, hail and R&I** | | | | | |
| PDR-001 | Individual dent records and damage map | OWNER §4B | Approved and Merged (PR #4) | — | P1 | Approved |
| PDR-002 | Editable standard PDR matrix | OWNER §4B | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PDR-003 | Editable crease matrix | OWNER §4B | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PDR-004 | Dent size, length, severity, location difficulty, notes | OWNER §4B | Merged (records) / Ready for Testing (pricing) | PR #5 | P1 | Approved |
| PDR-005 | Per-dent pricing and recorded overrides | OWNER §4B | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PDR-006 | Panel package at a manual price | OWNER §4B | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PDR-007 | Whole-vehicle package at a manual price | OWNER §4B | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PDR-008 | Pricing permissions and manager approval | OWNER §4B | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PDR-009 | Estimate and invoice presentation | OWNER §4B | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PDR-010 | No duplicate charges; accounting unchanged | OWNER §4B | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PRC-001 | Printing the pricing catalog gives a 404 | DOC p.42 | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| PRC-002 | Pricing matrices look empty / show $0.00 | DOC p.42 | Part Ready for Testing (PR #5); part Not Started | PR #5 + A1 | P1 | Approved |
| PRC-003 | No way to edit amounts in the non-PDR matrices | DOC p.42 | Not Started | B1 | P1 | Approved |
| HAIL-001 | Audit and test the existing hail estimator | OWNER §4B | Not Started | B2 | P1 | Approved |
| HAIL-002 | Verify source, accuracy and currency of insurance hail matrices | OWNER §4B | Blocked / Awaiting Decision (M-10, M-11) | B2 | P1 | Missing info |
| HAIL-003 | Hail source test cannot run (missing reference file) | AUDIT | Not Started | B2 | P2 | Approved |
| RNI-001 | Expandable catalog of vehicle components | OWNER §4B | Not Started | B3 | P1 | Approved |
| RNI-002 | Suggested labor times, only when properly sourced | OWNER §4B | Blocked / Awaiting Decision (M-13) | B3 | P2 | Missing info |
| RNI-003 | Editable labor rates and manual price overrides | OWNER §4B | Not Started | B3 | P1 | Approved |
| RNI-004 | One R&I linked to several dents or panels | OWNER §4B | Not Started | B4 | P1 | Approved |
| RNI-005 | R&I in both PDR and hail estimates | OWNER §4B | Not Started (hail has a manual R&I line) | B4 | P1 | Approved |
| RNI-006 | Safety-sensitive manufacturer procedure checks | OWNER §4B | Not Started | B3 | P1 | Approved |
| RNI-007 | Prevent duplicate R&I labor charges | OWNER §4B | Not Started | B4 | P1 | Approved |
| **Section C: Upholstery and furniture** | | | | | |
| UPH-001 | Upholstery material calculator inside the estimate | DOC p.4–6 | Not Started | C3 | P2 | Approved |
| UPH-002 | Individual components (default) or complete reupholstery | DOC p.5–6 | Not Started | C2/C3 | P2 | Approved |
| UPH-003 | Component measurements; 54-inch roll by default, adjustable | DOC p.6–7, 10 | Not Started | C3 | P2 | Approved |
| UPH-004 | Cutting layout and nesting, grain direction, pattern repeat | DOC p.6–7, 10 | Not Started | C3 | P2 | Approved |
| UPH-005 | Calculated vs ordering yardage; rounding; waste allowance | DOC p.7, 10 | Not Started | C3 | P2 | Approved |
| UPH-006 | Recommended labor hours with an override and a reason | DOC p.7–8 | Not Started | C2 | P2 | Approved |
| UPH-007 | Management-only labor rate matrix by equipment category | DOC p.8–9 | Not Started | C2 | P2 | Approved |
| UPH-008 | Old estimates keep the rates they used | DOC p.9–10 | Not Started (the pattern exists from PDR) | C2/C3 | P1 within module | Approved |
| UPH-009 | Management → Upholstery Pricing screen, expandable | DOC p.9 | Not Started | C2 | P2 | Approved |
| UPH-010 | Quick estimate by category → style → quantity (low/mid/high) | DOC p.10 | Blocked (needs finished guide, M-30) | C3 | P3 | Future dependency |
| UPH-011 | Safeguards: no double waste; medical/dental material questions | DOC p.10 | Not Started | C3 | P2 | Approved |
| UPH-012 | The document's six calculator acceptance tests | DOC p.10 | Not Started | C3 | P2 | Approved |
| UPH-013 | Import reference yardage data | DOC p.10–17 | Blocked / Awaiting Decision (M-30) | C3 | P3 | Future dependency |
| UPH-014 | Clickable component diagrams for the 5 categories | DOC p.28–41 | Not Started | C1 | P2 | Approved |
| UPH-015 | Optional foam, padding and other materials | DOC p.6, 10 | Partial (foam replacement action exists) | C2/C3 | P2 | Approved |
| FURN-001 | Many more furniture and booth splat options | DOC p.43 | Blocked / Awaiting Decision (list cut off, M-28) | C1 | P2 | Missing info |
| FURN-002 | Booth styles (single, double, channel-tufted, high-back, curved, banquette) | DOC p.11–12 | Not Started | C1 | P2 | Approved |
| **Section D: Scheduling and operations** | | | | | |
| SCHED-001 | Capacity calendar showed "Failed to fetch" | DOC p.19 | Ready for Testing (PR #5) | PR #5 | P1 | Approved |
| SCHED-002 | Scheduling technicians: availability and assignments | OWNER §4D | Already Implemented — Needs Verification / redesign | D1 | P2 | Verify |
| SCHED-003 | Labor hours sold vs actually worked | OWNER §4D | Partial | D2 | P2 | Approved |
| SCHED-004 | Scheduling gaps and department capacity | OWNER §4D | Partial | D1 | P2 | Approved |
| SCHED-005 | Open and unscheduled work orders | OWNER §4D | Partial | D1 | P2 | Approved |
| SCHED-006 | Job status and completion tracking | OWNER §4D | Already Implemented — Needs Verification | D1 | P2 | Verify |
| SCHED-007 | Technician productivity | OWNER §4D | Partial | D2 | P2 | Approved |
| SCHED-008 | Scheduling stays at the bottom of the estimate page | OWNER §4D | Approved and Merged (PR #4); standing rule | — | P1 | Approved |
| SCHED-009 | Technician time clock (billable, non-billable, travel, rework) | OWNER §4D; DOC p.23 | Partial | D2 | P2 | Approved |
| RNI-008 | R&I tasks carried from estimates into work orders | OWNER §4D | Not Started | D1 | P2 | Approved |
| **Section E: Dashboard and reporting** | | | | | |
| DASH-001 | Dashboard "void of useful information" | DOC p.19 | Partial | E2 | P2 | Approved |
| DASH-002 | Executive overview: filters, KPI cards, charts | DOC p.21–22 (§1) | Not Started | E2 | P2 | Approved |
| DASH-003 | Department reporting that reconciles to company totals | DOC p.22 (§2) | Blocked / Awaiting Decision (M-20) | E1/E3 | P2 | Missing info |
| DASH-004 | Customer segments and parent accounts | DOC p.22–23 (§3) | Partial | E1/E3 | P2 | Approved |
| DASH-005 | Labor utilization and technician scorecards | DOC p.23 (§4) | Partial | D2/E3 | P2 | Approved |
| DASH-006 | Scheduling capacity and trouble signs | DOC p.23–24 (§5) | Partial | D1/E3 | P2 | Approved |
| DASH-007 | Front lobby sales and closing performance | DOC p.24 (§6) | Partial | E1/E3 | P2 | Approved |
| DASH-008 | Outside sales and dealer visits | DOC p.24 (§7) | Not Started | E1/E3 | P2 | Approved |
| DASH-009 | Financial health and receivables | DOC p.24–25 (§8) | Partial | E2/E3 | P2 | Approved |
| DASH-010 | Layout, tabs, drill-downs, export, printing | DOC p.25 (§9) | Not Started | E2/E3 | P2 | Approved |
| DASH-011 | Data requirements and metric dictionary | DOC p.25 (§10) | Not Started | E1/E2 | P1 within module | Approved |
| DASH-012 | Dashboard permissions enforced on the server | DOC p.25 (§11) | Not Started (the server-side pattern exists) | E2 | P1 within module | Approved |
| DASH-013 | Configurable alerts and goals | DOC p.26 (§12) | Not Started | E3 | P3 | Approved |
| DASH-014 | Follow the document's build plan (audit → dictionary → mockup → code) | DOC p.26 (§13) | In Progress (audit in this plan) | E1–E3 | P1 within module | Approved |
| **Section F: Marketing** | | | | | |
| MKT-001 | Audit existing marketing features | OWNER §4F | Done in this plan (see entry) | — | P2 | Approved |
| MKT-002 | Customer communications (estimate and invoice email) | OWNER §4F | Already Implemented — Needs Verification (not connected) | F2 | P2 | Verify |
| MKT-003 | Email campaigns and follow-ups | OWNER §4F | Not Started (screen disabled) | F2 | P3 | Approved |
| MKT-004 | Referral tracking | OWNER §4F | Partial (free text) | E1/F1 | P2 | Approved |
| MKT-005 | Customer history | OWNER §4F | Already Implemented — Needs Verification | A2 (verify) | P2 | Verify |
| MKT-006 | Leads and opportunities | OWNER §4F | Not Started | E1/F1 | P2 | Approved |
| MKT-007 | Marketing reporting | OWNER §4F | Partial (typed-in counters) | F1/F2 | P3 | Approved |
| MKT-008 | Sales follow-up reminders | OWNER §4F | Partial (manual queue) | F1 | P2 | Approved |
| MKT-009 | Dealer and business account outreach | OWNER §4F | Not Started | E1/F1 | P2 | Approved |
| MKT-010 | Customer segmentation | OWNER §4F | Partial (free text) | E1 | P2 | Approved |
| **Section G: Accounting and tax** | | | | | |
| TAX-001 | No sales tax on labor | DOC p.1 | Partial; Blocked / Awaiting Decision (M-05) | G1 | P1 | Missing info |
| TAX-002 | Tax parts at 6% by default on estimates and work orders | DOC p.1 | Already Implemented — Needs Verification | G1 (verify) | P1 | Verify |
| TAX-003 | Tax shipping at 6% | DOC p.1 | Partial; Blocked / Awaiting Decision (M-06) | G1 | P1 | Missing info |
| TAX-004 | Option not to tax parts or shipping when the shop pays use tax | DOC p.1 | Not Started; Blocked / Awaiting Decision (M-07) | G1 | P1 | Missing info |
| TAX-005 | Change tax treatment on the work order after the customer approves | DOC p.1 | Blocked / Awaiting Decision (M-08) | G1 | P1 | Missing info |
| TAX-006 | Settings "Sales Tax Rate" box is not connected | AUDIT | Not Started | G1 | P2 | Approved |
| FIN-001 | Preserve invoicing, payments, balances, tax, locks and audit | OWNER §4G | Standing rule | All | P1 | Approved |
| FIN-002 | List financial changes needing accounting approval | OWNER §4G | Done in this plan (MANAGEMENT-DECISIONS.md) | — | P1 | Approved |
| **Existing backlog** | | | | | |
| BL-EST-01 | Legacy invoice lines with no labor/parts split | BACKLOG | Blocked (accountant) | G1 or later | P1 | Future dependency |
| BL-BILL-01 | Credit notes, refunds and reversals | BACKLOG | Not Started | later G2 | P1 before launch | Future dependency |
| BL-INT-01 | QuickBooks Desktop Enterprise transfer | BACKLOG | Not Started | later | P2 | Future dependency |
| BL-INT-02 | Customer payment portal (Mcdowellsrepair.com) | BACKLOG | Not Started | later | P2 | Future dependency |
| BL-INT-03 | Dealer approval portal | BACKLOG | Not Started | later | P3 | Future dependency |
| BL-INT-05 | Public website booking intake | BACKLOG | Not Started | later | P3 | Future dependency |
| BL-OPS-01 | Proven capacity for about 40 simultaneous users | BACKLOG | Not Started | before launch | P1 before launch | Future dependency |
| BL-SEC-02 | Independent human security review | BACKLOG | Not Started | before launch | P1 before launch | Future dependency |
| BL-HOST-01 | Hosting, HTTPS and backups for production | BACKLOG | Deferred to launch | before launch | P1 before launch | Future dependency |

---

## Detailed entries

### Section A: Core CRM reliability and shared improvements

#### CRM-001: Price, cost and quantity boxes show an unwanted leading zero
- **Source:** DOC p.1 (Add Line Item: "Customer Unit Price … has a zero in front of price"; same for purchase unit cost).
- **Current CRM:**
  - The Add Line Item boxes start at the number 0.
  - Typing 6 makes the box read "06". Continuing gives "0600".
  - The saved amount is correct ($600.00, as the document's "Item total" shows). The display is wrong and confusing.
- **Same defect elsewhere:**
  - Quantity and use-tax rate on Add Line Item
  - The invoice payment amount
  - Hail dent counts
- **Not affected:** the newer pricing editor and dent billing boxes work correctly.
- **Is it working correctly?** No.
- **Recommended solution:**
  - Empty boxes start blank, with a placeholder such as "0.00".
  - Typing replaces the content, with no leading zero.
  - The same fix goes into every number box listed above.
  - A browser test types prices into each box.
- **Affects:** pricing entry, invoice payments and hail counts. Display only; the saved amounts were already right.
- **Depends on:** nothing.
- **Acceptance:**
  - Type 600 into the customer price: the box shows "600" and the total shows $600.00.
  - The same works for cost, quantity, use-tax rate, payment amount and hail counts.
  - Saved values are unchanged after a refresh.
  - Works on desktop and phone.
- **Decision needed:** none.

#### CRM-002: Service writer not offered as a salesperson
- **Source:** DOC p.1 ("I added a service writer but she did not show up as an option for sales people").
- **Current CRM:**
  - The salesperson list only includes active employees whose role is Owner, Administrator, Manager or **Service advisor**.
  - There is no "Service writer" role.
  - An employee is left out if their role is Support, Technician, Accountant or Auditor, or if their invitation is still pending (status "invited").
- **Is it working correctly?** It works as built, but not the way the shop works.
- **Recommended solution:**
  - Add a **"Can be credited as a salesperson"** checkbox to each employee. Management controls it. The salesperson lists, the sales-credit check at invoice time, and the planning salesperson list all use it.
  - Optionally add a "Service writer" role if service writers need different permissions from service advisors (M-01).
  - Show pending invitations in the employee list with a clear note: "Not available until they accept the invitation".
- **Affects:** permissions, sales credit/commission splits (`invoice_sales_credits`), and dashboard sales-by-employee figures later.
- **Depends on:** M-01.
- **Acceptance:**
  - A support-role employee with the checkbox on appears in the salesperson list and can be credited on an invoice.
  - With the checkbox off, they do not appear.
  - Past invoices' sales credits are unchanged.
  - A pending invitation shows the explanation.
- **Decision needed:** M-01, M-02.

#### CRM-003: "Could not create the customer" with no reason
- **Source:** DOC p.2–3 (New Estimate → New customer → Commercial; the message did not say why or what to do).
- **Current CRM:**
  - The message the owner saw is the fallback text used when no reason came back. That happens when the server cannot be reached, which was the Codespaces stopped-server problem found in the Phase 2.2 retest.
  - PR #5 (commit d12cf1c) now shows a plain-English explanation for connection failures, empty replies and web-page replies.
  - The server already sends specific reasons:
    - a name or company is required
    - a possible duplicate customer
    - invalid field types and lengths
    - no permission
- **Still missing:**
  - Phone and email are not checked for format.
  - Reasons are not shown next to the field they concern.
- **Is it working correctly?** Likely fixed in PR #5. Needs the owner's retest.
- **Recommended solution:**
  - PR #5 covers the connection cause.
  - A1 adds field-level messages ("Enter a 10-digit phone number") and phone/email format checks.
- **Affects:** customer records. No change to existing customers.
- **Acceptance:**
  - With the server stopped, the form explains that the connection was lost and what to do.
  - A missing company name, a bad email or a duplicate customer each give a specific message next to the field.
  - A valid customer is created and selected.
- **Decision needed:** M-04 (is a phone number required for commercial customers?).

#### CRM-004: Every form explains what went wrong and what to do
- **Source:** DOC p.2 ("we need guidance from the crm whenever an input form or data is done and there is a reason the crm cannot continue").
- **Current CRM:**
  - Server errors carry a message.
  - Connection errors are explained since PR #5.
  - Some screens still show technical or vague text, or rely on the server refusing without first showing why a button is unavailable (backlog UI-01).
- **Recommended solution:**
  - In A1, review every data-entry form (customers, vehicles, estimates, line items, payments, scheduling, operations, pricing).
  - Each failure says what happened and the next step.
  - Buttons that cannot be used say why.
  - Add a list of standard message wordings to the docs.
- **Acceptance:**
  - For each form: trigger a missing-field error, a permission error and a lost connection. Each message is plain English and names the next step.
  - Automated checks cover the most common forms.
- **Decision needed:** none.

#### CRM-005: Suggestions after 3 characters in every search
- **Source:** DOC p.18.
- **Current CRM:**
  - The shared customer search starts at **2** characters and shows suggestions while typing. It is used in New Estimate, the Customers page, Merge and the top search bar.
  - The top bar's job and invoice search starts at 1 character, and only searches jobs and invoices already loaded.
  - The Estimates, Invoices and Jobs lists have **no text search**.
  - There is no Vehicles list.
- **Recommended solution:**
  - One shared search with suggestions from the 3rd character, a short typing pause, and server-side matching.
  - Used in every search box: New Estimate, New Work Order, the top bar, and the Customers, Estimates, Invoices, Jobs/Work Orders and Operations lists.
  - Exception: phone numbers start matching at 3 digits; VINs and plates at 3 characters.
- **Affects:** speed with large customer lists (tested with thousands of demo records). Permissions: search results only show what the user may see.
- **Acceptance:**
  - In each box, 2 characters show nothing; 3 characters show matching suggestions within about a second.
  - Search by name, company, phone, email, VIN, plate, year/make/model, street, city, customer number and estimate/invoice/work order number.
  - Works on phone.
- **Decision needed:** M-09 (minimum characters for phone numbers).

#### CRM-006: Search by every useful field
- **Source:** DOC p.18 (vehicle, email, phone, address, customer name, VIN "and any other searches"); OWNER §4A (company, vehicle, address).
- **Current CRM:**
  - The customer search covers first, last and company name, email (including contacts), phone (4+ digits), customer number, street (not city), VIN/HIN, plate, year/make/model, asset name, and estimate/work order/invoice numbers.
  - City, ZIP and the estimate/invoice lists themselves are not searchable.
- **Recommended solution:**
  - Add city, ZIP, the contact person's name, and the vehicle/asset name.
  - Use the same matching rules everywhere (A2).
- **Acceptance:** see CRM-005.
- **Decision needed:** none.

#### CRM-007: Choosing a result brings up the whole file
- **Source:** DOC p.18 ("have the program bring up all the associated data in the file").
- **Current CRM:**
  - In New Estimate, choosing a result selects the customer and then asks for the vehicle.
  - On the Customers page it offers Open profile, New Estimate and New Work Order.
  - The top bar opens the record.
- **Recommended solution:**
  - Each suggestion shows enough to tell similar customers apart (company, phone, last vehicle).
  - Choosing a result opens or fills everything linked to it:
    - customer, contacts, vehicles and assets
    - open estimates, work orders and invoices
    - balance
  - In New Estimate, choosing a **vehicle** result fills both customer and vehicle.
- **Acceptance:**
  - Searching by VIN in New Estimate fills customer and vehicle in one step.
  - The top search opens the customer file with all linked records listed.
- **Decision needed:** none (confirm the behavior during testing).

#### CRM-008: Customer creation and editing
- **Source:** OWNER §4A.
- **Current CRM:**
  - Customers page create/edit, duplicate warning, and merge with field-by-field choices.
  - Tax-exempt status and credit limit can only be changed by management and accounting (Phase 1).
  - Inline creation in New Estimate (PR #4).
- **Recommended solution:** verify during A1. Fix only what testing shows is broken.
- **Acceptance:**
  - Create, edit, duplicate-warn and merge customers.
  - Changes persist after sign-out and back in.
  - Tax-terms fields are blocked for advisors.
- **Decision needed:** none.

#### CRM-009: Vehicle creation and linking
- **Source:** OWNER §4A.
- **Status:** Approved and Merged (PR #4):
  - VIN-only vehicles
  - typed year/make/model
  - VIN already on another customer: warning, then a new record
  - the vehicle stays linked after reopening
- **Plan:** re-check in A1's screen-health run. Searching by vehicle is in A2.

#### CRM-010: Employee roles and permissions review
- **Source:** OWNER §4A; DOC p.9, 25 (management-only pricing, dashboard permissions).
- **Current CRM:**
  - 8 roles: owner, administrator, manager, service advisor, technician, support, accountant, auditor.
  - Permissions are enforced on the server (Phase 1).
  - There is no service writer role, no salesperson flag, and no "can see dashboards" permissions yet.
- **Recommended solution:**
  - A1: the salesperson flag (CRM-002), and a printable "who can do what" table in the docs.
  - E2: dashboard permissions (DASH-012).
  - C2: a permission to see upholstery rates, separate from seeing prices.
- **Decision needed:** M-01, M-02 now; M-24 before E2.

#### CRM-011: Server connection and Codespaces reliability
- **Source:** OWNER §4A, §7 (pricing matrices appeared empty when the demo lost its server).
- **Status:** Ready for Testing (PR #5):
  - clear connection messages instead of empty screens
  - the version label in the sidebar
  - the log terminal that keeps the codespace active
  - automatic rebuild and restart when the running server is out of date
  - 41 browser checks, including connection-failure tests
- **Remaining:** QA-001 (every screen checked automatically) in A1.

#### CRM-012: General usability and navigation problems
- **Source:** OWNER §4A.
- **Current:** no specific list has been provided beyond the items in this register.
- **Recommended solution:** management sends a short list of the screens that are hardest for employees (M-03). Small items go into A1 or A2; larger ones get their own entry here.
- **Decision needed:** M-03.

#### QA-001: Automatic "every screen loads" regression check
- **Source:** OWNER §7.
- **Current:**
  - Browser checks cover the estimate, PDR pricing and connection-failure paths.
  - They do not open every screen.
- **Recommended solution:**
  - A1 adds a check that signs in as the demo owner and opens every main screen and every Pricing Matrix tab, plus the print catalog and Scheduling.
  - It fails if any screen shows an error, an empty table where data must exist, or "$0.00" where a price should be "Not priced".
  - It runs in CI and with `demo.sh selftest`.
- **Acceptance:** stopping the server mid-run produces the plain-English message on the screen being tested, and the check reports it.

#### QA-002: Guard the demo against production data
- **Source:** OWNER §8.
- **Current:**
  - `demo.sh` uses its own database in `/workspaces/.repairpro-demo` and never reads `DB_PATH`.
  - Demo data is opt-in.
  - Demo emails go to files only.
- **Recommended solution:**
  - Mark the demo database as "DEMO" inside the database.
  - The demo server refuses to start on a database without that mark.
  - A normal server refuses to start on a database that has it.
  - Show a "DEMO DATA" banner in the app header.
- **Acceptance:** pointing the demo at a copy of a non-demo database stops with a clear message.

#### QA-003: A demo login for every role
- **Source:** OWNER §7 (permissions must be tested); AUDIT (the demo has only the owner login).
- **Recommended solution:** `demo.sh` creates demo logins for manager, service advisor, support, technician, accountant and auditor. Their passwords are listed in `DEMO-LOGIN.md`.
- **Acceptance:** each login can sign in and sees only what its role allows.

### Section B: PDR, hail and R&I estimating

#### PDR-001 to PDR-010: Phase 2.1 and 2.2 PDR work
- **Source:** OWNER §4B; approved Phase 2.1 and 2.2 decisions A–G and requirements 1–8.

| ID | Item | Status |
|---|---|---|
| PDR-001 | Saved individual dents and damage map | Approved and Merged (PR #4) |
| PDR-002 | Editable standard PDR prices (owner, administrator, manager) | Ready for Testing (PR #5) |
| PDR-003 | Crease prices: length range × severity × vehicle category; empty until management enters them | Ready for Testing (PR #5) |
| PDR-004 | Dent size, length, severity, location difficulty and internal notes | Records merged (PR #4); price effect via adjustments Ready for Testing (PR #5) |
| PDR-005 | Suggested price per dent; overrides record who, when, why and the suggested price; "Pricing incomplete", never $0 | Ready for Testing (PR #5) |
| PDR-006 / PDR-007 | Panel and whole-vehicle packages at a typed price, showing the difference in $ and % | Ready for Testing (PR #5) |
| PDR-008 | Discounted packages need owner, administrator or manager approval; a price change needs re-approval | Ready for Testing (PR #5) |
| PDR-009 | Lines follow the billing method; "Show dent details to customer" switch; the paint answer and notes are never shown | Ready for Testing (PR #5) |
| PDR-010 | Each dent billed exactly once; tax, invoice locks, payments and hail unchanged | Ready for Testing (PR #5) |

- **Acceptance:** the Phase 2.2 owner checklist in `docs/ACCEPTANCE-AND-TESTS.md`. The automated version is 32 browser checks, `script/phase22-acceptance.mjs`.
- **Decision needed:** owner approval to merge PR #5.

#### PRC-001: Printing the pricing catalog gives a 404
- **Source:** DOC p.42 ("Catalog request failed (404). Please retry.").
- **Current CRM:**
  - The print route exists and is registered. Nothing in RepairPro itself answers 404 for it.
  - The exact wording the owner saw only exists in the older `main` version. PR #5 replaced it.
  - The 404 came from something in front of RepairPro, most likely the Codespaces address answering for a stopped or outdated server.
  - PR #5 detects an outdated build and restarts it, and explains connection failures in plain English.
- **Status:** Ready for Testing (PR #5).
- **Acceptance:**
  - On PR #5's demo (sidebar shows Version 259c20d), Pricing Matrix → Print all pricing opens the full catalog.
  - With the server stopped, it explains what to do.

#### PRC-002: Pricing matrices look empty or show $0.00
- **Source:** DOC p.42 ("0 stored entries across 0 categories"; Interior Vinyl all $0.00).
- **Current CRM, two separate causes:**
  1. **"0 stored entries across 0 categories"** means the page received no data.
     - A normal demo database has 9 categories of sample prices; Interior Vinyl, for example, has crack $75 / $125 / $200.
     - On the older version, a failed load looked like an empty matrix.
     - PR #5 shows a clear "could not load" card instead. *Ready for Testing.*
  2. **Cells with no price show "$0.00" instead of "Not priced".** This happens on Generic Hail (SUV door and fender are always missing), Window Tint, Interior Vinyl and Interior Fabric. *Not Started (A1).*
- **Recommended solution:** A1 shows "Not priced" for every missing cell, matching the PDR rule that a missing price is never $0.
- **Affects:** display only. Estimates never used these blank cells as $0 automatically; the line editor requires a price.
- **Acceptance:** an empty cell reads "Not priced" on screen and in print. Filled cells are unchanged.

#### PRC-003: No way to edit amounts in the non-PDR matrices
- **Source:** DOC p.42 ("do not refer to a table where I can edit the amounts").
- **Current CRM:**
  - Only PDR Dent & Crease is editable (PR #5).
  - These tabs are read-only, with no edit screen at all: Generic Hail, Insurance Hail (legacy rows), Window Tint, Interior Vinyl, Interior Fabric, Upholstery (10 per-item prices), Labor Rates (5 hourly rates) and Materials (9 items).
  - Furniture splat prices are a fixed list inside the program, separate from the Upholstery tab.
  - All existing values are unverified sample prices (owner decision PRICE-01).
- **Recommended solution (B1):**
  - Management-only editing for each tab: the same permission as PDR, every change audited, "Not priced" for blanks.
  - Estimates keep the price they were given; there is an explicit "reprice" action, as with PDR.
  - Furniture splat list prices move into the database so management can edit them.
  - Insurance hail carrier rows are **not** made editable here; they wait for B2's source review.
- **Affects:** prices on new estimates. Existing estimates and invoices never change.
- **Depends on:** PR #5 merged (it reuses the PDR editor pattern). M-12 (keep or clear the unverified sample prices).
- **Acceptance:**
  - A manager edits a window tint price; a new estimate uses it; an older estimate is unchanged; the audit history shows the change.
  - An advisor cannot edit (blocked on the server, not just hidden).
  - The printed catalog shows the new value.
- **Decision needed:** M-12.

#### HAIL-001: Audit and test the existing hail estimator
- **Source:** OWNER §4B ("Do not assume the existing hail estimating system is production-ready").
- **Current CRM** (`docs/HAIL-ESTIMATING.md`):
  - Pricing is per panel: dent count and majority size.
  - State Farm automatic prices come from a transcribed matrix, revision 125278.13 dated 2025-04-29.
  - Every other carrier needs a typed amount.
  - Upcharges, oversized dents and R&I are separate lines, each requiring a remark.
- **Recommended solution (B2):**
  - Test hail estimates end-to-end in the browser: create, price, approve, convert to an invoice, print.
  - Check the published-range limits and the "not priced" cases.
  - Report every defect found before any change is made.
- **Acceptance:**
  - A hail estimate whose total is calculated by hand before the test matches the app exactly through invoice and print.
  - Counts outside the published range require a typed amount.
- **Decision needed:** none to audit; fixes may need decisions.

#### HAIL-002: Verify source, accuracy and currency of insurance hail matrices
- **Source:** OWNER §4B.
- **Current:**
  - State Farm has recorded source details (revision, date, link).
  - The other 8 carriers are legacy rows with no source, date or revision. They are labeled unverified and are never used automatically.
- **Recommended solution (B2):**
  - Add source fields (document title, revision, effective date, date checked, who approved) to every carrier matrix.
  - Show them on the estimate screen and in print.
  - Keep, replace or retire each carrier set only as management decides.
  - **No insurance pricing is invented or copied from sources the shop isn't entitled to.**
- **Depends on:** M-10 (which carrier agreements the shop holds), M-11 (current documents).
- **Acceptance:**
  - Every automatic price shows its source and date.
  - A carrier without an approved source still needs a typed amount.

#### HAIL-003: Hail source test cannot run
- **Source:** AUDIT.
- **Detail:** `script/hail-reference-test.ts` compares every State Farm cell against a text copy of the PDF at a path that does not exist in the repository.
- **Recommended solution (B2):** store the reference text, or a checksum and the page values, in the repository (if the source's terms allow it) and run the test in CI.
- **Acceptance:** CI runs the hail reference test.

#### RNI-001 to RNI-007: R&I (removal and reinstallation)
- **Source:** OWNER §4B; the Phase 2 design report (decisions F, G and I there are still open).
- **Current CRM:**
  - No R&I catalog, labor times or links to dents or panels.
  - What exists:
    - a "remove/install" repair action on line items
    - a manual "Removal and installation" line on hail estimates, which requires an amount and a remark

| ID | Item | Recommended solution | PR |
|---|---|---|---|
| RNI-001 | Expandable component catalog | Management adds or edits parts: name, which panels they give access to, vehicle categories, and safety flags. Starts with the shop's own part names only. | B3 |
| RNI-002 | Suggested labor times | Only times the shop records itself or is licensed to use, each with its source. No copying from CCC, Mitchell, Audatex or MOTOR without a license. | B3 (data via M-13) |
| RNI-003 | Editable rates and overrides | Management sets the R&I hourly rate(s). The estimator can override hours or price, with a reason. Who, when and the old value are recorded. | B3 |
| RNI-004 | One R&I serves many dents or panels | One R&I line links to several dents or panels and is charged once. | B4 |
| RNI-005 | R&I in PDR and hail | The same catalog on both estimate types. On hail it replaces the manual R&I line, which is kept on old estimates. | B4 |
| RNI-006 | Safety procedure checks | Parts flagged for airbag, sensor, ADAS, electrical or structural work show "check the manufacturer procedure for this exact vehicle". The estimator records the procedure checked, or "not available" with a reason. Approval is blocked until that is recorded (if decision I is "block"). | B3 |
| RNI-007 | No duplicate R&I labor | The database refuses a second charge for the same R&I on one estimate. A package can include R&I only when chosen; its own line then shows $0. | B4 |

- **Affects:** pricing and line items. Labor is untaxed today. Packages and approvals (PR #5 rules) also apply to R&I in a package.
- **Depends on:** PR #5 merged; B1 (labor rate editing); M-13, M-14, M-15.
- **Acceptance (summary):**
  - One headliner R&I linked to 5 roof dents appears once on the estimate and the invoice.
  - Removing it un-links the dents without deleting them.
  - A flagged part blocks approval until a procedure is recorded.
  - A hail estimate can add the same R&I.
  - Totals match hand-calculated expected values.

### Section C: Upholstery and furniture estimating

**Before C2 and C3:** the McDowells Upholstery Yardage Guide and workbook are **not finished** (owner, 2026-10-16). Until they are delivered:
- The yardage values in the Word document (pages 10–17 and 36–41) are treated as **unverified planning references only**.
- Nothing is imported as final data.
- No yardage, cutting chart, manufacturer specification or price is invented.

**Reminder:** ask management for the completed guide, workbook and supporting files when C2 is approved to start.

#### UPH-001: Upholstery material calculator inside the estimate
- **Source:** DOC p.4–6 (five categories: restaurant booths, medical examination tables, dental chairs and stools, chiropractic tables, massage tables).
- **Current CRM:**
  - No yardage calculation.
  - Upholstery lines are typed by hand, or priced from a fixed furniture panel price list × a severity factor.
  - "yard" exists only as a unit choice.
- **Recommended solution (C3):**
  - An optional "Upholstery materials" card in section 3 of the estimate.
  - It creates ordinary material and labor line items, so tax, totals and invoices work as they do today.
  - It stores the measurements and calculation with the estimate.
- **Depends on:** C1 (diagrams), C2 (rates), and the finished guide (M-30).

#### UPH-002: Individual components (default) or complete reupholstery
- **Source:** DOC p.5–6 ("individual components as the default").
- **Solution:**
  - Choose the equipment type, then tick components on the diagram (C1) or in a list.
  - "Complete reupholstery" selects them all.
  - Material and labor are calculated only for the selected components.

#### UPH-003: Component measurements; 54-inch roll by default
- **Source:** DOC p.6–7, p.10.
- **Solution:** for each component: finished length, width, thickness, quantity, wrap/return per edge and seam allowance, all in inches. Roll width is 54" by default and can be changed per estimate.
- **Acceptance:** DOC test 1: a 60" cut on a 54" roll warns and requires a seam or rotation decision.

#### UPH-004: Cutting layout and nesting
- **Source:** DOC p.6–7, p.10 ("Do NOT use surface area / roll width as the final algorithm").
- **Solution:**
  - Cut pieces are packed across the roll width, respecting grain direction (directional material cannot rotate 90°) and pattern repeat.
  - Total length ÷ 36 = yards.
  - A simple layout picture is shown.
- **Acceptance:**
  - DOC test 2: two pieces side by side use less material than one after the other.
  - DOC test 3: directional material does not rotate.

#### UPH-005: Calculated vs ordering yardage, rounding and waste
- **Source:** DOC p.7 (round up to the nearest ¼ yard; waste 15% to start, adjustable; show both calculated and ordering yardage), p.10 (round up to the vendor's purchase increment).
- **Conflict to resolve (M-31):** the document says to apply a 15% waste allowance, but also says reference ranges "already include rough waste; don't add the default allowance again".
  - **Recommendation:** apply waste only to measured layouts, never to reference ranges.
- **Acceptance:**
  - DOC test 4: quantity 3 multiplies the range, with no hidden extra waste.
  - The calculated and ordering yardage are both shown.

#### UPH-006: Recommended labor hours with an override
- **Source:** DOC p.7–8.
- **Solution:**
  - Each component has a recommended labor-hour range, set by management.
  - The estimator sees the recommendation, and can override it with a reason. Both the recommended and the overridden hours are kept.
  - Disassembly and reassembly are counted once per piece, not once per component.
- **Note:** the document's preliminary hours (booth seat 1–2 hours, etc.) are **not** loaded as standards (the document says they "should be calibrated").
- **Acceptance:** DOC test 5: an override is kept and labeled.

#### UPH-007: Management-only labor rate matrix by equipment category
- **Source:** DOC p.8–9.
- **Solution:**
  - Rates for each of the 5 categories, plus optional per-component rates, complexity multipliers and minimum charges.
  - A **new permission** separates "see upholstery rates" from seeing prices. Estimators see the hours and the calculated charge, but not the rate table. This is enforced on the server.
  - The document notes estimators could still work out the rate by dividing; that can't be prevented.
- **Decision needed:** M-32 (rates; who may approve overrides).

#### UPH-008: Old estimates keep the rates they used
- **Source:** DOC p.9–10.
- **Solution:** the same approach as PDR. Each estimate stores the rate, hours, measurements and yardage used. A rate change affects only new calculations, or an explicit, audited reprice.

#### UPH-009: Management → Upholstery Pricing screen
- **Source:** DOC p.9 (later expandable to automotive, marine, RV and furniture upholstery).
- **Solution:** a new tab on the Pricing Matrix page, built in C2. Categories are stored as data, so new ones can be added without programming.

#### UPH-010: Quick estimate by category → style → quantity
- **Source:** DOC p.10 (low/midpoint/high × quantity, labeled "Preliminary / field verify").
- **Status:** Blocked: it needs the finished guide's verified ranges (M-30).

#### UPH-011: Safeguards
- **Source:** DOC p.10.
- **Solution:**
  - Material yardage is kept separate from foam, thread, adhesive and freight lines.
  - The source and revision of each calculation is recorded.
  - Numbers use exact decimal math.
  - For medical and dental work, prompts ask about manufacturer material requirements, cleanability or disinfectant compatibility, and flame performance. The CRM never claims any regulatory certification.

#### UPH-012: The document's six acceptance tests
- **Source:** DOC p.10.
- **Plan:** all six become automated tests in C3:
  1. A 60" cut on a 54" roll warns.
  2. Pieces side by side use less material.
  3. Directional material does not rotate.
  4. Quantity 3 multiplies the range, with no hidden waste.
  5. An override is kept and labeled.
  6. All five categories import with distinct styles.

#### UPH-013: Import reference yardage data
- **Source:** DOC p.10–17 (26 styles, all marked `verified=false`); p.36–41 (30 components, marked "schematic_reference_not_validated").
- **Status:** Blocked (M-30).
- **Data problems found in the document:**
  - Booth records list a "typical thickness" of 36–54 inches. That looks like **height**, not thickness.
  - The style ranges (p.10–17) and component ranges (p.36–41) use different names and categories ("Dental chairs and stools" vs "Dental chairs").
  - The document itself says never to add the component ranges together.
  - The finished guide should resolve these.

#### UPH-014: Clickable component diagrams for the five categories
- **Source:** DOC p.28–41 (component IDs RB01–RB06, ME01–ME06, DC01–DC06, CT01–CT06, MT01–MT06).
- **Current CRM:** there are no booth, medical, dental, chiropractic or massage diagrams in the modern diagram system. Booths have only the old side and top drawings.
- **Solution (C1):**
  - New schematic diagrams drawn for RepairPro, with clickable components using the document's IDs.
  - The 5 product photos in the document come from retailer websites. They are used only as visual references and are **not** copied into the CRM (copyright).
- **Acceptance:** each category's diagram shows its 6 components. Clicking one selects it on the estimate. The diagrams work on a phone.

#### UPH-015: Optional foam, padding and other materials
- **Source:** DOC p.6, p.10.
- **Current:** a "foam replacement" repair action and seeded material prices (foam per square foot) exist. They are not linked to components.
- **Solution (C2/C3):** foam, batting, backing, piping, buttons and thread per component, as separate lines priced from the Materials matrix (B1).

#### FURN-001: Many more furniture and booth splat options
- **Source:** DOC p.43 ("only three options … Club Chair, Wingback Chair, Legacy Chair Diagram. Please provide a lot more options including" followed by a picture, but **no list**).
- **Current CRM:**
  - The "Style / variation" dropdown lists styles for the piece type.
    - Chairs have 3 (club, wingback, classic/legacy).
    - Sofas 5, loveseats 2, recliners 3, dining chairs 3, ottomans 3, marine 2.
  - Booths, RV, hotel, office and medical pieces have **no styles**. Most of them fall back to "chair", which is why only the 3 chair styles appear.
- **The picture:** a third-party "Reupholstery Guide: Arm Chairs & Recliners" chart (© 2017 Leather Hide Store) showing about 52 chair, recliner and ottoman styles with leather yardages.
  - The style names can be a candidate list.
  - The chart's yardage numbers are a different company's leather estimates. They are **not** imported.
  - The drawings are not copied.
- **Solution (C1):**
  - Add booth, medical, dental, chiropractic and massage piece types (UPH-014).
  - Add the furniture styles management confirms, drawn as simple schematic diagrams with standard zones.
  - Fix the "falls back to chair" problem for hotel, office, RV and other pieces.
- **Decision needed:** M-28 (the confirmed style list, in priority order).

#### FURN-002: Booth styles
- **Source:** DOC p.11–12.
- **The six booth styles:**
  - single booth (back + seat)
  - double booth
  - channel-tufted
  - high-back
  - curved / radius
  - banquette (per linear foot)
- **Solution (C1):** booth styles with the components seat cushion, backrest, left and right end panels, top cap / head roll, and kick panel / base (DOC p.36).

### Section D: Scheduling, work planning and operations

#### SCHED-001: Capacity calendar showed "Failed to fetch"
- **Source:** DOC p.19 (Scheduling page; the document calls it "the dashboard screen").
- **Current:**
  - "Failed to fetch" is the browser's text for "could not reach the server". The calendar's server route exists and works.
  - Since PR #5, the calendar shows the plain-English connection message instead.
  - The empty "No jobs" week shows nothing has been scheduled in the demo yet.
- **Status:** Ready for Testing (PR #5).
- **Acceptance:** on PR #5's demo, Scheduling → find next opening returns a time (or "no opening in 60 days" with the reason).

#### SCHED-002: Scheduling technicians: availability and assignments
- **Source:** OWNER §4D.
- **Current CRM: two schedulers exist side by side.**
  1. The new **capacity calendar**:
     - technician working hours, leave, shared bays and equipment
     - next-opening search (Boise time)
     - the database blocks double-booking
  2. The **legacy** dispatch board, technician roster and booking requests, shown in a collapsed section.
- **Recommended solution (D1):**
  - One scheduling screen: a week or day view per technician and department, drag or click to schedule an approved work order, with the capacity rules enforced.
  - Retire the legacy board once its booking-request handling moves over.
- **Decision needed:** M-19 (who schedules; working hours source).

#### SCHED-003: Labor hours sold vs actually worked
- **Source:** OWNER §4D; DOC p.23.
- **Current:**
  - Estimated minutes per production task exist.
  - Time entries exist (productive, rework or travel), but without clock in/out or billable/non-billable.
- **Solution (D2):**
  - Sold hours come from approved labor lines.
  - Worked hours come from technician time entries (SCHED-009).
  - Show both per job and per technician.

#### SCHED-004: Scheduling gaps and department capacity
- **Source:** OWNER §4D; DOC p.23–24.
- **Current:** a next-opening search only.
- **Solution (D1):**
  - Remaining hours per department and technician for the next 1, 3, 7, 14 and 30 days.
  - Highlight gaps and overloads.
  - Clicking a gap lists approved, unscheduled jobs that fit it.

#### SCHED-005: Open and unscheduled work orders
- **Source:** OWNER §4D.
- **Current:** the Operations screen counts unscheduled, in-progress, on-hold, overdue and completed-not-billed work.
- **Solution (D1):** a "waiting to be scheduled" list sorted by approval date and promised date, with scheduling buttons.

#### SCHED-006: Job status and completion tracking
- **Source:** OWNER §4D.
- **Current:** production cases with stages, promised and forecast dates, holds, parts readiness, QC and tasks. It works but has not been tested by the owner.
- **Solution:** verify in D1. Fix what testing finds.

#### SCHED-007: Technician productivity
- **Source:** OWNER §4D; DOC p.23.
- **Current:** an efficiency figure on Operations. Technician net labor production report.
- **Solution:** D2 (data), E3 (scorecards).

#### SCHED-008: Scheduling stays at the bottom of the estimate page
- **Source:** OWNER §4D.
- **Status:** Approved and Merged (PR #4). A standing rule. Every later PR's browser test checks the section order.

#### SCHED-009: Technician time clock
- **Source:** OWNER §4D; DOC p.23 ("missing time punches").
- **Solution (D2):**
  - Start/stop time on a job from the phone: billable, non-billable, travel or rework.
  - Corrections by a manager, with a reason.
  - No payroll calculation (backlog FIN-01).
- **Decision needed:** M-21 (is there an outside time clock or payroll system?).

#### RNI-008: R&I tasks carried into work orders
- **Source:** OWNER §4D.
- **Solution (D1):** approved R&I lines (from B4) become production tasks, with the procedure-check note attached for the technician.
- **Depends on:** B4.

### Section E: Operations dashboard and reporting

The document's own build plan (DOC p.26, §13) is followed: audit → metric dictionary → mockup → code → validation. **Phase A of that plan (the data audit) is in `MASTER-PLAN.md` §6.**

| ID | Item (DOC section) | Current CRM | PR |
|---|---|---|---|
| DASH-001 | Dashboard lacks useful information (p.19) | 8 count tiles plus recent jobs, activity and estimates. No targets, trends or comparisons. | E2 |
| DASH-002 | Executive overview (§1, p.21–22) | Not built. Booked sales, invoiced, collected and AR can be calculated today. Utilization and efficiency cannot (no reliable hours). | E2 |
| DASH-003 | Departments (§2, p.22) | Departments are stored on production cases. The document's list (Mobile Exterior, Mobile Interior, Auto Shop, Upholstery, Furniture/Home Repair) **does not match** the CRM's (PDR/Hail, Window Tint, Interior Repair, Upholstery, Furniture/Commercial). | E1 (data), E3 |
| DASH-004 | Customer segments (§3, p.22–23) | Free-text customer type. No parent accounts or locations. | E1, E3 |
| DASH-005 | Labor and technician scorecards (§4, p.23) | Needs D2 time data. Sales credits and labor credits exist. | D2, E3 |
| DASH-006 | Scheduling capacity (§5, p.23–24) | Capacity engine exists. | D1, E3 |
| DASH-007 | Front lobby sales (§6, p.24) | No walk-in, call or lead records. No lost-reason list. No declined date. | E1, E3 |
| DASH-008 | Outside sales and dealer visits (§7, p.24) | Not captured at all. | E1, E3 |
| DASH-009 | Financial health and AR (§8, p.24–25) | Invoices, payments, partial payments and an AR aging calculation exist. **No refunds or credits** (backlog BILL-01). Costs are incomplete. | E2, E3 |
| DASH-010 | Layout, tabs, drill-downs, export (§9, p.25) | The report builder has CSV export and saved layouts. | E2, E3 |
| DASH-011 | Metric dictionary and data quality (§10, p.25) | Not written. | E1 (draft), E2 |
| DASH-012 | Permissions (§11, p.25) | Server-side permissions exist. Dashboard-specific ones are not built. | E2 |
| DASH-013 | Alerts and goals (§12, p.26) | Not built. | E3 |
| DASH-014 | Build plan (§13, p.26) | Audit done in this plan. A mockup is required before coding E2. | E1–E3 |

- **Standing rules (from the document and the owner):**
  - Never show made-up numbers. Missing data is shown as missing, never as 0.
  - Keep booked, completed, invoiced and collected separate.
  - Departments add up to the company total.
  - Work by several technicians is never counted twice.
  - Tax is separate from revenue.
- **Acceptance (DOC p.26):**
  - department revenue sums to company revenue
  - segments reconcile
  - no double-counted technician credit
  - open and decided quotes are distinguished
  - capacity excludes leave
  - restricted data is blocked on the server
  - every card shows its "as of" time
  - incomplete data is labeled
- **Decisions needed:** M-20 to M-27.

### Section F: Marketing and customer communications

#### MKT-001: Marketing audit (results)
- **Source:** OWNER §4F.

| Feature | Today | Working? |
|---|---|---|
| Campaign records | Table and API exist. The Marketing page is read-only; "New campaign" is disabled. Counters are typed by hand. | Stub only (backlog MKT-01) |
| Email | Single estimate and invoice emails only, through SMTP. **No credentials configured**, so nothing is sent; copies are saved as files. | Works once configured |
| SMS / WhatsApp | Not connected | No |
| Follow-ups | A manual follow-up queue per estimate (owner, next date, state, reason) | Yes, manual. No reminders. |
| Referrals | Free-text "referral source" on the customer | Minimal |
| Segmentation | Free-text customer type; campaign "target segment" | Minimal |
| Customer history | Activities log, service history, customer page | Yes (needs verification) |
| Online booking requests | Created through the booking page; staff confirm or decline | Yes, behind staff sign-in (backlog INT-05) |

| ID | Item | Recommended solution | PR |
|---|---|---|---|
| MKT-002 | Customer communications | Connect a real email provider only after the security and deliverability review. Keep the test-mailbox rule until then. | F2 |
| MKT-003 | Campaigns and follow-ups | Campaign creation, audience from segments, unsubscribe handling, and actual delivery results. Requires that review. | F2 |
| MKT-004 | Referral tracking | A standard lead-source and referral list (E1), with "referred by customer" linking. | E1 / F1 |
| MKT-005 | Customer history | Verify the customer file shows all history (A2 test). | A2 |
| MKT-006 | Leads and opportunities | A lead record (walk-in, call, web, dealer visit) that can turn into an estimate. Shared with the dashboard. | E1 / F1 |
| MKT-007 | Marketing reporting | Campaign results from actual records, not typed counters. | F1 / F2 |
| MKT-008 | Follow-up reminders | Due follow-ups on My Work and the dashboard. Optional reminder email once F2 exists. | F1 |
| MKT-009 | Dealer and business outreach | Dealer visit log (E1) and target-dealer list, with "days since last visit". | E1 / F1 |
| MKT-010 | Segmentation | A fixed, management-editable segment list (DOC §3), with an audit trail. | E1 |

- **Rule:** no external email sending or integrations until a separate security and deliverability review is approved (OWNER §4F).

### Section G: Accounting, taxes and financial controls

**No tax rule is changed until the accountant confirms the treatment under Idaho rules (OWNER §4G).** The CRM already links the Idaho State Tax Commission's guide for repair shops.

#### TAX-001: No sales tax on labor
- **Source:** DOC p.1.
- **Current CRM:**
  - Repair labor in every service (PDR, hail, tint, interior, upholstery, general) is **not taxed**.
  - **Exception:** "New fabrication labor (taxable)" on upholstery services **is** taxed. It was added earlier because fabricating a new item is generally treated differently from repair.
- **Conflict:** the document says "no tax on labor"; the current fabrication category taxes some labor.
- **Decision needed:** M-05.

#### TAX-002: Tax parts at 6% by default on estimates and work orders
- **Source:** DOC p.1.
- **Current CRM:**
  - Parts and materials sold to the customer are taxed at the estimate's rate. New estimates start at 6% and the rate can be changed per estimate.
  - Tax-exempt customers are not taxed.
  - Shop-consumed supplies are not charged tax.
  - Work orders and invoices take the tax from the estimate.
- **Status:** Already Implemented — Needs Verification. The rule matches the request. Verify with the accountant's test cases in G1.

#### TAX-003: Tax shipping at 6%
- **Source:** DOC p.1 ("6 percent on the shipping listed as well").
- **Current CRM:**
  - "Freight-in passed through to customer" **is** taxed.
  - "Separately stated delivery to customer" (freight-out) is **not** taxed.
- **Conflict:** the document says to tax shipping; freight-out is currently untaxed.
- **Decision needed:** M-06.

#### TAX-004: Option not to tax parts or shipping when the shop pays use tax
- **Source:** DOC p.1.
- **Current CRM:**
  - Use tax can only be recorded on shop-consumed supplies, as an internal figure.
  - There is no per-line or per-estimate "don't charge sales tax on this, we paid use tax" switch.
- **Recommended solution (after M-07):**
  - A per-line "Sales tax: charge / not charged — use tax paid by shop" choice.
  - Only roles with tax permission can change it.
  - A note is required.
  - The choice prints only as "non-taxable" on the customer document, and appears on a use-tax report for the accountant.
- **Affects:** taxes, invoices and accounting exports (QuickBooks later).
- **Decision needed:** M-07.

#### TAX-005: Change tax treatment on the work order after the customer approves
- **Source:** DOC p.1 ("with the option of the estimator or to edit the work order after the estimate is approved by the customer").
- **Current CRM:**
  - Before production starts, edits to an approved estimate are allowed, but they send it back to draft for re-approval.
  - After production starts, or once invoiced, line items and totals are locked by the database.
- **Conflict:** the request asks for editing after approval. The locks exist to protect approved amounts.
- **Recommended solution:**
  - Allow a **tax-treatment change only** (not prices) on a work order before invoicing, by permitted roles, with a reason.
  - It is recorded in the audit history.
  - The customer sees the changed total before invoicing.
  - Invoices stay locked.
- **Decision needed:** M-08.

#### TAX-006: Settings "Sales Tax Rate" box is not connected
- **Source:** AUDIT.
- **Detail:**
  - Settings shows a Sales Tax Rate of 6.00 that saves nothing.
  - A tax jurisdiction table exists but is not used.
  - The 6% default is built into the program.
- **Solution (G1):** either connect it as the default for new estimates (management-only, audited) or remove it. It must never change existing estimates.

#### FIN-001: Preserve financial behavior (standing rule)
- **Source:** OWNER §4G.
- **Rule:** every PR must leave these unchanged unless an approved entry here says otherwise:
  - invoices, payments and balances
  - tax calculation
  - approval locks and audit protection
- The calculation, security and release-integrity test suites must pass on every PR.

#### FIN-002: Financial changes needing accounting approval
- **Source:** OWNER §4G.
- **List:**
  - TAX-001 to TAX-006
  - BL-EST-01 (legacy unclassified lines)
  - BL-BILL-01 (credits and refunds)
  - BL-INT-01 (QuickBooks mapping)
  - Dashboard gross-profit rules (M-23)
- Details and timing are in `MANAGEMENT-DECISIONS.md`.

---

## Owner retest list, 2026-10-20 (source: OWNER-1020)

| ID | Requirement | Current CRM | Status | PR | Priority | Type |
|---|---|---|---|---|---|---|
| PDR-011 | A second crease length range could not be added | A range sharing an inch with the first (1"–6" then 6"–12") is refused, but the reason showed at the top of the page, out of view. | **Fixed on PR #5 (b73d9d5)**, Ready for Testing | PR #5 | P1 | Approved |
| CRM-013 | Section 2 says "dent details" on furniture and other non-dent estimates | Heading is now "Damage map and damage details" except on PDR and hail | **Fixed on PR #5 (b73d9d5)**, Ready for Testing | PR #5 | P2 | Approved |
| PDR-012 | Left and right roof rails on every body style's diagram and in the price list (glue-pull only, high difficulty) | Not on any diagram | Not Started | B0 | P1 | Approved |
| PDR-013 | "Original factory paint or repainted?" per damaged panel; repainted panels cannot be glue pulled | Not asked | Not Started | B0 | P1 | Approved |
| PDR-014 | "Aluminum or steel?" per panel; aluminum is harder (a price adjustment) | Not asked | Not Started | B0 | P1 | Approved |
| PDR-015 | Expected result: "% of original factory condition", printed on the estimate to set customer expectations | Not available | Not Started | B0 | P1 | Approved |
| SPL-001 | Non-PDR diagrams: each panel is Repair or Replace/Reupholster, each with its own customer price | Today a severity choice (minor = repair 60%, moderate = reupholster, severe = reupholster + foam) | Not Started | B1 | P1 | Approved |
| SPL-003 | Two ways to start the same estimate: (a) open **Splats**, mark damage, choose a customer, create the estimate with the marks carried in; (b) open a customer, choose a splat, create the estimate. Both give the same result. | Splats menu page is reference only (marks are not saved); estimates start from Estimates or the customer | Approved (2026-10-22), "first option" | S0 (proposed, after A1) | P1 | Approved |
| SPL-004 | On every non-PDR splat, each marked panel offers **Repair** and **Reupholster (replace)**, each priced from its own price table. The tables live in the Pricing Matrix tab and are **fully customizable** by management (items, damage types, sizes, prices, units). | Severity choice: minor = repair 60%, moderate = reupholster 100%, severe = reupholster + foam 125% of one fixed list price. Not editable. | Approved (2026-10-22); extends SPL-001 | U4 (tables) + S3/S6 (splat options) | P1 | Approved |
| SPL-002 | Exterior non-PDR services per panel: paint touch-up, paint correction, clear-coat scratch wet sand and buff, polish, ceramic coating | Not available as services or prices | Not Started | B1 | P2 | Approved |
| CRM-014 | Edit customer information from inside the estimate and return: emails, phones, SMS number, address, sales team, how they heard about us | Must leave the estimate | Not Started | A2 | P1 | Approved |
| CRM-015 | Estimate header shows full customer contact: company and individual name, type, address, town, ZIP, phone, email | Shows name, type and vehicle only | Not Started | A2 | P1 | Approved |
| CRM-016 | Line items: separate "what we charge the customer" from job costs (materials purchased, labor hours invested, freight, supplies, taxes) | One combined form, hard to understand | Not Started | A3 | P1 | Approved |
| CRM-017 | One estimate can hold several items and services (for example a car's dents and seats; a restaurant's booths and chairs; a hospital's exam tables and waiting room chairs) | One service and one item per estimate | Not Started; decided 2026-10-20 | A4 | P1 | Approved |
| CRM-018 | Demo invoice shows "QB Synced: QB-INV-1001", but no QuickBooks connection exists | Sample data label (backlog INT-01) | Not Started | A1 | P1 | Approved |
| FIN-003 | Correct unclassified legacy invoice lines and missing technician credits | Shown as "Needs classification"; deliberately not guessed | Blocked / Awaiting Decision (accountant, backlog EST-01) | G1 | P1 | Missing info |
| TEAM-001 | Salespeople list and profiles: what they sell, commission rates, which jobs they are on | Salespeople are staff logins with certain roles; no profile page | Not Started | D0 | P1 | Approved |
| TEAM-002 | Technician profiles: skill levels and types, work orders, several technicians per job, remove a technician | Technician list, labor split per line; no skills or profile page | Not Started | D0 | P1 | Approved |
| SCHED-010 | A booking conflict opens the calendar, shows the conflict, and offers to move the date or add a technician | Text message only: "cancel and rebook in Scheduling" | Not Started | D1 | P1 | Approved |
| SCHED-011 | Work order list shows the job address (especially for third-party pay), salesperson and technicians | Shows number, title, customer, service, status and urgency | Not Started | A2 | P2 | Approved |
| SCHED-012 | Dispatcher board for 30+ technicians and up to 60 jobs a day: drag and drop between technicians and days, workload view, sort by technician, area and skill | Two separate basic schedulers | Not Started | D1 | P1 | Approved |
| MKT-011 | Safe test-only email: inspect outgoing estimate and invoice emails without any risk of reaching customers | No email server is connected; copies are saved as files only (verified: every email is addressed to the test mailbox). Real sending stays **disabled** (decision 2026-10-21). | Not Started: a "Test outbox" screen and a single recipient allowlist check, proposed for A1. Real delivery testing is a separate approval later. | A1 | P2 | Approved |
| CRM-020 | Every customer has name, email, phone and complete address fields. Phone OR email is required for a normal record. A labeled temporary record is allowed for walk-ins. Missing information is flagged. Electronic sending needs a valid email. Duplicate checks apply to all records. | Only a name or company is required. No temporary status. Sending is not tied to the customer's email. | Not Started (decided 2026-10-21) | A1 | P1 | Approved |
| CRM-019 | Each estimate shows editable **Salesperson**, **Estimator** and **Follow-up salesperson**, using the existing Service advisor role. No duplicate sales-credit fields; existing sales-credit history preserved. | Sales team split, plus a separate planning salesperson | Not Started; decided 2026-10-20 and 2026-10-21 (replaces the checkbox idea in CRM-002) | A1 | P1 | Approved |
| RNI-009 | R&I name and price list, editable by management; add or remove R&I items on estimates; each item tied to vehicle type and body panel | Hail has one manual R&I line | Not Started; decided 2026-10-20 | B3/B4 | P1 | Approved |
| DOCS-001 | McDowells logo on every printed and emailed estimate, work order, invoice and statement | Printed documents show the business name as plain text, with no logo. There is no work order print or statement yet. | Not Started; **logo received 2026-10-21** (`docs/brand/mcdowells-logo.png`) | A1 (estimates, invoices); D1 (work orders); statements PR | P2 | Approved |
| MOB-001 | Every new or changed estimating screen is usable on phones and tablets in the PR that introduces it (tested at phone and tablet sizes). Advanced offline functionality comes later (M2). | Responsive layout; phone browser checks on key screens only | Approved (2026-10-21); applies to every PR | All | P1 | Approved |
| EST-003 | Every estimate line records attribution data (estimated labor hours, salesperson, planned technician(s), commission/bonus/production eligibility, estimated cost) and five classifications: service/skill type, item/industry type, operating department, delivery method, responsible team and technicians | Lines record category, cost and labor splits only | Approved (2026-10-21); calculation rules later | U2 | P1 | Approved |
| EST-004 | Separate work orders per item or one combined work order, linked to the estimate; scheduling works per task either way | One estimate → one job | Approved direction (2026-10-21); design in U0 | U0/U2/D1 | P1 | Approved |
| EST-005 | New approval for any customer price increase and any material scope addition or change; decreases documented without re-approval; internal cost changes need none; never silently change approved work; authorization history; per-account approval and PO policy | Approval resets on line edits; no per-account policy | Approved (2026-10-21) | U2 | P1 | Approved |
| HAIL-004 | Insurance hail prices and rules are carrier-specific, verified against the authorized matrix and its effective date; no generalized adjustments | State Farm transcription only | Approved (2026-10-21) | S2 | P1 | Approved |
| IDEA-001 | Phone camera VIN scan | VIN typed in, then decoded | Not Started | A2 | P2 | Proposed |
| IDEA-002 | Damage photos on estimates and invoices (before/after) | Not available | Not Started | later | P2 | Proposed |
| IDEA-003 | Customer price groups (for example dealer vs retail prices) | One price list | Not Started | B1 | P2 | Proposed |
| IDEA-004 | Technician pay types: hourly, commission %, flat fee, per client | Labor credit shares only | Not Started | D0 (record only) | P2 | Proposed |
| IDEA-005 | Customer signature to approve estimates and work orders | Approval is recorded by staff | Not Started | later | P2 | Proposed |
| IDEA-006 | Dealer and customer status portal (live vehicle status) | Not available (backlog INT-03) | Not Started | later | P3 | Proposed |
| IDEA-007 | Pre-job and post-job checklists on work orders | QC fields exist | Not Started | D1 | P3 | Proposed |
| IDEA-008 | Subcontractor (1099) technicians | Not distinguished | Not Started | D0 | P3 | Proposed |
| IDEA-009 | Monthly statements for dealer and fleet accounts | Not available | Not Started | later G | P2 | Proposed |


## Owner requests from A1 testing, 2026-10-22 (source: OWNER-1022)

| ID | Requirement | Current CRM | Status | PR | Priority | Type |
|---|---|---|---|---|---|---|
| CRM-021 | **Check that a phone number is in service and an email address is real** (not only typed correctly). Options: a phone lookup service (for example Twilio Lookup, about a cent per lookup; the number is sent to that company) and a confirmation email the customer clicks (needs real email sending turned on). | Typing checks only (CRM-022). Cannot tell whether a number or mailbox works. | **Planned for later** (owner, 2026-10-22). Needs a provider choice, a cost/privacy decision and the email-sending approval (MKT-011). | later (with real email) | P2 | Approved |
| CRM-022 | Phone and email typing checks on every customer save, with clear messages and one-click email typo fixes; duplicate check matches phone numbers with or without a leading 1 | Accepted anything | Ready for Testing (PR #8, 99cbb5d) | A1 | P1 | Approved |
| CRM-023 | New customer in New Estimate explains every missing item (company name required for business customers) instead of a greyed-out button | Button greyed out, small hint | Ready for Testing (PR #8, 99cbb5d) | A1 | P1 | Approved |
| CRM-024 | One People box: up to 3 salespeople with shares totalling 100%, estimator and follow-up salesperson | Two separate places that did not agree | Ready for Testing (PR #8) | A1 | P1 | Approved |
| CRM-025 | Discounts off labor, chosen from a discount code matrix (code, description, amount) or entered by hand with a description | One dollar amount, spread over all lines | Ready for Testing (PR #8). Tax effect (parts tax no longer reduced) to be confirmed by the accountant. | A1 | P1 | Approved |
| CRM-026 | Planned date before the estimate was created needs a warning and a deliberate override, recorded | Accepted any date | Ready for Testing (PR #8) | A1 | P1 | Approved |
| CRM-027 | False "record changed while you were editing" on every save | Blocked saves | Fixed, Ready for Testing (PR #8) | A1 | P1 | Approved |
| CRM-028 | People, discount, marketing source and schedule date editable on a work order in progress, until invoiced | Estimate page only | Ready for Testing (PR #8). Line items stay locked once production starts (supplement), unchanged. | A1 | P1 | Approved |
| MKT-012 | "How did the customer hear about us?" on every estimate from a management-maintained list; Referral records the referrer and adds them to a referral thank-you list | Free-text referral source on the customer only | Ready for Testing (PR #8) | A1 | P1 | Approved |
| CRM-029 | One number follows the repair: the estimate number shows on the work order, invoice, printouts and email, and is stored for the QuickBooks transfer | Separate numbers, not linked on documents | Ready for Testing (PR #8). Making the invoice number equal the estimate number is an open option for the bookkeeper. | A1 | P1 | Approved |
| SEC-010 | Change history showing who (name and login) changed what and when on customers, estimates and work orders | Audit log only on the Staff access page | Ready for Testing (PR #8) | A1 | P1 | Approved |
| SCHED-013 | **Waiting / to-be-scheduled work list.** Sold estimates and work orders not yet booked, each with dated follow-ups ("callbacks") of a type management maintains, optionally assigned to a person. Each type is its own queue (for example parts to order, researching parts, awaiting parts, insurance awaiting approval, to be scheduled, salesperson follow-ups, warranty). Parts outstanding warns before booking; "parts received" moves the job to ready to schedule. All changes recorded with the login. | Not available | **Designing**, waiting on the owner's answers (what SB, Frog, TBS and "Book Check out" mean; the work order status list) | later (after A1, with the scheduling stage) | P1 | Approved direction |


### Current software reference: RoadFS "Add Callback" types (owner screenshots, 2026-10-23)

RoadFS (McDo.RoadFS.com), the program being replaced, attaches dated **callbacks** to a work order. Each has a type, and each type works as a queue. The complete list of types:

Appointment Reminder · Awaiting Parts (ALL) · Book Check out · Estimate F/U · Furniture Awaiting Parts · HAIL F/U · Insurance Awaiting Approval · Insurance Claims F/U · Jenn Estimate F/U · Jenn In Progress · John Estimate F/U · Josh Estimate F/U · Megan Estimate F/U · Parts To Order (ALL) · Researching Parts · SB & Frog F/U · SB Active W/O & Estimate F/U · SB Parts To Order · SB TBS · Stacy Follow Up · Stacy Warranty · TBS (ALL) · Torson Follow Up

(F/U = follow-up; **TBS = to be scheduled**; **SB** = Sandra Benson and **Frog** = Paul (initials PE), both staff; **Torson** and **Stacy** are staff, confirmed by the owner 2026-10-23.) In the new CRM, per-person types (Jenn, John, Josh, Megan, Stacy, Torson) become one type plus an assigned person, so each person has their own list. See SCHED-013.

### Current software reference: RoadFS work order status (owner screenshot, 2026-10-23)

One status per work order (top right of the work order screen): **New · Estimate · Estimate - Will Call · Hold · Waiting on Parts · Assigned · Scheduled · In Progress · Completed · Cancelled.**

Proposed mapping to the new CRM (to confirm with the owner): New and Estimate = estimate draft/sent; Estimate - Will Call = sent, customer will call with a date (a "waiting on customer" follow-up); Hold and Waiting on Parts = sold but not schedulable, with the reason and dated follow-up from SCHED-013; Assigned = technician chosen, no time booked (shown on the calendar as "Planned - no time booked"); Scheduled = time booked; In Progress, Completed, Cancelled as today. Invoiced and paid remain separate steps.


## Owner answers on scheduling, technician pay, sales commission and billing, 2026-10-23 (source: OWNER-1023)

Answers to the questions about the RoadFS work order screen. **Recorded for design; nothing built yet.** Payroll and commission figures are business rules to confirm with the bookkeeper before any calculation is used for pay.

| ID | Requirement | Current CRM | Status | Stage | Priority | Type |
|---|---|---|---|---|---|---|
| SCHED-014 | A job can last **several days** and be spread over **several technicians**. It shows on **each day** with the specific start and stop times each technician works on it that day. | One booking per technician and time; multi-day jobs are separate bookings | Approved; design in the scheduling stage | D1 | P1 | Approved |
| SCHED-015 | Multi-technician jobs shown the clearest, simplest way (by technician, or grouped by job on that day). The dispatcher must see at a glance whether there is room for more work. | Seven-day board by technician with booked hours / capacity | Approved; design in D1 (with SCHED-012) | D1 | P1 | Approved |
| SCHED-016 | **"Ready to schedule" alert** when the last outstanding part arrives. | Not available | Approved (with SCHED-013) | D1 | P1 | Approved |
| SCHED-017 | RoadFS "Repeat": the owner will explain it before the estimating and scheduling design is finished. "Manage Resources" is not used. | Repeat not available; shared resources exist | Awaiting owner explanation | D1 | P2 | Missing info |
| SCHED-018 | **Technicians** on an estimate/work order: choose which technicians will work and have worked on it. | Lead technician + labor splits per line | Approved (see PAY-006) | D0/D1 | P1 | Approved |
| COMM-001 | **Appointment reminders and stay-in-touch prompts**: remind the service writer and manager to contact the customer by text or email about a pending appointment; very customizable and flexible (when, who, which customers, what message). Real sending needs separate approval (MKT-011). | Not available | Approved (prompts first; sending later) | D1 / F | P2 | Approved |
| PAY-001 | Technician pay types: **hourly** (with production bonus) or **straight commission**. **Subcontractors**: straight commission on the total billed **net labor** per invoice, at a **negotiated percentage per subcontractor**, calculated and paid each payroll period. | Labor credit shares only | Approved | G (payroll) | P1 | Approved |
| PAY-002 | Payroll periods: **1st–15th** and **16th–end of month**. | Not available | Approved | G | P1 | Approved |
| PAY-003 | **Production** = the technician's share of the invoice's **net labor**. Net labor = labor after sales commissions (all sales commissions reduce the labor side only, and so reduce technician production). The **lobby service writer commission (2.5% or 5%) is the sales commission**; the rate is decided **after the job is completed and before it is invoiced**, because it changes the technician's production. **Parts and materials are never commissioned.** | Labor credit on net labor after discount; no commission deduction | Approved; rules to confirm with the bookkeeper | G | P1 | Approved |
| PAY-004 | Production counts **only invoiced work orders** (not estimates), without waiting for payment. | Credits are created at invoicing | Approved | G | P1 | Approved |
| PAY-005 | **Jobs that run across a payroll period**: at period end, credit the technician(s) for the percentage of the job completed (**entered by the operations manager**); subtract that from the whole job when it is completed and invoiced. | Not available | Approved; exception to PAY-004, design with the bookkeeper | G | P1 | Approved |
| PAY-006 | **Technician splits are decided after the job is finished**, based on actual production, **approved by the operations manager**, and printed on a report for everyone to review (no favoritism). | Labor splits are set per line on the estimate before invoicing | Approved; **changes the current split design** | D0/G | P1 | Approved |
| PAY-007 | **Payroll production report** per technician per payroll period: completed (invoiced) invoices, work order numbers, description of work, % of labor attributed to the technician, whether the sales commission was taken off the gross, and total net production. | Technician labor sales report (credits only) | Approved | G | P1 | Approved |
| PAY-008 | **Production bonus (Technician Hybrid Pay Plan 2026)**: after totaling net production, look up the bonus % from the tier table and pay it on the whole amount (example: $6,251.00 at 12% = $750.12), above the hourly rate. The table is maintained by management (dated by year). Tiers: $2,751–3,000 3%; 3,001–3,250 3%; 3,251–3,500 3%; 3,501–3,750 3%; 3,751–4,000 4%; 4,001–4,250 4%; 4,251–4,500 8%; 4,501–4,750 9%; 4,751–5,000 10%; 5,001–5,500 10% ("Floor: AS, FR, MI & UP"); 5,501–6,000 12%; 6,001–6,500 12% ("Floor: ME"); 6,501–7,000 13%; 7,001–7,500 13%; 7,501–8,000 14%; 8,001–8,500 14%; 8,501–9,000 14%; 9,001–16,000 15% (in $1,000 steps). | Not available | Approved. Floors explained in PAY-009; figured per payroll period; no bonus below the floor; 15% above $16,000. | G | P1 | Approved |
| TEAM-003 | **Five technician groups** (about 20 technicians): **AS** Auto Shop, **FR** Furniture, **UP** Upholstery, **MI** Mobile Interior, **ME** Mobile Exterior. Technicians are assigned to groups **per work order after the job is done**, so productivity is tracked for each group and each technician. The scheduling calendar is set up by group so the dispatcher only sees the relevant technicians. | Calendar groups technicians by five service departments (PDR / Hail, Window Tint, Interior Repair, Upholstery, Furniture / Commercial) | Approved; calendar groups to be replaced by the five owner groups | D0/D1 | P1 | Approved |
| PAY-009 | **Bonus floors** (least commissionable production per payroll period): **AS, FR, MI and UP start at $5,001** (10%); **ME starts at $6,001** (12%). Below the floor, no bonus. **Apprentices** (employed less than one year): Mobile Exterior apprentices' floor is **$3,000.00**; all other apprentices earn a bonus from **$2,751.00** per the chart. After one year of employment, apprentices follow the chart as written for their group. The bonus is figured on **each payroll period's** production. Needs each technician's group, hire date and apprentice status. | Not available | Approved. Confirmed 2026-10-23: the ME apprentice at $3,000.00 earns the 3% tier; above $16,000 the bonus stays at 15%. | G | P1 | Approved |
| COMM-010 | **Sales commission**: total is normally **5% of the labor sales** of the job. Estimator and salesperson are usually the same person; when different, default split **50/50**. Some jobs have an estimator, salesperson, second salesperson and follow-up person sharing, and the total can be more than 5%. Report per salesperson: work orders and totals. | Up to 3 salespeople with shares; estimator and follow-up recorded without commission | Approved; **extends CRM-024** (people box gets commission rates and shares for every role) | G | P1 | Approved |
| BILL-010 | **Purchase orders**: P.O. number prints on the invoice; per-customer option **"P.O. required before work begins"**. | Not available | Approved | A2/G | P1 | Approved |
| BILL-011 | **Terms**: retail Due upon receipt; business customers Net 30 or other terms, set on the customer as the default. | Due date 30 days from issue | Approved | G | P1 | Approved |
| BILL-012 | **Statements on the 1st of each month**; dealer and fleet statements list their invoices with before and after photos, in digital or print form. **Interest** is calculated from the date the work was performed. | Not available | Approved; interest rate and rules to confirm with the accountant | G | P1 | Approved |
| WORK-001 | Rename RoadFS "Shipping" to **"Work Location"**. Billing is the customer's address where they receive the bill. All work is recorded by the address where it was performed, with a note that the customer at the billing address is responsible, and it also shows on the paying customer's account. Schedule and technicians use the work location. | Customer address only | Approved | A2/D1 | P1 | Approved |
| CRM-030 | Business customers have **contact people with titles**. | Contacts exist, no title | Approved | A2 | P2 | Approved |
| PHOTO-001 | Every estimate and work order can hold **many photos**. Before photos on the estimate carry to the work order; after photos attach to the invoice. | Not available | Approved | later (with U-stage) | P1 | Approved |
| PORTAL-001 | **Dealer portal**: dealers view their pending estimates from the car lot, with photos, and approve the work. | Not available (IDEA-006) | Approved direction | later | P2 | Approved |
| MKT-014 | **Customer satisfaction survey** after the work is done. Owner asked for a recommendation. | Not available | Proposal needed | F | P3 | Proposed |
| EST-006 | "Property" (RoadFS) = what is being worked on, the customer's property. RoadFS item types: **Boat, Motorcycle, Plane, Property (for example a rental home), RV, Furniture, Vehicle.** RoadFS also has a **Fees** section (Add Fee). | Vehicle (auto/RV/marine) and asset (furniture etc.) | Approved; motorcycle, plane and real property to add in the multi-item estimate (U-stage); fees to define | U1 | P1 | Approved |

---

## Change log

| Date | Change |
|---|---|
| 2026-10-23 | Owner answers: TBS, SB (Sandra Benson), Frog (Paul, PE), Torson and Stacy are staff; Paul/Stacy tags = lead came through their marketing; ME apprentice $3,000 gets 3%; 15% above $16,000; lobby service writer commission is the sales commission, set after completion and before invoicing; operations manager enters percent complete; subcontractor negotiated percent each payroll.
| 2026-10-23 | Added TEAM-003 (five technician groups) and PAY-009 (bonus floors and apprentices).
| 2026-10-23 | Added the owner's answers on scheduling, technician pay, production bonus, sales commission, billing, work location, photos and the dealer portal (OWNER-1023). |
| 2026-10-23 | Added the RoadFS work order status list and a proposed mapping. |
| 2026-10-23 | Added SCHED-013 (waiting / to-be-scheduled work list) and the RoadFS callback types from the owner's screenshots. |
| 2026-10-22 | Added the A1 testing requests (CRM-021 to CRM-029, MKT-012, SEC-010). CRM-021, checking that phone numbers and emails are real, is planned for later at the owner's request. |
| 2026-10-22 | Added SPL-003 (start an estimate from Splats or from the customer) and SPL-004 (repair and reupholster price tables, fully customizable, for every non-PDR splat). Menu "Vehicle Splat" renamed "Splats" in A1. |
| 2026-10-21 | Final corrections: the owner's tax summary is **not** implemented. The TAX entries stay Blocked / Awaiting Decision pending the accountant's approval of the service-specific tax decision table (ESTIMATING-STRATEGY §7). Authorization policy approved (price increases need new approval). QuickBooks practice recorded as business information to validate. Five line classification fields approved. Split-credit export deferred. Minimum launch scope proposed. |
| 2026-10-21 | Added requirement types; linked the estimate-first proposal (`ESTIMATING-STRATEGY.md`, awaiting approval). |
| 2026-10-20 | Added the owner retest list and ideas from public MobileTechRX and VehicleHub materials. Crease range and section 2 heading fixed on PR #5 (b73d9d5). |
| 2026-10-16 | First draft. Every request in the Word document and the owner's planning message is entered. Code audit statuses are as of PR #5 head 259c20d (main at e94e05f). |
