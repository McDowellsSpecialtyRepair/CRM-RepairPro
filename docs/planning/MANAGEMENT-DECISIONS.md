# CRM-RepairPro: Management Decisions

**Status: living document, updated as answers arrive (last update 2026-10-20).**

## Answers received

| Date | Decision | Answer |
|---|---|---|
| 2026-10-20 | M-01 / M-02 Salesperson and service writer | Service writers and service advisors are the same people, so **no new role** is needed. Each estimate shows three people, all editable: **Salesperson**, **Estimator** (when the estimator is a different person) and **Follow-up salesperson** (when the estimate wasn't closed and someone must follow up). |
| 2026-10-20 | M-35 Several items on one estimate | **Yes.** One estimate for a customer can include several items and services. For example: one car's dents and its seats; a restaurant's several booths and chairs; a hospital's exam tables and waiting room chairs. |
| 2026-10-20 | M-15b R&I list | The R&I name and price list is **editable by management**. Estimators can add or remove R&I items on an estimate. Each item is tied to the **vehicle type and body panel** it applies to. |
| 2026-10-20 | Demo email / M-36 | All demo (test) customers use **service@mcdowellsrepair.com**, so test estimates arrive there. The mailbox is **Google** (Google Workspace / Gmail). The demo connects through Google's mail server using an app password stored as a private GitHub Codespaces secret. |
| 2026-10-20 | M-04 Customer contact fields | Every customer record must be able to hold email, phone and a complete address (street, town, state, ZIP). They must be editable from inside the estimate too (CRM-014). No field was made mandatory. |
| 2026-10-20 | M-17 Planning documents | Approved: committed to `docs/planning/` in a separate documentation-only pull request. |


These are the questions only management, or the accountant, can answer. They are grouped by **when the answer is needed**. The first group affects the next pull request; later groups can wait until that phase is close. Each question includes a recommendation, so a short "approved as recommended" is enough when you agree.

Decision numbers (M-xx) match the references in `REQUIREMENTS-REGISTER.md`. Gaps in the numbering are left on purpose so the references stay stable.

---

## Needed now

### M-16: Approve and merge PR #5 (Phase 2.2)
- **Why it matters:** every later pricing PR (B1, B3, B4, C2) builds on Phase 2.2.
- **When:** after your own Codespaces retest.
- **Recommendation:** run the Phase 2.2 checklist on a demo that shows **Version 259c20d** in the sidebar.

### M-17: Approve this plan, and where it is stored
- **Recommendation:** commit these three files (`MASTER-PLAN.md`, `REQUIREMENTS-REGISTER.md`, `MANAGEMENT-DECISIONS.md`) to `docs/planning/` in a **separate documentation-only pull request** (not PR #5). Update them in every later PR.
- **Why it matters:** keeps the register from being lost between Claude sessions, as you asked.

---

## Needed before PR A1 (core data-entry fixes)

### M-01: How should a service writer become selectable as a salesperson?
- **Why it matters:** today only Owner, Administrator, Manager and Service advisor accounts can be credited with a sale (DOC p.1).
- **Options:**
  - **(a) Recommended:** a "Can be credited as a salesperson" checkbox on each employee. It works for any role, and management turns it on or off.
  - **(b)** Make service writers "Service advisor" accounts.
  - **(c)** A new "Service writer" role.

### M-02: Does a service writer need different permissions from a service advisor?
- **Why it matters:** if yes, we add a role. If no, the checkbox (M-01a) is enough.
- **Please list:** anything a service writer must **not** do that an advisor can (or the reverse).
- **Examples:** approve discounts, see internal costs, edit customers' tax terms.

### M-03: Your top usability complaints
- **Why it matters:** we don't want to guess which screens frustrate employees.
- **Request:** up to 10 short notes in the form "screen → what is hard". Small ones go into A1 or A2; larger ones get their own register entry.

### M-04: Is a phone number required for new commercial customers?
- **Today:** only a name or company is required.
- **Recommendation:** require a phone **or** an email for every new customer, so someone can contact them.

---

## Needed before PR A2 (shared search)

### M-09: Minimum characters to start searching
- **Recommendation:** 3 characters for everything (DOC p.18), including the first 3 digits of a phone number.
- **Note:** phone matches at 3 digits will be broad (for example, every "208" number). The list narrows as you type.

---

## Needed before PR B1 (editable pricing for all services)

### M-12: What to do with the existing sample prices
- **Why it matters:** these tabs hold unverified sample prices that came with the software (owner decision PRICE-01, 2026-10-06):
  - Window Tint, Interior Vinyl, Interior Fabric
  - Upholstery, Labor Rates, Materials
  - Generic Hail
- **Options:**
  - **(a) Recommended:** keep them as starting values, clearly marked "Unverified sample price" until a manager saves or confirms each one.
  - **(b)** Clear them all, so every price starts as "Not priced".
- **Also confirm:** that owner, administrator and manager are the only roles that edit prices (same as PDR).

---

## Needed before PR B2 (hail audit and pricing sources)

### M-10: Which insurance carrier agreements does the shop actually hold?
- **Why it matters:** the CRM only fills in hail prices automatically for State Farm. The other carriers' rows have no known source.
- **Request:** a list of carriers you work under, and whether each one has a written PDR or hail price agreement.

### M-11: Current carrier pricing documents
- **Request:** the current matrix document for each carrier from M-10, with its revision and effective date.
- **Why it matters:** the State Farm revision in the CRM (125278.13, dated 2025-04-29) may have been replaced.
- **Rule:** we will not copy pricing from documents the shop isn't entitled to use.

### M-18: Keep, replace or retire the legacy carrier rows
- **Recommendation:** retire them from the screen, keeping them as history only. A carrier stays "manual amount" until M-11 provides its document.

---

## Needed before PR E1 (start collecting dashboard data)

### M-20: Which department list is correct?
- **Why it matters:** department totals must add up to the company total. One list must be chosen before data is collected.
- **The two lists:**
  - **The CRM today:** PDR / Hail, Window Tint, Interior Repair, Upholstery, Furniture / Commercial.
  - **The dashboard specification (DOC p.22):** Mobile Exterior, Mobile Interior, Auto Shop, Upholstery, Furniture / Home Repair.
- **Recommendation:** decide whether "department" means **type of work** (the CRM list) or **where and how it is done** (the dashboard list). We can track both:
  - a department (the type of work)
  - a "Mobile / In-shop" location field
  - reports can then combine them.

### M-22: Customer segments, lead sources and lost-sale reasons
- **Proposed lists:**
  - **Segments (from DOC p.22):** Body Shops, RV Dealers, Car Dealers, Restaurants, Moving Companies, Insurance Companies, Retail Customers, Fleet Sales, Warranty Companies, Other.
    - Should medical, dental or chiropractic offices be their own segment?
  - **Lead sources (proposed):** Walk-in, Phone, Website, Referral (customer), Dealer visit, Insurance, Repeat customer, Social media, Other.
  - **Lost reasons (from DOC p.24):** Price, Timing, Competitor, No response, Not serviceable, Insurance/warranty denial, Other.
- **Request:** confirm or edit each list. Management can change them later in the CRM.

### M-26a: Do outside-sales dealer visits need GPS location?
- **Recommendation:** no GPS at first. Record date, time, dealer and notes. Location tracking raises employee privacy questions.
- **Source:** DOC p.26 asks this.

---

## Needed before PR B3 (R&I catalog)

These were asked in the Phase 2 design report and are still open.

### M-13: Where R&I labor times may come from
- **Why it matters:** estimating systems (CCC, Mitchell, Audatex) and MOTOR license their times under contracts. Copying them into our catalog could break your subscription terms.
- **Recommendation:** the shop's own recorded times, plus manual entry. A MOTOR license could be considered later.
- **F:** may an estimator type a time looked up in your own subscription onto **one** estimate, with the source noted? Recommendation: yes, one estimate at a time, never saved into the catalog. Have someone read your subscription terms to confirm.

### M-14: R&I prices: blank or pre-filled, and override reasons (decision G)
- **Recommendation:** pre-fill from the catalog when a sourced time and rate exist, otherwise leave blank. Require a reason for any override of a pre-filled amount (the same rule as PDR overrides).

### M-15: Safety-flagged parts (decision I): block or warn?
- **Applies to:** parts flagged for airbags, sensors, ADAS or structure.
- **Recommendation:** **block** approval until the estimator records which manufacturer procedure was checked, or "not available" with a reason.

### M-15a: R&I hourly rate(s)
- **Request:** one shop R&I rate, or rates by vehicle category or department. Management enters them in the CRM; nothing is invented.

### M-15b: The starting list of R&I part names
- **Example:** headliner, tail light, door trim panel.
- **Request:** your list. If none is provided, it starts empty and management adds parts as they come up.

---

## Needed before PR G1 (tax treatment). Ask the accountant now; G1 waits for the answers.

The accountant's answers can take time, so we recommend asking **now**. Nothing in tax changes until they reply in writing.

### M-05: Labor
- **The document:** "no tax on labor".
- **The CRM today:** all repair labor is untaxed, but "New fabrication labor" on upholstery work **is** taxed.
- **Question for the accountant:** is fabricating a new item (for example, a new cushion or cover made from scratch) taxable in Idaho?

### M-06: Shipping
- **The document:** tax shipping at 6%.
- **The CRM today:**
  - freight-in passed through to the customer is taxed
  - separately stated delivery to the customer is **not**
- **Question:** which shipping and delivery charges are taxable, and does it depend on whether the item being shipped is taxable?

### M-07: Use tax
- **The document:** an option not to charge tax on parts or shipping "when we pay the use tax".
- **Questions:**
  - In which situations does the shop pay use tax instead of charging sales tax?
  - Should the CRM report those amounts for filing?
  - Who may turn the option on?

### M-08: Changing tax after customer approval
- **The document:** the estimator can edit the work order after approval.
- **Questions:**
  - May tax treatment be changed after approval without re-approval by the customer?
  - **Recommendation:** allow a tax-only change before invoicing, by permitted roles, with a reason. Invoices stay locked.

### M-08a: Tax rate setting
- **Question:** should the 6% default be editable in Settings (management-only) for future rate changes?
- **Recommendation:** yes, affecting new estimates only.

### Legacy unclassified invoice lines (backlog EST-01)
- **Question:** how should invoice INV-2026-010 and similar old invoices be classified, if at all?

---

## Needed before PR D1 (scheduling) and D2 (time tracking)

### M-19: Who schedules, and technician working hours
- **Request:**
  - Who may schedule and reassign jobs?
  - Each technician's normal working hours: should management confirm them in the CRM (it doesn't assume them)?
  - Do mobile jobs need travel time blocks?

### M-21: Time clock
- **Questions:**
  - Is there an existing time clock or payroll system the CRM should match?
  - Should technicians clock in and out per job on their phones?
  - Who may correct a time entry?

---

## Needed before PR E2 / E3 (dashboard)

### M-23: Gross profit
- **Questions:**
  - Should labor cost include payroll taxes and benefits ("burdened")?
  - Which cost data is reliable enough to show margins?
- **Recommendation:** show "cost data incomplete" until costs are entered consistently.

### M-24: Who sees what on the dashboard
- **Recommendation (from DOC p.25):**
  - **Management:** everything.
  - **Sales / front lobby:** their own pipeline and conversion.
  - **Technicians:** their own jobs and hours.
  - **Accounting:** financial and AR.
- **Please confirm by role.**

### M-25: Targets and alert thresholds
- **Request:** monthly sales targets, utilization target per role, "approved but unscheduled after X days", AR over X days, dealer visit cadence, and margin floor.
- **Note:** the CRM starts with no targets (it won't assume any). Alerts only appear once you set them.

### M-26: Revenue attribution
- **Questions:**
  - When several technicians or salespeople share a job, is credit split by recorded hours, or by the percentages entered on the estimate (which the CRM already supports)?
  - How is commission attributed?

### M-27: History and account structure
- **Historical data:** is there earlier sales history (another system or spreadsheets) that should be imported for trends?
- **Parent accounts:** which customers have several locations (for example, a dealer group) that should roll up under one parent account?

---

## Needed before PR C1 (furniture, booth and medical diagrams)

### M-28: The furniture and booth styles you want
- **Why it matters:** the document's list stops at "Please provide a lot more options including" (DOC p.43). Only a picture follows.
- **The picture:** a third-party chair, recliner and ottoman chart with about 52 styles.
- **Request:** confirm which styles you want, in priority order. For example:
  - which chairs from the picture
  - sofas, sectionals
  - booths (single, double, channel-tufted, high-back, curved, banquette)
  - medical, dental, chiropractic and massage tables
  - office, hotel, RV and marine pieces
- **Note:** we draw our own simple diagrams. We don't copy the chart's drawings or yardage numbers.

---

## Needed before PR C2 / C3 (upholstery pricing and yardage calculator)

### M-30: The finished McDowells Upholstery Yardage Guide and workbook
- **Status:** you said it isn't finished yet. **We'll remind you when C2 is approved to start.**
- **Please include:**
  - the workbook (`McDowells_Upholstery_Yardage_Guide.xlsx`)
  - the "Claude Code Implementation Instructions" file
  - the final JSON data files
  - the 5-page illustrated splat-chart PDF
- **Also confirm in the guide:**
  - **Booth "thickness":** the booth rows list 36–54" thickness, which looks like height.
  - **Naming:** one set of names for categories and styles.

### M-31: Waste allowance rule
- **Why it matters:** the document says both "15% waste, adjustable" and "reference ranges already include waste; don't add it again".
- **Recommendation:** apply the waste allowance only to measured cutting layouts, never to reference ranges.

### M-32: Upholstery labor rates and overrides
- **Request:**
  - the hourly rate for each of the 5 equipment categories
  - whether any component needs its own rate
  - minimum charges
- **Override approval:** whether estimator labor-hour overrides need manager approval above some amount.

### M-33: Leather and other materials
- **Questions:**
  - Should the calculator also handle leather hides (bought by the square foot, not by the yard)?
  - Should foam be priced by the sheet or by the cubic foot?

---

## Needed to send demo emails

### M-36: Email provider for service@mcdowellsrepair.com
- **Why it matters:** the demo can only send to that mailbox once it's connected to an email account that is allowed to send. The sign-in details are stored as a private GitHub Codespaces secret, never in chat or in the code.
- **Request:** the provider (Google Workspace, Microsoft 365, GoDaddy, or another).

### M-37: Logo file
- **Request:** the McDowells logo as a high-resolution PNG (transparent background), or SVG if you have it.
- **Also tell us:** whether it should be printed in color or black and white.
- **Needed for:** the logo on estimates, invoices, work orders and statements (DOCS-001), starting in A1.

## Needed before PR F2 (email campaigns)

### M-34: Email provider and review
- **Request:**
  - which email service to use
  - the sending address and domain
  - an unsubscribe and consent policy
  - approval of a separate security and deliverability review before any customer email is sent
- **Note:** SMS and WhatsApp stay off until separately approved.

---

## Before production launch (not needed for months)

These are already in `docs/KNOWN-ISSUES.md`:
- **SEC-02:** independent security review
- **HOST-01:** hosting choice
- **OPS-01:** 40-user load test
- **BILL-01:** credit notes and refunds design with the accountant
- **INT-01:** QuickBooks mapping
- **INT-02:** payment portal provider
