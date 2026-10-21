# CRM-RepairPro: Estimate-First Strategy (PROPOSAL)

**Status: PROPOSED 2026-10-21, revised the same day with management's refinements and answers to D-1 to D-6. Awaiting management approval.**
- Nothing in this document is built.
- Nothing here changes application code, the database, prices or permissions.
- Once it is approved, `MASTER-PLAN.md` §3 and §4 are rewritten to follow it.

Management chose **Option B: estimating first, across every department** (2026-10-21). Their reason:

> "The estimate is the foundation of RepairPro." It is the original business record of customer, marketing, sales, production, pricing, cost and approval information. The estimate records **planned** values; work orders, time tracking and accounting record **actual** outcomes.

## Guiding principles (management refinements, 2026-10-21)

1. **Agreed order is kept:** A1 everyday fixes → A2 customer search and customer records → B0 PDR panel details. Then the universal foundation.
2. **Mobile-friendly from the start.** Every new or changed estimating screen must be usable on phones and tablets in the PR that introduces it, and is tested at phone and tablet sizes before it is offered for approval. Advanced offline work (saving drafts without signal, upload queues) comes later, in M2.
3. **The universal multi-item estimate comes first.** Upholstery, dealer, hotel, booth, warranty-company and other multi-item workflows are built only on top of it, never on today's one-item estimate.
4. **Every estimate line carries the attribution data** needed later for sales commissions, technician bonuses, production hours, estimated costs and department reporting (§1, Layer 2). The final calculation rules are approved separately later.
5. **Insurance hail pricing is carrier-specific.** No generalized adjustment (for example "25% aluminum") is treated as a universal rule. Each carrier's prices and rules are entered from that carrier's authorized matrix, with its effective date. They are verified against that document separately, and used only for that carrier's claims.
6. **Launch-essential vs optional.** Each item is marked as needed for the production launch or optional for later (§9).

---

## 1. Recommended estimating architecture (plain English)

The design has five layers.

| Layer | What it does |
|---|---|
| **1. Customer database: people, places and things** | Records who pays, where the work is done, and what is repaired, kept separate from each other. |
| **2. The estimate: one record, many items** | One estimate for one customer job. It holds any number of items, each with its own service, photos, lines and notes. |
| **3. Service estimating modules** | Specialized screens and diagrams for each service. Every module produces the same standard estimate lines. |
| **4. Price lists and rules, versioned** | Every price comes from a named, dated source, or from a manual entry with a reason. |
| **5. Mobile capture, approval and hand-off** | Works on a phone in a parking lot. Approved lines flow on to work orders, scheduling, credit, accounting and dashboards as plans, never as actuals. |

### Layer 1: Customer database (people, places, things)

Today a "customer" is both the payer and the person served, with one address. That breaks down for the cases management described:
- a landlord paying for furniture repair at a tenant's home
- a warranty company paying for a sofa repair at its customer's home
- a dent warranty company paying for a dent repair at its customer's home

**Proposed records:**

| Record | Meaning | Example | QuickBooks Desktop mirror |
|---|---|---|---|
| **Account** (bill-to) | Whoever pays and owns the receivable | Landlord, warranty company, dealer group, insurer, a retail person | QuickBooks **Customer** |
| **Contact** | A person at an account. May have approval authority and a spending limit. | Dealer used-car manager; warranty claims adjuster | Customer contact |
| **Service location** | An address where work happens. Belongs to an account, or is a third party's address. | Tenant's home; dealer lot; restaurant; hospital wing | QuickBooks **Job** (Customer:Job), if the bookkeeper agrees |
| **Served party** | The person whose property is repaired, when different from the payer | The tenant; the warranty company's customer | Notes and ship-to on the job |
| **Item** | The thing repaired: vehicle (VIN), RV, boat (HIN), aircraft (N-number), furniture piece, booth, exam table. It has an owner and a location. | 2022 F-150; "Conference chair, Room A"; "Booth #4" | Not an accounting record; shown in line descriptions |
| **Claim / authorization** | The third-party payer's claim number, authorization number, authorized amount and required photos | Warranty claim #, insurer claim #, dealer PO or RO, stock # | PO number / memo |

**What this gives you:**
- **Complete history.** Every estimate, work order, invoice and photo is filed under the account, the location and the item. A VIN's history follows the vehicle even after it changes owners. An account's history shows every location and item serviced.
- **Duplicate checks** on accounts, contacts and items, especially VINs. This applies to every record, including temporary walk-in customers.
- **Existing records carry over.** Today's customers become accounts. Their address becomes their first service location. Their vehicles and assets become items. The existing third-party payer and fleet account records fold into the account, contact and claim records. Nothing is deleted.

### Layer 2: The estimate (one record, many items)

**Estimate header:**
- number, revision, status, dates and valid-until date
- bill-to account, service location, served party, claim/authorization
- people: **Salesperson, Estimator, Follow-up salesperson** (approved 2026-10-21)
- marketing: lead source, referral, campaign
- planned schedule window

**Items (one or more):** each item links to its vehicle or asset record and holds:
- its service(s), department, diagram marks, photos, measurements and notes
- its own lines and an item subtotal

**Lines:** every service module writes the same standard line. It records the following, so commissions, bonuses, production hours, costs and department reports can be calculated later without re-entering anything:
- **Item and service:** which item, service category, **operating department**, and **service-delivery method** (for example mobile on-site, in-shop, dealer route) (D-3)
- **Estimated production:** labor hours, and the labor standard and version used
- **Estimated costs:** parts and materials cost, and expected sublet cost
- **Sales attribution:** salesperson (defaults from the header; can differ per line) and the sales-credit share
- **Production attribution:** planned technician(s) with planned shares. These are plans; the work order records who actually did the work.
- **Eligibility flags:** commission-eligible, bonus-eligible, and production-credit-eligible, with defaults by line type that management can change
- **Rule version placeholders:** for the commission and bonus rules once they are approved. Until then the lines are recorded with no calculation.

In addition, each line records:
- **Type:** labor, part, material, freight, supply, sublet, fee or discount
- **Classification:** department and service category
- **Quantity and unit**
- **Prices and costs:** customer price; estimated cost; estimated labor hours
- **Credit basis:** whether the line counts toward technician production credit and toward sales credit
- **Price source:** a matrix and its version, a package, manual, or an override (with who, when, why and the suggested price, as PDR already does since Phase 2.2)
- **Tax treatment** for that line
- **Option group:** required, optional, "good/better/best", declined

**Totals:**
- Calculated **once, on the server**, from the lines.
- Tax is figured **per line**, so a mixed estimate is never taxed by one rule.
- Discounts are allocated across lines.
- Sales and technician credit is split once per estimate or invoice, never once per item.

**Revisions and supplements:**
- Each sent or approved version is kept.
- A **supplement** (additional damage found) is a new revision showing what changed.

**Approval history** records:
- who approved, and how (in person with a signature, the portal, phone, or a written PO)
- which revision
- which lines were approved or declined

