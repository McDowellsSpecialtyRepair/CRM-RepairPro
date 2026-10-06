import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { customers, contacts, vehicles, assets, jobs, estimates, estimateLineItems, invoices, invoiceLineItems, payments, serviceTemplates, pricingMatrices, campaigns, activities, qbSyncLog, users, technicians, scheduleSlots, bookings, serviceHistory, coiCertificates, thirdPartyPayers, fleetAccounts, fleetAuthorizedContacts, warrantyClaims, assetDetails, taxJurisdictions } from '@shared/schema';

export const sqlite = new Database(process.env.DB_PATH || "data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite);

// Auto-create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    email TEXT
  );
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_number TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    company_name TEXT,
    customer_type TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    mobile TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    notes TEXT,
    referral_source TEXT,
    tax_exempt INTEGER DEFAULT 0,
    credit_limit REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    is_primary INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    vin TEXT,
    year TEXT,
    make TEXT,
    model TEXT,
    trim TEXT,
    body_class TEXT,
    vehicle_type TEXT NOT NULL DEFAULT 'auto',
    color TEXT,
    engine_info TEXT,
    fuel_type TEXT,
    gvwr TEXT,
    plant_country TEXT,
    license_plate TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS service_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    asset_id INTEGER,
    job_id INTEGER,
    estimate_id INTEGER,
    invoice_id INTEGER,
    service_date TEXT NOT NULL,
    service_type TEXT NOT NULL,
    description TEXT,
    technician TEXT,
    warranty_months INTEGER,
    warranty_expiry TEXT,
    warranty_status TEXT DEFAULT 'active',
    cost REAL,
    status TEXT NOT NULL DEFAULT 'completed',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    asset_type TEXT NOT NULL,
    name TEXT,
    description TEXT,
    location TEXT,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    asset_id INTEGER,
    service_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    assigned_tech TEXT,
    scheduled_date TEXT,
    completed_date TEXT,
    priority TEXT NOT NULL DEFAULT 'normal',
    insurance_claim TEXT,
    insurance_adjuster TEXT,
    warranty_months INTEGER,
    warranty_expiry TEXT,
    warranty_status TEXT DEFAULT 'active',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_number TEXT NOT NULL UNIQUE,
    job_id INTEGER,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    asset_id INTEGER,
    service_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    subtotal REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    notes TEXT,
    valid_until TEXT,
    approved_date TEXT,
    invoice_id INTEGER,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS estimate_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_id INTEGER NOT NULL,
    service_category TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'each',
    unit_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    panel_location TEXT,
    damage_size TEXT,
    damage_severity TEXT
  );
  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    job_id INTEGER,
    estimate_id INTEGER,
    status TEXT NOT NULL DEFAULT 'draft',
    subtotal REAL NOT NULL DEFAULT 0,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_amount REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    amount_paid REAL NOT NULL DEFAULT 0,
    balance_due REAL NOT NULL DEFAULT 0,
    issue_date TEXT NOT NULL,
    due_date TEXT,
    notes TEXT,
    qb_synced INTEGER DEFAULT 0,
    qb_txn_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invoice_line_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'each',
    unit_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT NOT NULL UNIQUE,
    idempotency_key TEXT,
    invoice_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    reference TEXT,
    qb_synced INTEGER DEFAULT 0,
    qb_txn_id TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS service_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    service_type TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL DEFAULT 0,
    unit_type TEXT NOT NULL DEFAULT 'each',
    is_active INTEGER DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS pricing_matrices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    matrix_type TEXT NOT NULL,
    panel TEXT,
    size_category TEXT,
    price REAL NOT NULL DEFAULT 0,
    vehicle_category TEXT,
    insurance_company TEXT,
    dent_count_range TEXT,
    film_type TEXT,
    damage_type TEXT,
    severity TEXT,
    unit_type TEXT,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    campaign_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    target_segment TEXT,
    start_date TEXT,
    end_date TEXT,
    budget REAL DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    job_id INTEGER,
    estimate_id INTEGER,
    invoice_id INTEGER,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    performed_by TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS qb_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_direction TEXT NOT NULL,
    record_type TEXT NOT NULL,
    record_id INTEGER,
    qb_txn_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT,
    synced_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS technicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    skill_areas TEXT NOT NULL,
    technician_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    color TEXT NOT NULL DEFAULT '#20808D',
    capacity TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS schedule_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER,
    customer_id INTEGER,
    technician_id INTEGER,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_hours REAL NOT NULL DEFAULT 2,
    slot_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    vehicle_info TEXT,
    service_type TEXT NOT NULL,
    booking_type TEXT NOT NULL,
    preferred_date TEXT,
    preferred_time TEXT,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    scheduled_slot_id INTEGER,
    confirmed_date TEXT,
    confirmed_time TEXT,
    assigned_technician_id INTEGER,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS coi_certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    certificate_name TEXT NOT NULL,
    insurance_company TEXT NOT NULL,
    policy_number TEXT,
    policy_type TEXT,
    certificate_holder TEXT,
    coverage_limit TEXT,
    effective_date TEXT,
    expiration_date TEXT,
    agent_name TEXT,
    agent_email TEXT,
    agent_phone TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    required_before_work INTEGER DEFAULT 0,
    document_url TEXT,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS third_party_payers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    payer_type TEXT NOT NULL,
    payer_name TEXT NOT NULL,
    contact_name TEXT,
    contact_title TEXT,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    account_number TEXT,
    claim_number TEXT,
    authorization_number TEXT,
    po_required INTEGER DEFAULT 0,
    approval_required INTEGER DEFAULT 0,
    payment_terms TEXT,
    tax_exempt INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fleet_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    fleet_name TEXT NOT NULL,
    fleet_size INTEGER DEFAULT 0,
    account_number TEXT,
    billing_cycle TEXT,
    payment_terms TEXT,
    contracted_rate_type TEXT,
    pdr_discount_percent REAL DEFAULT 0,
    hail_discount_percent REAL DEFAULT 0,
    interior_discount_percent REAL DEFAULT 0,
    upholstery_discount_percent REAL DEFAULT 0,
    tint_discount_percent REAL DEFAULT 0,
    labor_rate REAL DEFAULT 0,
    po_required INTEGER DEFAULT 0,
    authorization_required INTEGER DEFAULT 0,
    default_third_party_payer_id INTEGER,
    contract_start_date TEXT,
    contract_end_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS fleet_authorized_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fleet_account_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    can_approve_estimates INTEGER DEFAULT 0,
    can_approve_work INTEGER DEFAULT 0,
    can_approve_invoices INTEGER DEFAULT 0,
    approval_limit REAL DEFAULT 0,
    notes TEXT
  );
  CREATE TABLE IF NOT EXISTS warranty_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    claim_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL,
    vehicle_id INTEGER,
    asset_id INTEGER,
    service_history_id INTEGER,
    original_job_id INTEGER,
    original_invoice_id INTEGER,
    corrective_job_id INTEGER,
    claim_date TEXT NOT NULL,
    warranty_expiry TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    issue_description TEXT,
    inspection_findings TEXT,
    resolution TEXT,
    responsibility TEXT,
    assigned_tech TEXT,
    resolved_date TEXT,
    labor_hours REAL DEFAULT 0,
    claim_cost REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS asset_details (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    asset_id INTEGER,
    asset_category TEXT NOT NULL,
    location_name TEXT,
    building TEXT,
    floor TEXT,
    room_number TEXT,
    area TEXT,
    item_name TEXT,
    item_type TEXT,
    manufacturer TEXT,
    model TEXT,
    serial_number TEXT,
    material_type TEXT,
    fabric_type TEXT,
    color TEXT,
    pattern TEXT,
    dimensions TEXT,
    quantity INTEGER DEFAULT 1,
    condition TEXT,
    damage_location TEXT,
    damage_description TEXT,
    repair_notes TEXT,
    photo_url TEXT,
    replacement_value REAL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS tax_jurisdictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jurisdiction_name TEXT NOT NULL,
    city TEXT,
    county TEXT,
    state TEXT,
    zip TEXT,
    tax_rate REAL NOT NULL DEFAULT 0,
    tax_code TEXT,
    qb_tax_code TEXT,
    tax_exempt_allowed INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL
  );
`);

// Additive migration: historical documents retain all original prices/totals.
sqlite.transaction(()=>{
  for(const table of ["estimate_line_items","invoice_line_items"]) {
    const existing=new Set((sqlite.prepare(`PRAGMA table_info(${table})`).all() as any[]).map(c=>c.name));
    const columns:Record<string,string>={unit_cost:"REAL NOT NULL DEFAULT 0 CHECK(unit_cost>=0)",use_tax_rate:"REAL NOT NULL DEFAULT 0 CHECK(use_tax_rate BETWEEN 0 AND 100)",tax_note:"TEXT NOT NULL DEFAULT ''",repair_action:"TEXT NOT NULL DEFAULT 'repair'"};
    if(table==="invoice_line_items")columns.service_category="TEXT NOT NULL DEFAULT ''";
    for(const [column,type] of Object.entries(columns))if(!existing.has(column))sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
})();
