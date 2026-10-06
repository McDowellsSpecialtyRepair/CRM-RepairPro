import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

// ============= CUSTOMERS =============
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerNumber: text("customer_number").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  customerType: text("customer_type").notNull(), // retail, dealership, insurance, fleet, commercial
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zip: text("zip"),
  notes: text("notes"),
  referralSource: text("referral_source"),
  taxExempt: integer("tax_exempt").default(0),
  creditLimit: real("credit_limit").default(0),
  status: text("status").notNull().default("active"), // active, inactive
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= CONTACTS =============
export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  isPrimary: integer("is_primary").default(0),
});

// ============= VEHICLES =============
export const vehicles = sqliteTable("vehicles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  vin: text("vin"),
  year: text("year"),
  make: text("make"),
  model: text("model"),
  trim: text("trim"),
  bodyClass: text("body_class"),
  vehicleType: text("vehicle_type").notNull().default("auto"), // auto, rv, marine, motorcycle, other
  color: text("color"),
  engineInfo: text("engine_info"), // e.g. "5.4L V8 Gasoline"
  fuelType: text("fuel_type"),
  gvwr: text("gvwr"), // Gross Vehicle Weight Rating
  plantCountry: text("plant_country"),
  licensePlate: text("license_plate"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= SERVICE HISTORY (aggregated from jobs, estimates, invoices) =============
export const serviceHistory = sqliteTable("service_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  vehicleId: integer("vehicle_id"),
  assetId: integer("asset_id"),
  jobId: integer("job_id"),
  estimateId: integer("estimate_id"),
  invoiceId: integer("invoice_id"),
  serviceDate: text("service_date").notNull(),
  serviceType: text("service_type").notNull(),
  description: text("description"),
  technician: text("technician"),
  warrantyMonths: integer("warranty_months"),
  warrantyExpiry: text("warranty_expiry"),
  warrantyStatus: text("warranty_status").default("active"), // active, expired, none
  cost: real("cost"),
  status: text("status").notNull().default("completed"), // pending, in_progress, completed, cancelled
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= ASSETS (non-vehicle: planes, hotels, restaurants, homes, offices) =============
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  assetType: text("asset_type").notNull(), // plane, hotel, restaurant, rv, marine, home, office
  name: text("name"),
  description: text("description"),
  location: text("location"),
  notes: text("notes"),
});

// ============= JOBS / WORK ORDERS =============
export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobNumber: text("job_number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  vehicleId: integer("vehicle_id"),
  assetId: integer("asset_id"),
  serviceType: text("service_type").notNull(), // pdr, hail, window_tint, interior_repair, rv_interior, rv_upholstery, marine_interior, marine_upholstery, upholstery
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, scheduled, in_progress, completed, cancelled
  assignedTech: text("assigned_tech"),
  assignedTechId: integer("assigned_tech_id"),
  scheduledDate: text("scheduled_date"),
  completedDate: text("completed_date"),
  priority: text("priority").notNull().default("normal"), // low, normal, high, urgent
  insuranceClaim: text("insurance_claim"),
  insuranceAdjuster: text("insurance_adjuster"),
  warrantyMonths: integer("warranty_months"),
  warrantyExpiry: text("warranty_expiry"),
  warrantyStatus: text("warranty_status").default("active"), // active, expired, none
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= ESTIMATES =============
export const estimates = sqliteTable("estimates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  estimateNumber: text("estimate_number").notNull().unique(),
  jobId: integer("job_id"),
  customerId: integer("customer_id").notNull(),
  vehicleId: integer("vehicle_id"),
  assetId: integer("asset_id"),
  serviceType: text("service_type").notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, approved, rejected, expired, invoiced
  subtotal: real("subtotal").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull().default(0),
  notes: text("notes"),
  validUntil: text("valid_until"),
  approvedDate: text("approved_date"),
  invoiceId: integer("invoice_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= ESTIMATE LINE ITEMS =============
export const estimateLineItems = sqliteTable("estimate_line_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  allocationVersion: integer("allocation_version").notNull().default(1),
  lineType: text("line_type").notNull().default("legacy"),
  estimateId: integer("estimate_id").notNull(),
  serviceCategory: text("service_category").notNull(), // pdr_dent, pdr_hail, interior_vinyl, interior_fabric, upholstery, window_tint, labor, material, other
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").notNull().default("each"), // each, hour, inch, panel, sqft
  unitPrice: real("unit_price").notNull().default(0),
  total: real("total").notNull().default(0),
  panelLocation: text("panel_location"), // for PDR: which panel
  damageSize: text("damage_size"), // for PDR: dent size category
  damageSeverity: text("damage_severity"), // minor, moderate, severe
  unitCost: real("unit_cost").notNull().default(0),
  useTaxRate: real("use_tax_rate").notNull().default(0),
  taxNote: text("tax_note").notNull().default(""),
  repairAction: text("repair_action").notNull().default("repair"),
});

// ============= INVOICES =============
export const invoices = sqliteTable("invoices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  jobId: integer("job_id"),
  estimateId: integer("estimate_id"),
  status: text("status").notNull().default("draft"), // draft, sent, partial, paid, overdue, void
  subtotal: real("subtotal").notNull().default(0),
  taxRate: real("tax_rate").notNull().default(0),
  taxAmount: real("tax_amount").notNull().default(0),
  discount: real("discount").notNull().default(0),
  total: real("total").notNull().default(0),
  amountPaid: real("amount_paid").notNull().default(0),
  balanceDue: real("balance_due").notNull().default(0),
  issueDate: text("issue_date").notNull(),
  dueDate: text("due_date"),
  notes: text("notes"),
  qbSynced: integer("qb_synced").default(0),
  qbTxnId: text("qb_txn_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= INVOICE LINE ITEMS =============
export const invoiceLineItems = sqliteTable("invoice_line_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lineType: text("line_type").notNull().default("legacy"),
  invoiceId: integer("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: real("quantity").notNull().default(1),
  unit: text("unit").notNull().default("each"),
  unitPrice: real("unit_price").notNull().default(0),
  total: real("total").notNull().default(0),
  serviceCategory: text("service_category").notNull().default(""),
  unitCost: real("unit_cost").notNull().default(0),
  useTaxRate: real("use_tax_rate").notNull().default(0),
  taxNote: text("tax_note").notNull().default(""),
  repairAction: text("repair_action").notNull().default("repair"),
});

// ============= PAYMENTS =============
export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  paymentNumber: text("payment_number").notNull().unique(),
  idempotencyKey: text("idempotency_key").unique(),
  invoiceId: integer("invoice_id").notNull(),
  customerId: integer("customer_id").notNull(),
  amount: real("amount").notNull(),
  paymentMethod: text("payment_method").notNull(), // cash, check, credit_card, ach, insurance
  paymentDate: text("payment_date").notNull(),
  reference: text("reference"),
  qbSynced: integer("qb_synced").default(0),
  qbTxnId: text("qb_txn_id"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= SERVICE TEMPLATES =============
export const serviceTemplates = sqliteTable("service_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  serviceType: text("service_type").notNull(), // pdr, hail, window_tint, interior_repair, rv_interior, rv_upholstery, marine_interior, marine_upholstery, upholstery
  description: text("description"),
  basePrice: real("base_price").notNull().default(0),
  unitType: text("unit_type").notNull().default("each"),
  isActive: integer("is_active").default(1),
});

// ============= PRICING MATRICES (PDR dent size pricing) =============
export const pricingMatrices = sqliteTable("pricing_matrices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  matrixType: text("matrix_type").notNull(), // pdr_dent, pdr_hail, hail_insurance, window_tint, interior_vinyl, interior_fabric, upholstery, labor, material
  panel: text("panel"), // hood, door, fender, roof, etc.
  sizeCategory: text("size_category"), // dime, nickel, quarter, half_dollar, softball
  price: real("price").notNull().default(0),
  vehicleCategory: text("vehicle_category"), // compact, sedan, suv, truck, luxury
  insuranceCompany: text("insurance_company"), // State Farm, Allstate, Progressive, etc.
  dentCountRange: text("dent_count_range"), // 1-5, 6-15, 16-30, 31-50, 51-75, 76-100, 101-150, 151-200, 200+
  filmType: text("film_type"), // standard, ceramic, carbon, metallic (for window tint)
  damageType: text("damage_type"), // crack, tear, burn, fade, puncture (for interior)
  severity: text("severity"), // minor, moderate, severe
  unitType: text("unit_type"), // each, panel, hour, linear_ft, sq_ft
  notes: text("notes"),
});

// ============= MARKETING CAMPAIGNS =============
export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  campaignType: text("campaign_type").notNull(), // email, sms, follow_up, referral, seasonal
  status: text("status").notNull().default("draft"), // draft, active, completed, paused
  targetSegment: text("target_segment"), // all, retail, dealership, insurance, fleet, commercial
  startDate: text("start_date"),
  endDate: text("end_date"),
  budget: real("budget").default(0),
  sentCount: integer("sent_count").default(0),
  responseCount: integer("response_count").default(0),
  conversionCount: integer("conversion_count").default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= ACTIVITIES / COMMUNICATION LOG =============
export const activities = sqliteTable("activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id"),
  jobId: integer("job_id"),
  estimateId: integer("estimate_id"),
  invoiceId: integer("invoice_id"),
  activityType: text("activity_type").notNull(), // call, email, sms, note, estimate_created, invoice_sent, payment_received, job_update
  description: text("description").notNull(),
  performedBy: text("performed_by"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= QB SYNC LOG =============
export const qbSyncLog = sqliteTable("qb_sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  syncDirection: text("sync_direction").notNull(), // push, pull
  recordType: text("record_type").notNull(), // customer, invoice, payment, item
  recordId: integer("record_id"),
  qbTxnId: text("qb_txn_id"),
  status: text("status").notNull().default("pending"), // pending, success, error
  message: text("message"),
  syncedAt: text("synced_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= USERS =============
// Saved preview report layouts. Staff ownership and authorization are a separate
// production migration, not inferred from the demo users table.
export const reportDefinitions = sqliteTable("report_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  config: text("config").notNull(),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  role: text("role").notNull().default("admin"), // admin, estimator, technician, office_manager, accountant
  email: text("email"),
});

// ============= TYPES =============
export type Customer = typeof customers.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type Estimate = typeof estimates.$inferSelect;
export type EstimateLineItem = typeof estimateLineItems.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ServiceTemplate = typeof serviceTemplates.$inferSelect;
export type PricingMatrix = typeof pricingMatrices.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type QbSyncLog = typeof qbSyncLog.$inferSelect;
export type User = typeof users.$inferSelect;

// ============= TECHNICIANS =============
export const technicians = sqliteTable("technicians", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id"),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  skillAreas: text("skill_areas").notNull(), // comma-separated: pdr,hail,interior_repair,upholstery,window_tint
  technicianType: text("technician_type").notNull(), // mobile, in_shop
  status: text("status").notNull().default("active"), // active, on_leave, inactive
  color: text("color").notNull().default("#20808D"), // calendar color
  capacity: text("capacity"), // comma-separated day capacities per skill
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= SCHEDULE SLOTS =============
export const scheduleSlots = sqliteTable("schedule_slots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: integer("job_id"),
  customerId: integer("customer_id"),
  technicianId: integer("technician_id"),
  date: text("date").notNull(), // YYYY-MM-DD
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM
  durationHours: real("duration_hours").notNull().default(2),
  slotType: text("slot_type").notNull(), // estimate, work, travel
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= CUSTOMER BOOKINGS =============
export const bookings = sqliteTable("bookings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  bookingNumber: text("booking_number").notNull().unique(),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  vehicleInfo: text("vehicle_info"), // year/make/model
  serviceType: text("service_type").notNull(), // pdr, hail, window_tint, interior_repair, rv_interior, rv_upholstery, marine_interior, marine_upholstery, upholstery
  bookingType: text("booking_type").notNull(), // estimate, work
  preferredDate: text("preferred_date"),
  preferredTime: text("preferred_time"),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, confirmed, declined, completed
  scheduledSlotId: integer("scheduled_slot_id"),
  confirmedDate: text("confirmed_date"),
  confirmedTime: text("confirmed_time"),
  assignedTechnicianId: integer("assigned_technician_id"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type Technician = typeof technicians.$inferSelect;
export type ScheduleSlot = typeof scheduleSlots.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type ServiceHistory = typeof serviceHistory.$inferSelect;

// ============= COI (Certificate of Insurance) =============
export const coiCertificates = sqliteTable("coi_certificates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  certificateName: text("certificate_name").notNull(),
  insuranceCompany: text("insurance_company").notNull(),
  policyNumber: text("policy_number"),
  policyType: text("policy_type"), // general liability, garage keepers, auto, workers comp, other
  certificateHolder: text("certificate_holder"),
  coverageLimit: text("coverage_limit"),
  effectiveDate: text("effective_date"),
  expirationDate: text("expiration_date"),
  agentName: text("agent_name"),
  agentEmail: text("agent_email"),
  agentPhone: text("agent_phone"),
  status: text("status").notNull().default("active"), // requested, active, expiring, expired, cancelled
  requiredBeforeWork: integer("required_before_work").default(0),
  documentUrl: text("document_url"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= THIRD-PARTY PAYERS (insurance, warranty, leasing, etc.) =============
export const thirdPartyPayers = sqliteTable("third_party_payers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  payerType: text("payer_type").notNull(), // insurance, warranty, leasing, dealership, fleet, property_manager, other
  payerName: text("payer_name").notNull(),
  contactName: text("contact_name"),
  contactTitle: text("contact_title"),
  email: text("email"),
  phone: text("phone"),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZip: text("billing_zip"),
  accountNumber: text("account_number"),
  claimNumber: text("claim_number"),
  authorizationNumber: text("authorization_number"),
  poRequired: integer("po_required").default(0),
  approvalRequired: integer("approval_required").default(0),
  paymentTerms: text("payment_terms"),
  taxExempt: integer("tax_exempt").default(0),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= FLEET ACCOUNTS =============
export const fleetAccounts = sqliteTable("fleet_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  fleetName: text("fleet_name").notNull(),
  fleetSize: integer("fleet_size").default(0),
  accountNumber: text("account_number"),
  billingCycle: text("billing_cycle"), // per_job, weekly, monthly, consolidated
  paymentTerms: text("payment_terms"),
  contractedRateType: text("contracted_rate_type"), // matrix, discount, fixed, custom
  pdrDiscountPercent: real("pdr_discount_percent").default(0),
  hailDiscountPercent: real("hail_discount_percent").default(0),
  interiorDiscountPercent: real("interior_discount_percent").default(0),
  upholsteryDiscountPercent: real("upholstery_discount_percent").default(0),
  tintDiscountPercent: real("tint_discount_percent").default(0),
  laborRate: real("labor_rate").default(0),
  poRequired: integer("po_required").default(0),
  authorizationRequired: integer("authorization_required").default(0),
  defaultThirdPartyPayerId: integer("default_third_party_payer_id"),
  contractStartDate: text("contract_start_date"),
  contractEndDate: text("contract_end_date"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= FLEET AUTHORIZED CONTACTS =============
export const fleetAuthorizedContacts = sqliteTable("fleet_authorized_contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fleetAccountId: integer("fleet_account_id").notNull(),
  customerId: integer("customer_id").notNull(),
  name: text("name").notNull(),
  title: text("title"),
  email: text("email"),
  phone: text("phone"),
  canApproveEstimates: integer("can_approve_estimates").default(0),
  canApproveWork: integer("can_approve_work").default(0),
  canApproveInvoices: integer("can_approve_invoices").default(0),
  approvalLimit: real("approval_limit").default(0),
  notes: text("notes"),
});

// ============= WARRANTY CLAIMS =============
export const warrantyClaims = sqliteTable("warranty_claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  claimNumber: text("claim_number").notNull().unique(),
  customerId: integer("customer_id").notNull(),
  vehicleId: integer("vehicle_id"),
  assetId: integer("asset_id"),
  serviceHistoryId: integer("service_history_id"),
  originalJobId: integer("original_job_id"),
  originalInvoiceId: integer("original_invoice_id"),
  correctiveJobId: integer("corrective_job_id"),
  claimDate: text("claim_date").notNull(),
  warrantyExpiry: text("warranty_expiry"),
  status: text("status").notNull().default("open"), // open, inspecting, approved, denied, resolved
  issueDescription: text("issue_description"),
  inspectionFindings: text("inspection_findings"),
  resolution: text("resolution"),
  responsibility: text("responsibility"), // warranty, goodwill, customer_pay, material_failure, excluded
  assignedTech: text("assigned_tech"),
  resolvedDate: text("resolved_date"),
  laborHours: real("labor_hours").default(0),
  claimCost: real("claim_cost").default(0),
  notes: text("notes"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= ASSET DETAILS (furniture, booths, marine, aircraft, RV, office) =============
export const assetDetails = sqliteTable("asset_details", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  customerId: integer("customer_id").notNull(),
  assetId: integer("asset_id"),
  assetCategory: text("asset_category").notNull(), // furniture, restaurant_booth, hotel_room, medical_table, marine_seat, aircraft_seat, rv_interior, office_furniture
  locationName: text("location_name"),
  building: text("building"),
  floor: text("floor"),
  roomNumber: text("room_number"),
  area: text("area"),
  itemName: text("item_name"),
  itemType: text("item_type"), // chair, sofa, booth_back, booth_seat, cushion, dash, panel, seat, wall_panel
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  materialType: text("material_type"), // vinyl, leather, plastic, fabric, cloth, marine_vinyl, sunbrella
  fabricType: text("fabric_type"),
  color: text("color"),
  pattern: text("pattern"),
  dimensions: text("dimensions"),
  quantity: integer("quantity").default(1),
  condition: text("condition"), // excellent, good, fair, poor
  damageLocation: text("damage_location"),
  damageDescription: text("damage_description"),
  repairNotes: text("repair_notes"),
  photoUrl: text("photo_url"),
  replacementValue: real("replacement_value").default(0),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

// ============= TAX JURISDICTIONS =============
export const taxJurisdictions = sqliteTable("tax_jurisdictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jurisdictionName: text("jurisdiction_name").notNull(),
  city: text("city"),
  county: text("county"),
  state: text("state"),
  zip: text("zip"),
  taxRate: real("tax_rate").notNull().default(0),
  taxCode: text("tax_code"),
  qbTaxCode: text("qb_tax_code"),
  taxExemptAllowed: integer("tax_exempt_allowed").default(0),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
});

export type CoiCertificate = typeof coiCertificates.$inferSelect;
export type ThirdPartyPayer = typeof thirdPartyPayers.$inferSelect;
export type FleetAccount = typeof fleetAccounts.$inferSelect;
export type FleetAuthorizedContact = typeof fleetAuthorizedContacts.$inferSelect;
export type WarrantyClaim = typeof warrantyClaims.$inferSelect;
export type AssetDetail = typeof assetDetails.$inferSelect;
export type TaxJurisdiction = typeof taxJurisdictions.$inferSelect;

export const insertCustomerSchema = createInsertSchema(customers);
export const insertContactSchema = createInsertSchema(contacts);
export const insertVehicleSchema = createInsertSchema(vehicles);
export const insertServiceHistorySchema = createInsertSchema(serviceHistory);
export const insertAssetSchema = createInsertSchema(assets);
export const insertJobSchema = createInsertSchema(jobs);
export const insertEstimateSchema = createInsertSchema(estimates);
export const insertEstimateLineItemSchema = createInsertSchema(estimateLineItems);
export const insertInvoiceSchema = createInsertSchema(invoices);
export const insertInvoiceLineItemSchema = createInsertSchema(invoiceLineItems);
export const insertPaymentSchema = createInsertSchema(payments);
export const insertServiceTemplateSchema = createInsertSchema(serviceTemplates);
export const insertPricingMatrixSchema = createInsertSchema(pricingMatrices);
export const insertCampaignSchema = createInsertSchema(campaigns);
export const insertActivitySchema = createInsertSchema(activities);
export const insertQbSyncLogSchema = createInsertSchema(qbSyncLog);
export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true });
export const insertCoiCertificateSchema = createInsertSchema(coiCertificates);
export const insertThirdPartyPayerSchema = createInsertSchema(thirdPartyPayers);
export const insertFleetAccountSchema = createInsertSchema(fleetAccounts);
export const insertFleetAuthorizedContactSchema = createInsertSchema(fleetAuthorizedContacts);
export const insertWarrantyClaimSchema = createInsertSchema(warrantyClaims);
export const insertAssetDetailSchema = createInsertSchema(assetDetails);
export const insertTaxJurisdictionSchema = createInsertSchema(taxJurisdictions);