**Planned versus actual:**
- The estimate's lines are plans.
- Work orders copy the approved plan into production tasks.
- Actual hours, materials used, costs and payments are recorded separately.
- Reports compare the two.
- Nothing calculates payroll, completed production or profit from estimated values alone.

**Snapshots:** the price list versions, labor standards and commission rule versions used are recorded on the estimate, so later changes never rewrite history.

### Layer 3: Service estimating modules

Each service gets its own screen: a diagram, its questions and its price rules. Every screen produces standard lines on an item. The modules:
- PDR dent map
- hail panel grid
- tint window picker
- appearance packages
- interior repair panels
- upholstery components
- handyman time and materials

A new service plugs in without changing totals, tax, approvals or invoices.

### Layer 4: Price lists and rules (versioned)

**Price-list types needed across the business:**

| Type | Example |
|---|---|
| Grid | Dent count × size, as the carriers and CCC use |
| Per-dent | Size, length and severity, with adjustments (Phase 2.2) |
| Per item or per panel | Interior repair |
| Vehicle-size tier × package | Detailing, ceramic coating, paint protection film (PPF), tint |
| Per linear foot or per seat | Booths |
| Hours × rate | R&I, upholstery labor |
| Measurement-based | Yardage |
| Time and materials | Handyman |

**Every price list has:**
- a version, an effective date and a source
- an approval status
- an editing permission, held by management only

**Customer price groups:** for example dealer, retail, fleet and warranty company. The fleet discount fields that exist today move here.

**Carrier price lists are carrier-specific.** Each insurance carrier's grid and its rules (for example how upcharges combine, oversize dents, conventional-repair limits, R&I vs access markup) are entered as that carrier's own price list. Each records the carrier, document title, revision, **effective date**, who verified it against the authorized document, and when. Nothing from one carrier is reused for another, and there are no built-in "industry" adjustments. A claim is priced only from a verified, current matrix for its carrier; otherwise the amounts are entered by hand with a remark.

### Layer 5: Mobile capture, approval and hand-off (see §6)

---

## 2. Revised estimate-first roadmap (proposed)

