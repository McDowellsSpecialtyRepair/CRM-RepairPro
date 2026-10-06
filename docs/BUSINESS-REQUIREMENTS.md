# McDowells Business Requirements

The owner wants a unified service-business system that staff can operate reliably, including on Android. Known defects should be fixed and verified before a review; the owner should not repeatedly be asked to authorize obvious corrective work.

## Business scope

- **Services:** Auto PDR, auto hail, window tint, auto interior repair, RV interior, RV upholstery, marine interior, marine upholstery, furniture and commercial upholstery.
- **Service isolation:** PDR must not be offered on furniture. Vehicle, boat, RV and furniture selections, templates, matrices and diagrams must match the service; manual entry must remain usable where no verified matrix exists.
- **Furniture:** Sofa, recliner, dining chair, loveseat, ottoman and commercial/booth variations matter. Marine diagrams need distinguishable open-bow inboard/outboard and open-bow inboard options.
- **Staff:** Up to 40 technicians, sales and support staff; distinct logins, authorization levels, login history and auditable changes.
- **Website:** Customer payment must start through Mcdowellsrepair.com. Dealer customers need a portal to authorize repairs to their vehicles.

## Estimating and billing

- **Line items:** Explicit repair labor, parts/material quantities and customer prices, internal purchase costs, inbound freight versus delivery, sales tax and internal use tax.
- **Repair options:** Service-appropriate repair, replacement, removal/installation, reupholstery, foam and fabrication choices; multiple alternatives should not accidentally inflate accepted work.
- **Tax:** Owner requested parts-only tax for repair work. Current implementation includes a separately selected taxable fabrication category and freight/supply distinctions; accountant approval of the final policy is required.
- **People:** Multiple technicians per labor line and multiple salespeople per invoice, with clearly defined percentage splits. Technician compensation is based on accumulated labor sales produced, not total invoices including material/tax.
- **Lifecycle:** Draft, customer delivery, approval, work order, scheduling, production/QC, invoice, payment and follow-up must be distinct. “Issued” or “approved” must not imply an email was sent.
- **History:** VIN lookup/autofill, same-VIN estimates and invoices across customers, duplicate customer warnings and safe merges.
- **Merge:** Ask whether changed phone/email/address replaces old information or should be retained as an alternate; do not discard history or merge solely on a similar name.
- **Access:** Work-order and estimate lists must open editable detail, including schedule, technician, salesperson and urgency where allowed.

## Management and accounting

- **Operations:** Unsold-estimate follow-up, technician WIP, next available schedule date by department, sold-but-uncompleted value and production queues.
- **Reporting:** Easy filtering, grouping, calculations and useful operational/financial reports, with readable print/export and explicit definitions.
- **Accounting:** QuickBooks Desktop Enterprise handoff, exact invoice/payment/tax mapping and reconciliation; no simulated success accepted as a live transfer.
- **Pricing catalog:** All services and saved matrix tables visible before printing; full catalog, not just current tab. Source-backed insurer pricing must retain provenance and caveats.
- **Marketing:** Delivery, response, attributable sales and actual ROI rather than presentation-only counters.

## Operational constraints

The first real owner identity is service@mcdowellsrepair.com. Test customers and any explicitly approved test messages must use that mailbox; do not send to sample customer addresses embedded in source. Do not reset existing staff accounts or reconnect social-media providers as part of a developer evaluation without authorization.

The implementation is incomplete. This requirements inventory describes intended behavior, not a claim that every item is already implemented.