| Stage | Goal | Why this position |
|---|---|---|
| **0** | Finish Phase 2.2 (PR #5) | Already built; waiting for your test. |
| **1. Stabilize and share** | In this order: **A1** everyday fixes and people on estimates → **A2** customer search and customer records → **B0** PDR panel details → **A5** phone usability of the remaining existing screens | The agreed order. Small and low risk. Every later stage relies on finding customers quickly and naming the right people. |
| **2. Universal foundation** | A **design PR first** (documents and mockups, no code). Then: customer database (accounts, locations, served parties, items), multi-item estimate core, photos, the standard line and price-source framework, editable price lists for every service | Doing this **before** the specialized services avoids building each service on today's one-item estimate and rebuilding it later. |
| **3. Specialized workflows** | One PR per service family (§3) | Each family can be tested on its own. Upholstery yardage waits only for the guide. |
| **4. Mobile and dealer** | Offline-capable phone estimating, customer presentation and signature, dealer route mode, dealer portal (separate security design) | Needs the item, photo and approval foundation from Stage 2. |
| **5. Connect downstream** | Team profiles, scheduling board, time tracking, commission and bonus rules, tax rules, QuickBooks Desktop, credits and refunds, dashboard, marketing | These consume what estimates record. They need the estimate data to exist first. |

### A better technical order for some items

- **PDR panel details (B0) stays in Stage 1, right after A2, as agreed.** It adds fields to dent records that already exist, and carries forward into the multi-item design unchanged.
- **Every multi-item workflow waits for U2 (the multi-item core).** That covers upholstery sets (S6–S8), hotel and booth quantities (S6), warranty-company jobs (S9) and dealer route work (DR1). They are never built on today's one-item estimate.
- **Mobile is part of every PR,** not a stage at the end. Stage 4 only adds offline drafts, customer signature and the dealer screens.
- **R&I and hail move after the multi-item core.** R&I links to panels on a specific item. Building it before items exist would mean re-linking every R&I record later.
- **Marketing data capture (lead source, referral, customer segment) moves into Stage 1 and 2, as part of the estimate.** It is no longer a later dashboard PR. This is the estimate-first principle applied: capture it when the estimate is written.
- **Tax rules (G1) stay independent.** They move as soon as the accountant answers. The per-line tax design in Stage 2 makes that change smaller.

---

## 3. Proposed pull request sequence

Each PR follows the approved process: branch from `main` → build → automated and browser tests (**including phone and tablet sizes for every estimating screen it touches**) → PR → Codespaces steps → owner test → fixes → merge only with approval.

| # | PR | Size | Includes | Needs before starting |
|---|---|---|---|---|
| 0 | PR #5: Phase 2.2 PDR pricing | — | Open | Owner test |
| 1 | **A1: Core fixes and people on estimates** | M | Leading zeros; Salesperson / Estimator / Follow-up (one credit structure, history kept); contact rules (phone OR email, temporary walk-ins, email needed to send); "Not priced"; clear errors; logo; Test outbox; remove fake "QB Synced"; demo guard and role logins; screen-health check | Logo file |
| 2 | **A2: Search, customer file and marketing capture** | M–L | 3-character search everywhere; full contact details in the estimate header; edit the customer from inside the estimate; lead source / referral / segment lists on the estimate; work order list shows address, salesperson and technicians | Segment and lead-source lists (M-22) |
| 3 | **B0: PDR panel details** | M | Roof rails L/R on every body style and price list; factory or repainted paint (blocks glue pull); aluminum or steel (adjustment); expected % of factory condition printed | — |
| 4 | **A5: Phone usability pass on the remaining existing estimate screens** | M | Phone-first layout, large touch targets, sticky totals, no sideways scrolling, tested on Android and iPhone sizes. (Screens changed in A1, A2 and B0 are already made phone-friendly in those PRs.) | — |
| 5 | **U0: Universal estimate design (documents and mockups only)** | S | Data model, migration plan, QuickBooks mapping, accounting risk list, screen mockups | Decisions D-1 to D-6 (§7) |
| 6 | **U1: Customer database foundation** | L | Accounts, contacts with approval limits, service locations, served parties, items, claim/authorization; migration of existing customers, payers and fleets; duplicate checks | U0 approved |
| 7 | **U2: Multi-item estimate core** | L | Items on estimates; per-item lines; per-line tax and department; revisions and supplements; approval history; existing estimates migrated as one-item estimates with identical totals | U1 |
| 8 | **U3: Photos and attachments** | M | Photos per item and line; phone camera capture; compression; storage limits; included in encrypted backups; customer-visible vs internal | Photo decision (D-7) |
| 9 | **U4: Price lists and rules framework** | L | Versioned price lists of every type (§1, Layer 4); price groups; option groups (good/better/best, optional); management editing with audit (this replaces "B1") | U2 |
| 10 | **S1: R&I** | L | Catalog by vehicle type and panel; editable names and prices; suggestions; once-only charging; safety procedure checks | U2, U4 |
| 11 | **S2: Hail** | M–L | Audit; **carrier-specific** price lists entered by management, each with carrier, revision, effective date, permission and a recorded verification against the authorized document; that carrier's own rules only; supplements; insurer-style printout | Carrier agreements and current documents (M-10, M-11) |
| 12 | **S3: Auto interior repair** | M | Repair vs replace / reupholster per panel; damage type × material × severity | U4 |
| 13 | **S4: Appearance services, part 1** | M | Window tint, headlight restoration, exterior scratch / touch-up, polishing / paint correction / wax | U4 |
| 14 | **S5: Appearance services, part 2** | M | PPF, ceramic coating, interior and exterior detailing; film brand and line; warranty registration ID; deposits | U4 |
| 15 | **S6: Furniture, booth, hotel and medical diagrams and quantities** (needs U2) | M–L | Diagram library; many identical pieces (hotel quantities); per linear foot or per seat (booths); fabric grade or customer's own material; flammability spec field | Style list (M-28) |
| 16 | **S7: Upholstery labor matrix** | M | Management-only rates by category and component; recommended hours with override reason | Rates (M-32); **reminder to send the finished yardage guide** |
| 17 | **S8: Upholstery yardage calculator** | L | Measurements, nesting on the roll, ordering yardage | **The finished yardage guide (M-30)** |
| 18 | **S9: Warranty-company and third-party work** | M | Claim and authorization fields; required photo set; "recommend replacement" outcome; bill-to separate from the served party | U1, U2, U3 |
| 19 | **S10: RV, marine, aircraft and medical/dental specifics** | M | Identifiers (HIN, N-number); materials specs; aircraft compliance checklist and document gates; medical disinfectant and cleanability fields | Aircraft scope decision (D-10) |
| 20 | **S11: Small handyman projects** | S–M | Scope, time and materials, photos | Licensing check (D-11) |
| 21 | **M2: Offline-capable phone estimating** | L | Install to home screen; drafts saved on the device; photo upload queue; resume; "unsynced" indicator | Offline price policy (D-8); session design security review |
| 22 | **M3: Customer presentation and signature** | M | Clean customer view; good/better/best choices; e-signature on a revision; deposit request (no payment processing) | U2 |
| 23 | **DR1: Dealer route mode** | L | Many vehicles in one walk-around; stock number, last 8 of VIN, RO/PO; **VIN history and duplicate-work warning**; per-line approve or decline under the account's authorization policy; batch invoices per dealer | U1–U3 |
| 24 | **DP1: Dealer portal (separate security design first)** | L | Dealer logins see only their vehicles and estimates; photos; approve or decline; progress; history where permitted | Independent security review |
| 25+ | **Stage 5:** team profiles, dispatcher board, time tracking, commission and bonus rules (design and accountant approval), tax (G1), QuickBooks Desktop integration (design), credits and refunds, dashboard, marketing | — | — | Each has its own design and approval |

---

## 4. Service-by-service estimating requirements (comparison)

"Today" is the current state of the CRM.

| Service | Item | Input / diagram | Pricing basis | Price data and licensing | Special questions | Safety / compliance | Today |
|---|---|---|---|---|---|---|---|
| Retail PDR | Vehicle | Dent map, per dent | Size / length / severity + adjustments; packages | Shop-owned | Panel material; factory paint vs repaint; roof rails (glue pull only); access | Customer expectation % | Phase 2.2 (PR #5) |
| Insurance hail | Vehicle | Panel × count × size | Carrier grid + carrier rules | Carrier-issued documents; use only with permission | Claim #, adjuster, supplements; CR (conventional repair) flag | — | State Farm only, per panel |
| R&I (PDR and hail) | Part on a vehicle | Linked to panels or dents | Hours × rate, or flat | Shop's own times; MOTOR / CCC times are licensed, not copied | Procedure checked | Airbag, ADAS, sensor procedure record | Manual line only |
| Auto interior repair | Vehicle interior | Interior diagram | Damage × material × severity; repair vs replace | Shop-owned | Material type; color match | — | Partial |
| Window tint | Vehicle windows | Window picker | Film line × vehicle / window | Film makers' patterns are licensed (store brand and line only) | Shade per window | **State tint law limits** (check Idaho rules) | Tint matrix |
| Headlight restoration | Pair / each | Simple | Flat or by condition level | Shop-owned | Oxidation level; UV coat | — | None |
| Exterior scratches / touch-up | Panel | Vehicle diagram | Per panel by depth | Shop-owned | Depth (clear, base, primer) | Expectation % | None |
| Polish / paint correction / wax | Vehicle | Size tier | Size × stage × condition | Shop-owned | Paint condition, optional paint readings | — | None |
| Paint protection film (PPF) | Vehicle | Coverage package | Package × vehicle | Pattern libraries licensed (XPEL DAP, 3M) | Film brand and line; warranty registration ID | — | None |
| Ceramic coating | Vehicle | Package | Years / package × size + required correction | Brand warranty tied to VIN | Warranty registration; maintenance reminders | — | None |
| Interior / exterior detailing | Vehicle | Package | Package × size + condition surcharges | Shop-owned | Pet hair, stains, odor; deposit | — | None |
| Auto / RV / marine upholstery | Seats, cushions | Component diagrams | Labor hours × rate + yardage + materials | Yardage guide pending | Material grade; foam | Marine: UV-rated vinyl, thread | Partial (RV and marine exist) |
| Furniture & commercial upholstery | Furniture piece | Style diagrams | Components; fabric grade or customer's own material | Yardage guide pending | Fabric repeat; customer's own material | **Flammability spec** (e.g. CA TB 117-2013) | Partial |
| Restaurant booths / seating | Booth, chair | Booth diagrams | Per linear foot or per seat | Shop-owned | After-hours scheduling | Flammability spec | Old booth drawing only |
| Hotel furniture | Many identical pieces | Piece diagram × quantity | Per unit; room / floor locations | Shop-owned | Quantity, sampling | Flammability spec | Partial (room/floor fields exist) |
| Home furniture repair | Piece at home | Diagram | Per repair; warranty company rates | Warranty company rate sheets (contract) | Claim #, authorized amount, required photos, recommend replacement | — | Not separated |
| Small handyman | Task | Description + photos | Time and materials, or flat | Shop-owned | Scope sign-off | **Check Idaho contractor registration rules** | None |
| Private aircraft interiors | Aircraft (N-number) | Seat / panel components | Hours × rate + materials | — | Certification basis; seat type | **FAA: only authorized persons maintain aircraft and return them to service; materials need burn-test documentation** (§5 C) | Generic diagram only |
| Medical / dental equipment | Table, chair | Component diagrams | Components | OEM requirements | Disinfectant compatibility (CFFA-100 style), OEM material | Never claim regulatory certification | None |

---

## 5. Industry research findings

**Method:**
- Web searches of US and international sources, including German, French, Japanese, Portuguese and Polish-language material.
- Most vendor sites couldn't be opened from our environment, so findings rest on search-result summaries of the cited pages. Many sources are vendor marketing.
- We did **not** research every country or product.
- **Findings** (documented, with sources) are kept separate from **ideas** (our recommendations).

### A. PDR and hail

| Software / source | Market | Documented features | Limits / licensing | Idea for RepairPro |
|---|---|---|---|---|
| Mobile Tech RX | US | Several matrices (incl. State Farm, Paul Kordon, its own); VIN scan; access-difficulty sliding upcharge; "x-ray" photos; insurer-format add-ons ([1](https://www.mobiletechrx.com/?p=3968), [2](https://www.mobiletechrx.com/resources/supercharge-your-hail-estimates-with-classy-estimating-now-integrated-into-mobile-tech-rx/)) | Terms for bundled carrier matrices unknown | Access-difficulty adjustments (we have location difficulty) |
| DentMate (US / AU) | US, Australia | Custom matrix, splat diagrams, glue-pull and aluminum upcharges, R&I, supplements ([3](https://apps.apple.com/us/app/dentmate/id1063156879)) | — | Supplements as revisions |
| Sullivan PDR Estimator | US | Multi-carrier hail matrices; **duplicate VIN and stock-number checks**; technicians see only their own estimates ([4](https://apps.apple.com/app/id849892620)) | — | Duplicate-work warning for dealer routes |
| Web-Est / PDR-Software | US, Canada, Europe | Several rate profiles; Canadian (toonie) and European matrices ([5](https://www.web-est.com/2013/5/1/web-est-announces-european--canadian-formatted-rate-matrices-added-to-paintless-dent-repair-estimating-software.html)) | Older sources | Size options in coins or millimeters |
| CCC ONE PDR matrix | US | Count band × size grid of hours or dollars; aluminum and headliner R&I on separate lines ([6](https://help.cccis.com/webhelp/insurance_company/estimating/web/Content/PDR/Adding%20or%20Editing%20a%20PDR%20Line%20Item.htm)) | Licensed software | Same grid structure for carrier price lists |
| State Farm / USAA / Liberty / Kemper matrices | US | Majority-size pricing, +25% aluminum, $40 per oversize dent, one upcharge per panel, CR over the grid, R&I **or** access markup ([7](https://role-based-content-app-ui.digital.statefarm.com/b2b/pdr/docs/ss_paintless-dent-repair-matrix.pdf), [8](https://core.sca.claims/clientForms/USAA%20HAIL%20Matrix%20for%202025.pdf), [9](https://core.sca.claims/clientForms/Liberty%20Mutual%20HAIL%20Matrix%20for%202025.pdf)) | Carrier documents; no license terms found. Use only with permission. **These rules come from specific carriers' documents on specific dates. They are examples, not industry rules.** | Each carrier entered and verified separately (S2) |
| DeKoLaKa / AZT tables | Germany | Published time-based dent-repair calculation aid (2020) and hail table; cover push and glue-pull ([10](https://www.azt-automotive.com/_Resources/Persistent/67944739809c2fb3892246bcde1ae08e9a446ed9/DeKoLaKa_Kalkulationshilfe%20Ausbeularbeiten_2020-03-03.pdf)) | Recommendations, not binding | Time-based option (hours per dent) alongside dollars |
| DAT (SilverDAT, myClaim, FastTrackAI) | Germany / Europe | Hail calculation for refurbishers; photo AI calculation ([11](https://www.autohaus.de/nachrichten/autohandel/dat-verstaerkte-kooperation-mit-aufbereitern-2727494)) | Licensed data | — |
| France Débosselage / Grele.net | France | Own hail software, insurer exchange (Darva), 3D laser scanning ([12](https://j2rauto.com/carrosserie/milan-le-nouvel-atout-de-france-debosselage-face-a-la-grele)) | — | Later: import dent counts from scanners |
| HailMaster (Soft Edge) | Poland / Europe / Japan | AR dent measurement, multi-currency, country calculators ([13](https://apps.apple.com/us/app/hailmasterplus/id1209848042)) | — | — |
| Hail scanners (Chief Constellation, UVeye, DCC Hail) | US, Canada | Automated dent count and size ([14](https://www.nasdaq.com/press-release/chief-collision-technology-introduces-first-mobile-3d-hail-damage-scanning-system), [15](https://fleetmaintenance.com/in-the-bay/shop-equipment/product/21214347/uveye-atlas-automatic-vehicle-inspection)) | Vendor accuracy claims | Optional import later; never automatic pricing |

### B. Collision estimating and labor-time data

| Source | Market | Documented | Licensing finding |
|---|---|---|---|
| CCC ONE / MOTOR | US | CCC labor times come from MOTOR; MOTOR guide pages are licensed products ([16](https://www.repairerdrivennews.com/2024/02/09/cic-estimating-committee-overviews-recent-changes-to-ccc-mitchell-and-qapter/)) | MOTOR end-user terms forbid copying into a database ([17](https://mobil.com/en/lubricants/what-to-buy/find-the-right-motor-oil/motor-information-systems-end-use-license-agreement)); MOTOR sells an API license ([18](https://www.motor.com/products-services/data-products/estimated-work-times)) |
| Mitchell Cloud Estimating | US / Canada | Web, phone and tablet; photo AI options ([19](https://www.mitchell.com/auto-body-estimating)) | Contract-based |
| Audatex / Qapter (Solera) | ~90 countries | Region-specific times; photo AI ([20](https://www.repairerdrivennews.com/2020/07/10/solera-new-version-of-qapter-allows-ai-photo-estimating/)) | Licensed |
| DAT, GT Motive, Thatcham | Europe / UK | OEM-based times; Thatcham licenses its data to vendors ([21](https://am-online.com/news/2006/5/24/major-shift-in-estimating/11940)) | Licensed |
| Japan, Jiken Center 指数 / Cognivision | Japan | Labor-time index; missed-operation lists; insurer photo sharing ([22](https://www.cognivision.jp/contents/kikancogni/assets/img/cogni19.pdf)) | Licensed |
| Cilia | Brazil | Photo AI suggests times per operation; >50% claimed share ([23](https://revistaapolice.com.br/2025/05/cilia-protagonista-do-ecossistema-de-sinistros-automotivos)) | — |
| SCRS Guide to Complete Repair Planning | US | 1,000+ commonly missed operations ([24](https://www.repairerdrivennews.com/?p=16546)) | Guide is free; software tool paid |

**Note on hail:** the carrier rules in table A are summaries of individual carriers' documents, some of them years old. They show what to *model*. They are not prices or rules RepairPro will apply.

**Finding:** collision labor times are licensed databases. **Recommendation:** RepairPro uses only the shop's own measured times and price lists, plus manual entry per estimate, unless a license (for example MOTOR's API) is bought. This is not legal advice; have the subscription terms read.

### C. Tint, PPF, coatings, detailing and field-service quoting

| Software | Market | Documented | Idea |
|---|---|---|---|
| Urable | US | VIN-to-quote, vehicle-specific pricing, deposits, inspections ([25](https://myquoteiq.com/top-10-best-quoting-software-for-auto-detailing-businesses-in-2026/)) | Size-tier packages |
| Tint Wiz | US | Proposals, film inventory, before/after photos, review requests ([26](https://myquoteiq.com/top-8-softwares-for-window-tinting-businesses-in-2026/)) | Before/after photo set |
| Shopmonkey / Tekmetric | US | Photo and video inspections with markup; customer e-signature; signed PDF kept ([27](https://support.shopmonkey.io/hc/en-us/articles/47883995635476-Customer-E-Signatures-on-Inspections), [28](https://www.shopownermag.com/tekmetric-launches-mobile-app-to-enhance-inspection-workflow/)) | Signature tied to a revision (M3) |
| Jobber / Housecall Pro / ServiceTitan | US / Canada | Optional line items; good/better/best options; deposits on approval ([29](https://help.getjobber.com/es/articles/optional-line-items-on-quotes/), [30](https://help.servicetitan.com/docs/proposal-templates)). Jobber's app does not work offline except notes ([31](https://community.getjobber.com/discussions/job-details-scheduling/out-of-cell-service-area-access/6478)) | Option groups that also print, on phone and PDF |
| FieldPulse / Commusoft | US / UK | Documented offline estimate modes ([32](https://help.fieldpulse.com/offline-mode/estimates-invoices-offline-mode), [33](https://www.commusoft.co.uk/?p=7043)) | Offline drafts are achievable |
| Orderry | International | Condition report, e-signature on a link, one-click work order ([34](https://orderry.com/automotive-repair-estimate-software)) | — |
| XPEL DAP / 3M Pattern Marketplace | US / global | Licensed pattern libraries, by subscription ([35](https://multimedia.3m.com/mws/media/2418775O/3m-pattern-marketplace-sell-sheet.pdf)) | Store film brand and line and the warranty ID only |
| Ceramic Pro | Global | Warranty tied to VIN and transferable ([36](https://wf.mydigitalpublication.com/ppf-fall-2021/page-11)) | VIN-based warranty records |

### D. Upholstery, furniture, warranty networks and dealer reconditioning

| Source | Market | Documented | Idea |
|---|---|---|---|
| Upholstery apps (TrimQuote, YardQuote) | US | New or small; YardQuote doesn't nest pieces ([37](https://appgoblin.info/apps/6793834013)) | A real gap; our nesting plan stands out |
| Guardsman / Montage / FSN | US / UK | Photo-based claims; technician assesses, recommends repair or replacement; company approves; FSN covers 25,000+ ZIP codes ([38](https://www.furnituretoday.com/manufacturers/furniture-technician-services-available-in-25000-zip-codes-nationwide)) | Warranty work type (S9) |
| Fibrenew / Dr. Vinyl | US / Canada | Mobile repair franchises; Dr. Vinyl East Idaho's customers are mostly dealers ([39](https://www.eastidahonews.com/?p=326739)) | Local competition in dealer work |
| Rapid Recon "Vendor Advantage" / vAuto iRecon | US | Vendor sees only assigned vehicles; line-level approve or decline; VIN scan ([40](https://www.autosuccessonline.com/rapid-recon-vendor-advantage/), [41](https://www.vauto.com/irecon/)) | Dealers may require working in their system; RepairPro stays the internal record |
| Sublet invoice practice | US | Match invoices to RO and PO; confirm VIN and mileage ([42](https://invoicedataextraction.com/blog/dealership-sublet-invoice-processing)) | Stock number, last 8 of VIN, RO/PO on dealer lines |
| Medical vinyl cleanability (CFFA-100) | US | Disinfectant exposure test method ([43](https://cffaperformanceproducts.org/content/pdfs/FocusHealthCare.pdf)) | Medical material fields |
| CA TB 117-2013 (TB 133 repealed 2019) | US | Furniture flammability ([44](https://www.tuvsud.com/th-th/e-ssentials-newsletter/consumer-products-and-retail-essentials/e-ssentials-4-2019/usa-california-repeals-the-flammability-test-procedure-technical-bulletin-133-for-seating-furniture)) | Flammability spec field |

### E. Aircraft interiors (verify with an A&P/IA or counsel before offering)

- 14 CFR 43.3 and 43.7: only authorized persons may perform maintenance and approve return to service ([45](https://www.law.cornell.edu/cfr/text/14/43.7)).
- Part 43 Appendix A lists repairing cabin upholstery as preventive maintenance, when it doesn't involve primary structure or operating systems ([46](https://www.law.cornell.edu/cfr/text/14/appendix-A_to_part_43)).
- Cabin materials must meet burn requirements. AC 43.13-1B ch. 9 describes testing and recording the results ([47](https://avweb.com/wp-content/uploads/2020/01/3n-ch9_4.pdf)); 14 CFR Part 25 Appendix F covers test methods ([48](https://www.law.cornell.edu/cfr/text/14/appendix-F_to_part_25)).

**Recommendation:**
- Work on removed components only.
- The owner's A&P/IA removes, reinstalls and signs off.
- Record burn-test documentation per material lot.
- Block the aircraft invoice until that documentation is attached.

### F. QuickBooks Desktop Enterprise

- **How a web CRM connects:** Intuit's Web Connector, which runs on the Windows PC with QuickBooks and polls our server, exchanging qbXML ([49](https://static.developer.intuit.com/resources/QBWC_proguide.pdf)). Commercial bridges such as Conductor offer a Node SDK ([50](https://www.npmjs.com/package/conductor-node)). Zapier does not support Desktop ([51](https://community.zapier.com/how-do-i-3/use-zapier-with-quickbooks-enterprise-on-local-serve-43209)).
- **Lists the CRM can mirror:** Sales Rep, Class, Customer Type and Job Type are separate QuickBooks lists; Customer:Job is a hierarchy. Time entries can be added and can feed payroll ([52](https://developer.intuit.com/app/developer/qbdesktop/docs/api-reference/qbdesktop/timetrackingadd)).
- **Product status:** Desktop 2023 lost payroll and connected services after May 31, 2026 ([53](https://quickbooks.intuit.com/learn-support/en-us/account-management/re-service-ending/01/1430876/highlight/true)). Enterprise is still sold.
- **Recommendation:**
  - QuickBooks stays the master for A/R, sales tax and payroll.
  - The CRM sends customers/jobs, invoices, payments and time.
  - QuickBooks IDs are stored on every mirrored CRM record.
  - The design is agreed with your bookkeeper before any transfer.

---

## 6. Mobile estimating: recommendation before any native app

**Recommendation: make RepairPro an installable, offline-capable web app** (a "progressive web app") before considering a native app.

**What this gives:**
- One code base for phone, tablet and desktop.
- Installs to the home screen.
- Drafts and photos are saved **on the device** first, then uploaded through an outbox when the signal returns.
- A visible "not yet synced" counter.
- Resume after an interruption.
- Phone camera capture for damage photos.
- Customer presentation and signature screens.

**Documented limits:**
- **iPhone Safari has no background sync.** Uploads resume when the app is opened or comes back on screen, not while it is closed ([54](https://firt.dev/notes/pwa-ios/)).
- **Browsers can clear stored data under pressure.** The app asks for protected storage, and staff must not sign out with unsynced work ([55](https://web.dev/learn/pwa/offline-data)).
- **VIN barcode scanning needs a library**, because the browser feature is missing on iPhone ([56](https://caniuse.com/mdn-api_barcodedetector)).

**Only if background photo upload proves essential:** wrap the same app with a native shell (for example Capacitor) rather than writing a separate app.

**Issue with today's CRM:** reloading the page signs you out (a Phase 1 security choice). Offline drafts and resuming need a revised, security-reviewed session design.

---

## 7. Design decisions management must make (before Stage 2)

### Answers received 2026-10-21 and points that still need clarifying

| # | Management answer | Needs clarifying before U0 is final? |
|---|---|---|
| D-1 | **Provisionally approved:** separate account, contact, service location, served party and repaired item. Preserve existing customer history; avoid duplicates. | **Yes, three points:**<br>(a) Which matches count as a likely duplicate when existing customers are converted (same phone? same email? same address and name?). Proposal: flag for review and never merge automatically.<br>(b) Privacy: may a paying account (for example a landlord or warranty company) see the served party's contact details and photos? Proposal: yes for their own jobs only.<br>(c) When a vehicle is sold, is the old owner's history visible to the new owner or dealer? Proposal: the history stays with the VIN for internal use; outside users only see their own jobs. |
| D-2 | **Pending:** QuickBooks edition, installation and bookkeeping practices to be confirmed. No integration is implemented. | **Not blocking U0.** U0 will only reserve neutral places for QuickBooks references, mapping nothing. Needed before any QuickBooks design PR: edition and year, where it runs (office PC or hosted), one company file or several, whether the bookkeeper uses Customer:Job, Classes and Sales Reps, and how sales tax items are set up. |
| D-3 | **Track both** the repair/service category and the operating department or service-delivery method. | **Yes, one point:** is "operating department" the same thing as "service-delivery method", or are they two separate fields? Proposal: three fields per line: **service category** (PDR, tint, upholstery…), **operating department** (the team responsible: PDR/Hail, Window Tint, Interior Repair, Upholstery, Furniture/Commercial, or your list) and **delivery method** (mobile on-site, in-shop, dealer route). Please confirm the department list (M-20). |
| D-4 | **Support either** one combined work order or separate work orders per item, keeping the link to the original estimate. | **Yes, two points:**<br>(a) Invoicing: one invoice per estimate, or may separate work orders be invoiced separately, with partial or progress billing? This affects A/R and QuickBooks.<br>(b) Who decides the split, and when (at approval, or later by the scheduler)? Proposal: the scheduler, until work starts.<br>(c) **Scheduling impact** (raised 2026-10-21): see "D-4 follow-up" below. Tasks, not whole work orders, are scheduled, so the board behaves the same either way. |
| D-5 | **Re-authorization required** for price increases, material scope changes and newly added repairs. Authorization history kept, with who approved each revision. A **configurable authorization policy** for dealer and commercial accounts. | **Yes, three points:**<br>(a) Do price **decreases** or removed repairs need re-authorization? Proposal: no; notify the customer and record the change.<br>(b) Internal-only changes (cost, technician, schedule) need no customer re-authorization. Please confirm.<br>(c) For the configurable policy: is it per-person approval limits (dollar amount per contact), a PO requirement, approval by phone recorded by staff, and/or the portal? Proposal: all four, chosen per account. |
| D-6 | **Capture by line:** estimated labor hours, salesperson, technician assignment and commission/bonus eligibility. Final calculations need separate approval. | **Minor, one point:** the planned technician at estimate time can change when the work is scheduled. The estimate keeps the planned technician; the work order and time entries record the actual technicians, and the bonus calculation will use actuals. Please confirm. |

### Second round of answers (2026-10-21) and what they mean for the design

**D-1 (customer records)**
- **(a) Duplicates:** possible duplicates are flagged for review and only merged after approval. Nothing is merged automatically.
- **(b) Visibility:** a paying account (landlord, warranty company) may see the served party's details and photos for its own jobs.
- **(c) History:** a vehicle's or item's service history stays in the customer database. Entering the VIN again brings up all previous service records, so staff can tell whether new damage is a warranty issue on McDowells' work. *(Design: VIN search shows prior jobs with dates, technicians and photos, and links to the workmanship warranty claim records that already exist.)*

**D-2 (QuickBooks): QuickBooks Desktop Enterprise 24.0, installed on an office PC.** The bookkeeper's practice:
- each **technician is a QuickBooks Class**
- each **work order is a QuickBooks Job** (Customer:Job)
- **Sales Reps** are used to calculate commissions
- **materials and shipping are taxed at Idaho's 6%** when itemized on a customer invoice

What this means for the design:
- The account becomes the QuickBooks **Customer**, and each work order becomes a **Job** under it. A service location is shown on the job, not as a separate QuickBooks record.
- **Technician as Class:**
  - A line split between two technicians can carry only one Class in QuickBooks. The design will transfer one line per technician share (for example 60% / 40%), with amounts that add up exactly to the original line.
  - *Needs confirmation:* is that how the bookkeeper wants it, or should the Class be the lead technician only?
- Salesperson and sales-credit share are kept per line, mapped to QuickBooks **Sales Rep**. A line split between salespeople raises the same one-rep-per-line question.
- **Tax:**
  - "Materials and shipping taxed at 6% when itemized" matches today for materials and freight-in.
  - Today, separately stated **delivery** (freight-out) is *not* taxed, and **new fabrication labor** on upholstery *is* taxed. Both stay unchanged until the accountant's written answers (G1).
- **No integration is built yet.** U0 records this mapping as the target design only.

**D-3 (classification): four fields on every line.** Each field has a management-editable list:

| Field | Values |
|---|---|
| **Operating department** | 1. Furniture Repair · 2. Upholstery · 3. Auto Exterior · 4. Auto Interior · 5. Auto Cosmetic Shop |
| **Service-delivery method** | Dealer Route · Mobile (customer location other than a dealer) · In-Shop |
| **Responsible team** | Team 1: Dealer Route & Mobile · Team 2: In-Shop (it can default from the delivery method) |
| **Skill type** | Tinting · Paintless Dent Repair · Detailing · Upholstery Furniture · Upholstery Auto · Upholstery Commercial (hotels, restaurants, medical, fashion designers) · Upholstery Airplane · Upholstery Marine · Upholstery RV |

Plus the **service category** (the price list and estimating screen used).

**QuickBooks summarization:** a management-editable mapping decides how lines are grouped when sent to QuickBooks. Lines can go individually by skill type, or combined into groups you define (for example all upholstery skill types as one QuickBooks item), without changing the lines in RepairPro.

*Needs confirmation (gaps in the skill list):* which skill types cover
- auto interior repair (vinyl, leather, plastic)
- hail (under PDR?)
- headlight restoration, paint scratches and touch-up, polishing and paint correction, PPF, ceramic coatings (under Detailing, or new skill types?)
- furniture wood repair (Furniture Repair has no skill type yet)
- handyman work

Also, which department each service belongs to: for example, is window tint Auto Exterior or Auto Cosmetic Shop? A proposed mapping table will be in U0 for approval.

**D-4 (work orders and invoices):**
- Work orders can be **separate or combined**, and invoices can be **combined or separate**, chosen per estimate. A **default preference is stored per account**, because some auto and RV dealers want separate invoices sent in the same email and others want one combined invoice.
- An email can carry several separate invoices.
- Each invoice stays linked to its work orders, items and the original estimate.

**D-5 (authorization):**
- **Price decreases and removed repairs:** no re-authorization needed. *(Recorded as "removed repairs and price decreases" — see the confirmation below.)*
- **(b) Cost changes:** changes to internal costs never need the customer.
- **(c) PO:** a **"PO required" switch** on each estimate and each work order, defaulting from the account's setting. Some customers need a PO before paying the invoice. When it is on, the invoice can't be marked ready to send until the PO number is recorded.
- **Phone approvals:** recorded with who approved, when, how (phone), and which staff member took the approval.
- **Recon manager portal:** dealer recon managers will approve work there, and every approval is tracked to the person (part of the dealer portal, DP1).

> **Needs confirmation (conflict):** the answer says *"no re-authorization is needed for price increases or removed repairs."* The earlier decision (same day) said renewed authorization **is** required for **price increases**, material scope changes and new repairs. The question asked was about price **decreases**.
> - **Recommended reading:** price **increases** still need re-authorization; price **decreases** and removed repairs do not.
> - Please confirm, or tell us that increases really need no re-authorization (and whether that applies to every customer or only some).

**D-6 (technicians):**
- The planned technician(s) on the estimate can be changed at any time before the work.
- On the work order, the people who **actually** did the work are recorded. Technicians can be added or removed, and each one's share of the work is set as a **percentage** (shares must total 100%).
- **Bonuses are based on who actually did the work and their percentage.** The estimate's planned technicians are kept for comparison only.
- *(Existing technician labor-credit shares on invoices already work by percentage. The design extends this to work orders.)*

### Tax rules stated by the owner (2026-10-21)

**The rule as stated:**
- Idaho 6% sales tax applies to **materials charged separately** on a customer invoice.
- It also applies to **shipping charged separately** on a customer invoice.
- McDowells **pays Idaho use tax on all material purchases not invoiced to the customer**.

**Compared with the CRM today:**

| Charge | Stated rule | CRM today | Change needed (in G1) |
|---|---|---|---|
| Repair labor (all services) | Not taxed (implied) | Not taxed | None |
| New fabrication labor (upholstery) | Not taxed (implied) | **Taxed** | Make untaxed, **once confirmed** |
| Materials / parts charged to the customer | Taxed 6% | Taxed | None |
| Freight-in passed to the customer | Taxed 6% | Taxed | None |
| Delivery / shipping charged separately to the customer | Taxed 6% | **Not taxed** | Make taxable |
| Tax-exempt customers | (unchanged) | Not taxed | None |
| Materials bought and used but **not invoiced** (shop supplies, or materials covered by a labor or package price) | McDowells pays use tax | Use tax recorded only on "shop-consumed supplies" lines, at estimate level | Record use tax on **every** purchased material not billed to the customer, from its purchase cost, and add a use-tax report for filing |
| "Use tax paid, don't charge sales tax" option on invoiced lines (TAX-004) | Not part of the stated rule | Not built | **Drop** this option, if confirmed |

**Safeguards:**
- Invoices already issued keep their recorded tax.
- New rules apply only to new or re-priced estimates.
- Tax is figured per line, so mixed multi-item estimates come out right.

**To confirm before G1 is built:**
1. Is this the treatment your accountant has approved? (The earlier plan required the accountant's confirmation before any tax change.)
2. Is new fabrication labor on upholstery also untaxed?
3. Should TAX-004 be dropped?
4. Does the shop pay use tax on any purchases besides materials, such as equipment?
5. Still open from before (TAX-005): may tax treatment be changed on a work order after the customer approves?

### D-4 follow-up: separate or combined work orders, and technician scheduling

Management asked (2026-10-21) to keep **both** separate work orders per item and combined work orders, and to consider how they appear on technician scheduling. Proposed design, to be detailed and mocked up in U0:

1. **The thing that is scheduled is a work-order task, not the whole work order.** Each task covers one item (or part of one), and carries:
   - its department, skill type and estimated hours
   - its service location
   - its technician(s)

   A combined work order is one work order with several tasks. Separate work orders are several work orders, each with its own tasks. **The dispatcher board works the same way in both cases.**
2. **What the dispatcher sees:** each task shows as its own block on the technician's day. Every block shows:
   - the work-order number
   - the estimate number
   - "item 2 of 3"
   - the customer, address and estimated hours

   Blocks from the same estimate share a color or tag, so the dispatcher can see they belong together.
3. **The same site, the same trip:** tasks at the same service location are flagged, so the dispatcher can put them on the same day or the same technician and avoid a second trip. For example: the restaurant's booths and chairs, or the hotel's furniture on one floor.
4. **Different skills on one job:** for example a car's dents (PDR) and its seats (upholstery). The tasks go to different technicians, and possibly different days, without splitting the paperwork unless you want separate work orders.
5. **Capacity counts each task's hours once,** whether the tasks sit on one work order or several. Combining or splitting work orders never double-counts or loses scheduled hours.
6. **Splitting and combining after scheduling:** allowed until work starts on the affected tasks. Appointments move with their tasks, and the board shows the change. Once a task has started (or time is recorded on it), it can't move to another work order without a manager.
7. **What the technician sees:** on their phone, their own tasks for the day, each with the site address, item, photos and notes. They also see the other items on the same estimate, read-only, so they know the whole job.
8. **Invoicing follows D-4a,** to be decided: one invoice per estimate, or per work order. Scheduling doesn't depend on that choice.

### Original decision list

| # | Decision | Recommendation | Needed before |
|---|---|---|---|
| D-1 | **Customer database roles:** confirm Account (bill-to) vs Service location vs Served party vs Item | Approve as described in §1 | U0 |
| D-2 | **QuickBooks mapping:** one QuickBooks Customer per account, with Jobs per location? Which lists (Sales Rep, Class = department?, Customer Type, Job Type) and items? QuickBooks version, edition, hosting (office PC or Rightworks), payroll subscription | Decide with your bookkeeper | U0 |
| D-3 | **Departments** (M-20): type-of-work list vs the dashboard's mobile/shop list | Track both: department plus a mobile/in-shop field | U0 |
| D-4 | **Work orders from multi-item estimates:** one work order per estimate, or one per item or department? | One work order with item-level tasks | U0 |
| D-5 | **Revisions and approval rules:** what changes after approval need customer re-approval? Which customers need a signature, PO or portal approval? | Any price or line change needs re-approval; dealers by PO or portal | U0 |
| D-6 | **Commission and bonus basis** (record only; calculation later): which lines count, net of discounts?, earned at invoice or at payment? | Record the basis on each line now; decide the calculation with the accountant later | U0 |
| D-7 | **Photos:** who may see them (customer, dealer, internal), retention, storage limits | Internal by default; customer-visible flag per photo | U3 |
| D-8 | **Offline pricing:** may estimators quote offline with prices that might be out of date? | Yes, as a draft; prices are rechecked on sync before sending | M2 |
| D-9 | **Dealer portal scope** and an independent security review | Security design and review first | DP1 |
| D-10 | **Aircraft work scope** | Removed components only; partner A&P/IA signs off; burn documents required | S10 |
| D-11 | **Handyman work:** confirm any Idaho contractor registration or permit limits | Check before offering | S11 |
| D-12 | **Order of the specialized services** (S1–S11) | As listed; reorder freely | Stage 3 |
| D-13 | **Price groups** (dealer, retail, fleet, warranty) | Approve | U4 |

Already open and still needed: the logo (M-37); segments and lead sources (M-22); carrier agreements (M-10, M-11); the upholstery yardage guide (M-30); upholstery rates (M-32); tax answers (M-05 to M-08a).

---

## 8. Issues this creates for the existing CRM

1. **One vehicle or asset and one service per estimate** is built into the estimates table and the estimate, work order, invoice, report and test code. U2 must migrate every estimate to a one-item estimate with identical totals, and prove it with a before-and-after comparison.
2. **"Customer" mixes payer and served party.** Customers, third-party payers and fleet accounts overlap. U1 must merge them without losing history, and merge/duplicate logic must be redone.
3. **No photo storage exists** (one unused photo-link field). Photos grow the database and backups; the encrypted backup must include them.
4. **Money in the main tables is stored as decimal dollars,** with rounding to cents. New tables should use whole cents, and the migration must not change any total.
5. **The 9 hard-coded services and the category-based tax rule** must become data-driven service families with per-line tax, without changing current tax results until the accountant approves (G1).
6. **Overlapping records:**
   - two salesperson structures (being unified in A1)
   - jobs, production cases and schedule slots
   - a legacy scheduler alongside the new calendar
   - "QB Synced" sample labels with no real QuickBooks connection
7. **Phase 2.2 PDR pricing (PR #5) assumes one vehicle per estimate.** U2 must carry dents, packages and approvals onto items. The PR #5 test suites become the guard.
8. **Mobile offline conflicts with "reload signs you out"** (a security decision). It needs a security-reviewed session design.
9. **Security for outside users:** today any advisor can see all customers (backlog SEC-01). A dealer portal needs strict per-account access, checked on the server.
10. **SQLite capacity** with photos, offline sync and about 40 users is unproven (OPS-01). The load test becomes more important.
11. **Hail stays per panel**, and PDR is per dent. Both fit the item and line design. Hail per dent is not proposed.
12. **Existing planned PR codes change:**
    - B1 becomes U4
    - B3/B4 become S1
    - B2 becomes S2
    - A4 becomes U2
    - C1–C3 become S6–S8
    - Marketing capture moves into A2

    The register keeps every requirement ID; only the planned PR changes once this is approved.

---

## 9. Launch-essential vs optional future features

"Production launch" means RepairPro becomes McDowells' real system of record for customers, estimates, work orders, invoices and payments.

| Needed for production launch | Optional / later |
|---|---|
| Phase 2.2 (PR #5) accepted | Offline drafts and upload queue (M2) |
| A1, A2, B0, A5 | Customer signature on screen (M3); approval by PO, phone or in person is enough at launch |
| Universal foundation U0–U4 (customer database, multi-item estimates, photos, price lists for the services offered at launch) | Dealer portal (DP1) |
| The specialized workflows for the services McDowells sells on day one (**management to choose** which of S1–S11) | Dealer route mode (DR1), unless dealer work is a launch priority |
| Authorization history and the configurable authorization policy (D-5) | Hail scanner imports, AI photo suggestions |
| Tax rules approved by the accountant (G1) | Good/better/best presentation polish |
| Credits, refunds and voids (BILL-01) | Dashboard tabs beyond the essentials (E3), alerts |
| QuickBooks Desktop transfer, or an approved manual bookkeeping procedure (INT-01) | Marketing campaigns and email sending (F2) |
| Work orders and a usable schedule (D1 basics) | Technician time clock (D2), if payroll stays manual at launch |
| Encrypted backups with a tested restore; independent security review; hosting with HTTPS; 40-user load test (SEC-02, HOST-01, OPS-01) | Customer and dealer self-service portals |
| Staff logins and permissions reviewed; staff training and a short user guide | Upholstery yardage nesting (S8), until the guide is finished |

Commission and bonus **calculations** are not needed at launch if they stay manual, because the attribution data is recorded from A1 and U2 onward. They become essential when management wants RepairPro to calculate them.

---

## 10. The first design PR: U0 "Universal estimate design" (documents and mockups only)

**What U0 is:** a documentation-only pull request, like PR #6. It changes no code, database, prices or permissions. It turns this strategy into a precise blueprint that management approves before any foundation code (U1–U4) is written.

**What U0 will contain:**
1. **Data model in plain English, with a technical appendix:**
   - account, contact, service location, served party, item
   - claim / authorization
   - estimate, item on an estimate, revision, line
   - authorization record, work-order link
   - Every field is listed with who may see and change it.
2. **The estimate line specification:** every field from Layer 2, including the attribution fields (D-6) and the three classification fields (D-3).
3. **Migration plan:** how today's customers, contacts, vehicles, assets, third-party payers, fleet accounts, estimates, PDR dents, packages and invoices move to the new structure. Includes the **before-and-after checks** that prove every total, tax amount, payment and history entry is unchanged, and the duplicate-review process (D-1a).
4. **Authorization policy design (D-5):** which changes need re-authorization, the per-account policy options, and how each revision's approver is recorded.
5. **Work-order linkage and how it shows on technician scheduling (D-4):** one combined or several work orders, each linked back to its estimate, items and lines. Includes the invoicing options for you to choose (D-4a), and the scheduling design below.
6. **Phone and tablet mockups** of the new estimate: the item list, adding an item, an item's diagram and lines, the totals, and the customer view. These are reviewed at phone size first.
7. **Accounting safeguards:** per-line tax kept identical to today's results until G1; no double counting of tax, revenue or credit across items; money stored in whole cents in new tables.
8. **Placeholders only:** neutral fields reserved for QuickBooks references and commission/bonus rule versions. No mapping and no calculations.
9. **Test plan** for U1 and U2: automated checks, browser checks at phone, tablet and desktop sizes, and the owner's Codespaces checklist.
10. **Open questions list:** anything still unanswered, with a recommendation for each.

**What U0 needs before it can be finished:** your answers to the clarifying points above (D-1 a–c, D-3, D-4 a–b, D-5 a–c, D-6). It can be started while PR #5 and PR #6 are being reviewed, but only with your approval.

**What you will be able to do after U0 is approved:** review the exact design of the foundation on paper and on phone mockups. U1 (the customer database) can then be built to that design.
