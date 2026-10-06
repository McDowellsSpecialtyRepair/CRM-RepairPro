-- Metadata snapshot only. Do not use as a substitute for application startup migrations.
-- Audit triggers require application-registered SQLite functions.

CREATE TABLE "activities" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    job_id INTEGER,
    estimate_id INTEGER,
    invoice_id INTEGER,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    performed_by TEXT,
    created_at TEXT NOT NULL
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("job_id") REFERENCES "jobs"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("job_id",customer_id) REFERENCES "jobs"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("estimate_id") REFERENCES "estimates"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("estimate_id",customer_id) REFERENCES "estimates"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("invoice_id") REFERENCES "invoices"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("invoice_id",customer_id) REFERENCES "invoices"(id,customer_id) DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE app_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);

CREATE TABLE "asset_details" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id") REFERENCES "assets"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id",customer_id) REFERENCES "assets"(id,customer_id) DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "assets" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    asset_type TEXT NOT NULL,
    name TEXT,
    description TEXT,
    location TEXT,
    notes TEXT
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "bookings" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("scheduled_slot_id") REFERENCES "schedule_slots"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("scheduled_slot_id",customer_id) REFERENCES "schedule_slots"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("assigned_technician_id") REFERENCES "technicians"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE campaigns (
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

CREATE TABLE "coi_certificates" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE commerce_migrations (name TEXT PRIMARY KEY);

CREATE TABLE "contacts" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    phone TEXT,
    is_primary INTEGER DEFAULT 0
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE customers (
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

CREATE TABLE document_deliveries (
        id INTEGER PRIMARY KEY, document_type TEXT NOT NULL CHECK(document_type IN ('estimate','invoice')),
        document_id INTEGER NOT NULL, channel TEXT NOT NULL CHECK(channel IN ('email','sms','whatsapp')),
        recipient TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('not_configured','failed','provider_accepted')),
        provider_id TEXT, detail TEXT NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE estimate_labor_allocations (
        id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES estimate_line_items(id) ON DELETE CASCADE,
        technician_id INTEGER NOT NULL REFERENCES technicians(id), share_bps INTEGER NOT NULL CHECK(share_bps>0 AND share_bps<=10000),
        UNIQUE(line_id,technician_id));

CREATE TABLE "estimate_line_items" (
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
  , allocation_version INTEGER NOT NULL DEFAULT 1, line_type TEXT NOT NULL DEFAULT 'legacy' CHECK(line_type IN ('legacy','parts','labor')), unit_cost REAL NOT NULL DEFAULT 0 CHECK(unit_cost>=0), use_tax_rate REAL NOT NULL DEFAULT 0 CHECK(use_tax_rate BETWEEN 0 AND 100), tax_note TEXT NOT NULL DEFAULT '', repair_action TEXT NOT NULL DEFAULT 'repair',FOREIGN KEY("estimate_id") REFERENCES "estimates"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,CHECK(quantity>0));

CREATE TABLE estimate_planning (
      estimate_id INTEGER PRIMARY KEY REFERENCES estimates(id),
      scheduled_date TEXT, assigned_tech_id INTEGER REFERENCES technicians(id),
      sales_person_id INTEGER REFERENCES staff_accounts(id),
      priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent'))
    );

CREATE TABLE estimate_sales_team(estimate_id INTEGER NOT NULL REFERENCES estimates(id),staff_id INTEGER NOT NULL REFERENCES staff_accounts(id),share_bps INTEGER NOT NULL CHECK(share_bps>0 AND share_bps<=10000),PRIMARY KEY(estimate_id,staff_id));

CREATE TABLE estimate_sales_versions(estimate_id INTEGER PRIMARY KEY REFERENCES estimates(id),version INTEGER NOT NULL DEFAULT 1);

CREATE TABLE "estimates" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("job_id") REFERENCES "jobs"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("job_id",customer_id) REFERENCES "jobs"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("vehicle_id") REFERENCES "vehicles"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("vehicle_id",customer_id) REFERENCES "vehicles"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id") REFERENCES "assets"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id",customer_id) REFERENCES "assets"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("invoice_id") REFERENCES "invoices"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("invoice_id",customer_id) REFERENCES "invoices"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,CHECK(subtotal>=0 AND tax_rate>=0 AND tax_rate<=100 AND tax_amount>=0 AND discount>=0 AND total>=0));

CREATE TABLE "fleet_accounts" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("default_third_party_payer_id") REFERENCES "third_party_payers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("default_third_party_payer_id",customer_id) REFERENCES "third_party_payers"(id,customer_id) DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "fleet_authorized_contacts" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("fleet_account_id") REFERENCES "fleet_accounts"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("fleet_account_id",customer_id) REFERENCES "fleet_accounts"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE integrity_audit (
      id INTEGER PRIMARY KEY, kind TEXT NOT NULL, record_table TEXT NOT NULL,
      record_id INTEGER NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

CREATE TABLE invoice_labor_credits (
        id INTEGER PRIMARY KEY, line_id INTEGER NOT NULL REFERENCES invoice_line_items(id),
        technician_id INTEGER NOT NULL REFERENCES technicians(id), technician_name TEXT NOT NULL,
        share_bps INTEGER NOT NULL CHECK(share_bps>0 AND share_bps<=10000),
        net_labor_cents INTEGER NOT NULL CHECK(net_labor_cents>=0), UNIQUE(line_id,technician_id));

CREATE TABLE "invoice_line_items" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'each',
    unit_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  , line_type TEXT NOT NULL DEFAULT 'legacy' CHECK(line_type IN ('legacy','parts','labor')), unit_cost REAL NOT NULL DEFAULT 0 CHECK(unit_cost>=0), use_tax_rate REAL NOT NULL DEFAULT 0 CHECK(use_tax_rate BETWEEN 0 AND 100), tax_note TEXT NOT NULL DEFAULT '', repair_action TEXT NOT NULL DEFAULT 'repair', service_category TEXT NOT NULL DEFAULT '',FOREIGN KEY("invoice_id") REFERENCES "invoices"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,CHECK(quantity>0));

CREATE TABLE invoice_sales_credits(invoice_id INTEGER NOT NULL REFERENCES invoices(id),staff_id INTEGER NOT NULL REFERENCES staff_accounts(id),staff_name TEXT NOT NULL,share_bps INTEGER NOT NULL CHECK(share_bps>0 AND share_bps<=10000),net_sales_cents INTEGER NOT NULL CHECK(net_sales_cents>=0),PRIMARY KEY(invoice_id,staff_id));

CREATE TABLE "invoices" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("job_id") REFERENCES "jobs"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("job_id",customer_id) REFERENCES "jobs"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("estimate_id") REFERENCES "estimates"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("estimate_id",customer_id) REFERENCES "estimates"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,CHECK(subtotal>=0 AND tax_rate>=0 AND tax_rate<=100 AND tax_amount>=0 AND discount>=0 AND total>=0));

CREATE TABLE job_planning (
      job_id INTEGER PRIMARY KEY REFERENCES jobs(id),
      sales_person_id INTEGER REFERENCES staff_accounts(id)
    );

CREATE TABLE "jobs" (
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
  , assigned_tech_id INTEGER REFERENCES technicians(id),UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("vehicle_id") REFERENCES "vehicles"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("vehicle_id",customer_id) REFERENCES "vehicles"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id") REFERENCES "assets"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id",customer_id) REFERENCES "assets"(id,customer_id) DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE ops_absences (
      id INTEGER PRIMARY KEY,technician_id INTEGER NOT NULL REFERENCES technicians(id),
      date TEXT NOT NULL,start_time TEXT NOT NULL,end_time TEXT NOT NULL,reason TEXT NOT NULL);

CREATE TABLE ops_cases (
      id INTEGER PRIMARY KEY,estimate_id INTEGER NOT NULL UNIQUE REFERENCES estimates(id),
      job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id),department TEXT NOT NULL,
      promised_date TEXT,forecast_date TEXT,hold_reason TEXT NOT NULL DEFAULT '',hold_since TEXT,
      parts_ready INTEGER NOT NULL DEFAULT 0 CHECK(parts_ready IN (0,1)),
      qc TEXT NOT NULL DEFAULT 'pending' CHECK(qc IN ('pending','pass','fail')),
      cost_complete INTEGER NOT NULL DEFAULT 0 CHECK(cost_complete IN (0,1)),
      created_at TEXT NOT NULL,completed_at TEXT,delivered_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,notes TEXT NOT NULL DEFAULT '');

CREATE TABLE ops_costs (
      id INTEGER PRIMARY KEY,case_id INTEGER NOT NULL REFERENCES ops_cases(id),
      kind TEXT NOT NULL CHECK(kind IN ('parts','technician_pay','subcontract','other')),
      amount_cents INTEGER NOT NULL CHECK(amount_cents>0),note TEXT NOT NULL,
      retry_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);

CREATE TABLE ops_followups (
      id INTEGER PRIMARY KEY,estimate_id INTEGER NOT NULL UNIQUE REFERENCES estimates(id),
      owner_id INTEGER REFERENCES staff_accounts(id),next_date TEXT,last_contact TEXT,
      state TEXT NOT NULL DEFAULT 'open' CHECK(state IN ('open','deferred','lost','closed')),
      reason TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1,
      presented_date TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);

CREATE TABLE ops_profiles (
      id INTEGER PRIMARY KEY,technician_id INTEGER NOT NULL UNIQUE REFERENCES technicians(id),
      department TEXT NOT NULL,windows TEXT NOT NULL CHECK(json_valid(windows)),confirmed INTEGER NOT NULL DEFAULT 0 CHECK(confirmed IN(0,1)),
      version INTEGER NOT NULL DEFAULT 1);

CREATE TABLE ops_reservations (
      id INTEGER PRIMARY KEY,slot_id INTEGER NOT NULL UNIQUE REFERENCES schedule_slots(id) ON DELETE CASCADE,
      resource_id INTEGER REFERENCES ops_resources(id),retry_key TEXT NOT NULL UNIQUE,
      request_json TEXT NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE ops_resources (
      id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,department TEXT NOT NULL);

CREATE TABLE ops_tasks (
      id INTEGER PRIMARY KEY,case_id INTEGER NOT NULL REFERENCES ops_cases(id),source_line_id INTEGER NOT NULL REFERENCES estimate_line_items(id),
      description TEXT NOT NULL,line_type TEXT NOT NULL CHECK(line_type IN ('parts','labor')),
      net_cents INTEGER NOT NULL CHECK(net_cents>=0),estimated_minutes INTEGER CHECK(estimated_minutes>=0),
      standard_minutes INTEGER CHECK(standard_minutes>=0),completed_at TEXT,version INTEGER NOT NULL DEFAULT 1,
      UNIQUE(case_id,source_line_id));

CREATE TABLE ops_time (
      id INTEGER PRIMARY KEY,task_id INTEGER NOT NULL REFERENCES ops_tasks(id),technician_id INTEGER NOT NULL REFERENCES technicians(id),
      work_date TEXT NOT NULL,minutes INTEGER NOT NULL CHECK(minutes>0 AND minutes<=1440),
      kind TEXT NOT NULL CHECK(kind IN ('productive','rework','travel')),note TEXT NOT NULL,
      retry_key TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);

CREATE TABLE "payments" (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_number TEXT NOT NULL UNIQUE,
    invoice_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    reference TEXT,
    qb_synced INTEGER DEFAULT 0,
    qb_txn_id TEXT,
    created_at TEXT NOT NULL
  , idempotency_key TEXT,UNIQUE(id,customer_id),FOREIGN KEY("invoice_id") REFERENCES "invoices"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("invoice_id",customer_id) REFERENCES "invoices"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,UNIQUE(idempotency_key),CHECK(amount>0 AND amount=round(amount,2)));

CREATE TABLE pricing_matrices (
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

CREATE TABLE qb_sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_direction TEXT NOT NULL,
    record_type TEXT NOT NULL,
    record_id INTEGER,
    qb_txn_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    message TEXT,
    synced_at TEXT NOT NULL
  );

CREATE TABLE report_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    config TEXT NOT NULL CHECK(json_valid(config)), created_at TEXT NOT NULL
  );

CREATE TABLE "schedule_slots" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("job_id") REFERENCES "jobs"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("job_id",customer_id) REFERENCES "jobs"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("technician_id") REFERENCES "technicians"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE security_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER REFERENCES staff_accounts(id),
        actor_label TEXT NOT NULL, event TEXT NOT NULL, entity TEXT NOT NULL, record_id TEXT NOT NULL,
        before_json TEXT, after_json TEXT, request_id TEXT NOT NULL, occurred_at TEXT NOT NULL
      );

CREATE TABLE "service_history" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("vehicle_id") REFERENCES "vehicles"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("vehicle_id",customer_id) REFERENCES "vehicles"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id") REFERENCES "assets"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id",customer_id) REFERENCES "assets"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("job_id") REFERENCES "jobs"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("job_id",customer_id) REFERENCES "jobs"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("estimate_id") REFERENCES "estimates"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("estimate_id",customer_id) REFERENCES "estimates"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("invoice_id") REFERENCES "invoices"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("invoice_id",customer_id) REFERENCES "invoices"(id,customer_id) DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE service_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    service_type TEXT NOT NULL,
    description TEXT,
    base_price REAL NOT NULL DEFAULT 0,
    unit_type TEXT NOT NULL DEFAULT 'each',
    is_active INTEGER DEFAULT 1
  );

CREATE TABLE staff_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        full_name TEXT NOT NULL, password_hash TEXT, role TEXT NOT NULL CHECK(role IN ('owner','admin','manager','advisor','technician','support','accountant','auditor')),
        status TEXT NOT NULL CHECK(status IN ('invited','active','disabled')), technician_id INTEGER UNIQUE REFERENCES technicians(id),
        version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT,
        CHECK(role != 'technician' OR technician_id IS NOT NULL)
      );

CREATE TABLE staff_invitations (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES staff_accounts(id),
        token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, used_at INTEGER, created_at TEXT NOT NULL
      );

CREATE TABLE staff_rate_limits (key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, failures INTEGER NOT NULL);

CREATE TABLE staff_sessions (
        id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL REFERENCES staff_accounts(id),
        created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER NOT NULL,
        user_agent TEXT NOT NULL
      );

CREATE TABLE tax_jurisdictions (
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

CREATE TABLE "technicians" (
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
  ,FOREIGN KEY("user_id") REFERENCES "users"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "third_party_payers" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    email TEXT
  );

CREATE TABLE "vehicles" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED);

CREATE TABLE "warranty_claims" (
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
  ,UNIQUE(id,customer_id),FOREIGN KEY("customer_id") REFERENCES "customers"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("vehicle_id") REFERENCES "vehicles"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("vehicle_id",customer_id) REFERENCES "vehicles"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id") REFERENCES "assets"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("asset_id",customer_id) REFERENCES "assets"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("service_history_id") REFERENCES "service_history"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("service_history_id",customer_id) REFERENCES "service_history"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("original_job_id") REFERENCES "jobs"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("original_job_id",customer_id) REFERENCES "jobs"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("original_invoice_id") REFERENCES "invoices"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("original_invoice_id",customer_id) REFERENCES "invoices"(id,customer_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("corrective_job_id") REFERENCES "jobs"(id) ON DELETE NO ACTION DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY("corrective_job_id",customer_id) REFERENCES "jobs"(id,customer_id) DEFERRABLE INITIALLY DEFERRED);

CREATE UNIQUE INDEX invoices_one_per_estimate ON invoices(estimate_id) WHERE estimate_id IS NOT NULL;

CREATE INDEX ops_followups_due ON ops_followups(next_date,state);

CREATE INDEX ops_tasks_case ON ops_tasks(case_id);

CREATE INDEX ops_time_task ON ops_time(task_id);

CREATE INDEX "rel_activities_customer_id" ON "activities"("customer_id");

CREATE INDEX "rel_activities_estimate_id" ON "activities"("estimate_id");

CREATE INDEX "rel_activities_invoice_id" ON "activities"("invoice_id");

CREATE INDEX "rel_activities_job_id" ON "activities"("job_id");

CREATE INDEX "rel_asset_details_asset_id" ON "asset_details"("asset_id");

CREATE INDEX "rel_asset_details_customer_id" ON "asset_details"("customer_id");

CREATE INDEX "rel_assets_customer_id" ON "assets"("customer_id");

CREATE INDEX "rel_bookings_assigned_technician_id" ON "bookings"("assigned_technician_id");

CREATE INDEX "rel_bookings_customer_id" ON "bookings"("customer_id");

CREATE INDEX "rel_bookings_scheduled_slot_id" ON "bookings"("scheduled_slot_id");

CREATE INDEX "rel_coi_certificates_customer_id" ON "coi_certificates"("customer_id");

CREATE INDEX "rel_contacts_customer_id" ON "contacts"("customer_id");

CREATE INDEX "rel_estimate_line_items_estimate_id" ON "estimate_line_items"("estimate_id");

CREATE INDEX "rel_estimates_asset_id" ON "estimates"("asset_id");

CREATE INDEX "rel_estimates_customer_id" ON "estimates"("customer_id");

CREATE INDEX "rel_estimates_invoice_id" ON "estimates"("invoice_id");

CREATE INDEX "rel_estimates_job_id" ON "estimates"("job_id");

CREATE INDEX "rel_estimates_vehicle_id" ON "estimates"("vehicle_id");

CREATE INDEX "rel_fleet_accounts_customer_id" ON "fleet_accounts"("customer_id");

CREATE INDEX "rel_fleet_accounts_default_third_party_payer_id" ON "fleet_accounts"("default_third_party_payer_id");

CREATE INDEX "rel_fleet_authorized_contacts_customer_id" ON "fleet_authorized_contacts"("customer_id");

CREATE INDEX "rel_fleet_authorized_contacts_fleet_account_id" ON "fleet_authorized_contacts"("fleet_account_id");

CREATE INDEX "rel_invoice_line_items_invoice_id" ON "invoice_line_items"("invoice_id");

CREATE INDEX "rel_invoices_customer_id" ON "invoices"("customer_id");

CREATE INDEX "rel_invoices_estimate_id" ON "invoices"("estimate_id");

CREATE INDEX "rel_invoices_job_id" ON "invoices"("job_id");

CREATE INDEX "rel_jobs_asset_id" ON "jobs"("asset_id");

CREATE INDEX "rel_jobs_customer_id" ON "jobs"("customer_id");

CREATE INDEX "rel_jobs_vehicle_id" ON "jobs"("vehicle_id");

CREATE INDEX "rel_payments_customer_id" ON "payments"("customer_id");

CREATE INDEX "rel_payments_invoice_id" ON "payments"("invoice_id");

CREATE INDEX "rel_schedule_slots_customer_id" ON "schedule_slots"("customer_id");

CREATE INDEX "rel_schedule_slots_job_id" ON "schedule_slots"("job_id");

CREATE INDEX "rel_schedule_slots_technician_id" ON "schedule_slots"("technician_id");

CREATE INDEX "rel_service_history_asset_id" ON "service_history"("asset_id");

CREATE INDEX "rel_service_history_customer_id" ON "service_history"("customer_id");

CREATE INDEX "rel_service_history_estimate_id" ON "service_history"("estimate_id");

CREATE INDEX "rel_service_history_invoice_id" ON "service_history"("invoice_id");

CREATE INDEX "rel_service_history_job_id" ON "service_history"("job_id");

CREATE INDEX "rel_service_history_vehicle_id" ON "service_history"("vehicle_id");

CREATE INDEX "rel_technicians_user_id" ON "technicians"("user_id");

CREATE INDEX "rel_third_party_payers_customer_id" ON "third_party_payers"("customer_id");

CREATE INDEX "rel_vehicles_customer_id" ON "vehicles"("customer_id");

CREATE INDEX "rel_warranty_claims_asset_id" ON "warranty_claims"("asset_id");

CREATE INDEX "rel_warranty_claims_corrective_job_id" ON "warranty_claims"("corrective_job_id");

CREATE INDEX "rel_warranty_claims_customer_id" ON "warranty_claims"("customer_id");

CREATE INDEX "rel_warranty_claims_original_invoice_id" ON "warranty_claims"("original_invoice_id");

CREATE INDEX "rel_warranty_claims_original_job_id" ON "warranty_claims"("original_job_id");

CREATE INDEX "rel_warranty_claims_service_history_id" ON "warranty_claims"("service_history_id");

CREATE INDEX "rel_warranty_claims_vehicle_id" ON "warranty_claims"("vehicle_id");

CREATE INDEX security_audit_actor_date ON security_audit(actor_id,occurred_at);

CREATE INDEX staff_sessions_user ON staff_sessions(user_id);

CREATE TRIGGER estimate_line_prices_insert BEFORE INSERT ON estimate_line_items
          WHEN NEW.unit_price<0 OR NEW.total<0
          BEGIN SELECT RAISE(ABORT,'Use the discount field, not negative line items'); END;

CREATE TRIGGER estimate_line_prices_update BEFORE UPDATE OF unit_price,total ON estimate_line_items
          WHEN NEW.unit_price<0 OR NEW.total<0
          BEGIN SELECT RAISE(ABORT,'Use the discount field, not negative line items'); END;

CREATE TRIGGER invoice_insert_guard BEFORE INSERT ON invoices BEGIN
          SELECT CASE WHEN NEW.amount_paid!=0 OR round(NEW.balance_due*100)!=round(NEW.total*100)
            OR NEW.status NOT IN ('draft','sent') THEN RAISE(ABORT,'New invoices must begin unpaid') END;
        END;

CREATE TRIGGER invoice_ledger_guard BEFORE UPDATE OF amount_paid,balance_due,status,total ON invoices BEGIN
          SELECT CASE WHEN round(NEW.amount_paid*100)!=coalesce((SELECT round(sum(amount)*100) FROM payments WHERE invoice_id=NEW.id),0)
            OR round(NEW.balance_due*100)!=round((NEW.total-NEW.amount_paid)*100)
            OR (NEW.status='paid' AND (NEW.balance_due!=0 OR NEW.amount_paid<=0))
            OR (NEW.status='void' AND NEW.amount_paid>0)
            THEN RAISE(ABORT,'Invoice must reconcile to posted payments') END;
        END;

CREATE TRIGGER invoice_line_prices_insert BEFORE INSERT ON invoice_line_items
          WHEN NEW.unit_price<0 OR NEW.total<0
          BEGIN SELECT RAISE(ABORT,'Negative invoice lines require an adjustment workflow'); END;

CREATE TRIGGER invoice_lines_no_delete BEFORE DELETE ON invoice_line_items
          BEGIN SELECT RAISE(ABORT,'Issued invoice lines are immutable'); END;

CREATE TRIGGER invoice_lines_no_update BEFORE UPDATE ON invoice_line_items
          BEGIN SELECT RAISE(ABORT,'Issued invoice lines are immutable'); END;

CREATE TRIGGER invoice_sales_immutable_delete BEFORE DELETE ON invoice_sales_credits BEGIN SELECT RAISE(ABORT,'Issued sales credits are immutable');END;

CREATE TRIGGER invoice_sales_immutable_update BEFORE UPDATE ON invoice_sales_credits BEGIN SELECT RAISE(ABORT,'Issued sales credits are immutable');END;

CREATE TRIGGER invoice_totals_immutable BEFORE UPDATE OF subtotal,tax_rate,tax_amount,discount,total,estimate_id,invoice_number ON invoices
          BEGIN SELECT RAISE(ABORT,'Issued invoice financial details are immutable'); END;

CREATE TRIGGER labor_credits_labor_only BEFORE INSERT ON invoice_labor_credits
        WHEN NOT EXISTS(SELECT 1 FROM invoice_line_items WHERE id=NEW.line_id AND line_type='labor')
        BEGIN SELECT RAISE(ABORT,'Only labor can be credited to a technician'); END;

CREATE TRIGGER labor_credits_no_delete BEFORE DELETE ON invoice_labor_credits BEGIN SELECT RAISE(ABORT,'Issued labor credits are immutable'); END;

CREATE TRIGGER labor_credits_no_update BEFORE UPDATE ON invoice_labor_credits BEGIN SELECT RAISE(ABORT,'Issued labor credits are immutable'); END;

CREATE TRIGGER ops_costs_no_delete BEFORE DELETE ON ops_costs BEGIN SELECT RAISE(ABORT,'Cost evidence is append-only'); END;

CREATE TRIGGER ops_costs_no_update BEFORE UPDATE ON ops_costs BEGIN SELECT RAISE(ABORT,'Cost evidence is append-only'); END;

CREATE TRIGGER ops_estimate_financial_lock BEFORE UPDATE OF subtotal,tax_rate,tax_amount,discount,total ON estimates
      WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.id) AND (NEW.subtotal!=OLD.subtotal OR NEW.tax_rate!=OLD.tax_rate OR NEW.tax_amount!=OLD.tax_amount OR NEW.discount!=OLD.discount OR NEW.total!=OLD.total)
      BEGIN SELECT RAISE(ABORT,'Authorized production values are locked'); END;

CREATE TRIGGER ops_estimate_job_lock BEFORE UPDATE OF job_id ON estimates
      WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.id AND job_id IS NOT NEW.job_id)
      BEGIN SELECT RAISE(ABORT,'Production work order association is locked'); END;

CREATE TRIGGER ops_estimate_line_no_add BEFORE INSERT ON estimate_line_items WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=NEW.estimate_id) BEGIN SELECT RAISE(ABORT,'Production started; use a separate approved supplement'); END;

CREATE TRIGGER ops_estimate_line_no_delete BEFORE DELETE ON estimate_line_items WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.estimate_id) BEGIN SELECT RAISE(ABORT,'Production started; estimate lines are locked'); END;

CREATE TRIGGER ops_estimate_line_no_edit BEFORE UPDATE ON estimate_line_items WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.estimate_id) BEGIN SELECT RAISE(ABORT,'Production started; estimate lines are locked'); END;

CREATE TRIGGER ops_estimate_status_lock BEFORE UPDATE OF status ON estimates
      WHEN EXISTS(SELECT 1 FROM ops_cases WHERE estimate_id=OLD.id) AND NEW.status NOT IN ('approved','invoiced')
      BEGIN SELECT RAISE(ABORT,'Production already authorized; cannot silently revoke approval'); END;

CREATE TRIGGER ops_job_completed AFTER UPDATE OF status ON jobs WHEN NEW.status='completed' AND OLD.status!='completed'
      BEGIN UPDATE ops_cases SET completed_at=coalesce(completed_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')),version=version+1 WHERE job_id=NEW.id; END;

CREATE TRIGGER ops_job_completion_guard BEFORE UPDATE OF status ON jobs
      WHEN EXISTS(SELECT 1 FROM ops_cases WHERE job_id=OLD.id) AND
        (NEW.status='cancelled' OR (NEW.status='completed' AND
          EXISTS(SELECT 1 FROM ops_cases c WHERE c.job_id=OLD.id AND (c.qc!='pass' OR EXISTS(SELECT 1 FROM ops_tasks t WHERE t.case_id=c.id AND t.completed_at IS NULL)))))
      BEGIN SELECT RAISE(ABORT,'Complete all production tasks and pass QC; cancellation needs an approved adjustment'); END;

CREATE TRIGGER ops_job_final_readiness BEFORE UPDATE OF status ON jobs
      WHEN NEW.status='completed' AND EXISTS(SELECT 1 FROM ops_cases WHERE job_id=OLD.id AND (parts_ready=0 OR hold_reason!=''))
      BEGIN SELECT RAISE(ABORT,'Release holds and confirm materials readiness before completion'); END;

CREATE TRIGGER ops_job_no_reopen BEFORE UPDATE OF status ON jobs
      WHEN OLD.status='completed' AND NEW.status!='completed' AND EXISTS(SELECT 1 FROM ops_cases WHERE job_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Completed production is locked; use a separate repair or adjustment'); END;

CREATE TRIGGER ops_job_start_readiness BEFORE UPDATE OF status ON jobs
      WHEN NEW.status='in_progress' AND EXISTS(SELECT 1 FROM ops_cases WHERE job_id=OLD.id AND (parts_ready=0 OR hold_reason!=''))
      BEGIN SELECT RAISE(ABORT,'Release holds and confirm materials readiness before starting'); END;

CREATE TRIGGER ops_reserved_slot_edit BEFORE UPDATE OF technician_id,date,start_time,end_time ON schedule_slots WHEN EXISTS(SELECT 1 FROM ops_reservations WHERE slot_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Cancel this reservation and rebook to change its time or resource'); END;

CREATE TRIGGER ops_reserved_slot_no_delete BEFORE DELETE ON schedule_slots
      WHEN EXISTS(SELECT 1 FROM ops_reservations WHERE slot_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Cancel reservations instead of deleting their retry and audit history'); END;

CREATE TRIGGER ops_reserved_slot_no_reactivate BEFORE UPDATE OF status ON schedule_slots
      WHEN OLD.status='cancelled' AND NEW.status!='cancelled' AND EXISTS(SELECT 1 FROM ops_reservations WHERE slot_id=OLD.id)
      BEGIN SELECT RAISE(ABORT,'Cancelled reservations must be rebooked with fresh availability checks'); END;

CREATE TRIGGER ops_slot_overlap_insert BEFORE INSERT ON schedule_slots WHEN NEW.status!='cancelled' AND NEW.technician_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM schedule_slots s WHERE s.technician_id=NEW.technician_id AND s.date=NEW.date AND s.status!='cancelled' AND NEW.start_time<s.end_time AND NEW.end_time>s.start_time)
      BEGIN SELECT RAISE(ABORT,'Technician already booked in this time interval'); END;

CREATE TRIGGER ops_slot_overlap_update BEFORE UPDATE OF technician_id,date,start_time,end_time,status ON schedule_slots WHEN NEW.status!='cancelled' AND NEW.technician_id IS NOT NULL AND EXISTS(
      SELECT 1 FROM schedule_slots s WHERE s.id!=OLD.id AND s.technician_id=NEW.technician_id AND s.date=NEW.date AND s.status!='cancelled' AND NEW.start_time<s.end_time AND NEW.end_time>s.start_time)
      BEGIN SELECT RAISE(ABORT,'Technician already booked in this time interval'); END;

CREATE TRIGGER ops_tasks_value_immutable BEFORE UPDATE OF net_cents,line_type,source_line_id,case_id ON ops_tasks BEGIN SELECT RAISE(ABORT,'Authorized production values are locked'); END;

CREATE TRIGGER ops_time_no_delete BEFORE DELETE ON ops_time BEGIN SELECT RAISE(ABORT,'Time evidence is append-only'); END;

CREATE TRIGGER ops_time_no_update BEFORE UPDATE ON ops_time BEGIN SELECT RAISE(ABORT,'Time evidence is append-only'); END;

CREATE TRIGGER payment_balance AFTER INSERT ON payments BEGIN
          UPDATE invoices SET amount_paid=round((SELECT sum(amount) FROM payments WHERE invoice_id=NEW.invoice_id),2),
            balance_due=round(total-(SELECT sum(amount) FROM payments WHERE invoice_id=NEW.invoice_id),2),
            status=CASE WHEN round(total*100)=round((SELECT sum(amount) FROM payments WHERE invoice_id=NEW.invoice_id)*100) THEN 'paid' ELSE 'partial' END
            WHERE id=NEW.invoice_id;
        END;

CREATE TRIGGER payment_no_delete BEFORE DELETE ON payments
          BEGIN SELECT RAISE(ABORT,'Posted payments cannot be deleted'); END;

CREATE TRIGGER payment_no_mutation BEFORE UPDATE OF invoice_id,amount,payment_number,payment_method,payment_date,reference,idempotency_key ON payments
          BEGIN SELECT RAISE(ABORT,'Posted payments are immutable; an audited reversal workflow is required'); END;

CREATE TRIGGER payment_validate BEFORE INSERT ON payments BEGIN
          SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM invoices WHERE id=NEW.invoice_id AND customer_id=NEW.customer_id AND status NOT IN ('void','draft'))
            THEN RAISE(ABORT,'Payment requires an issued invoice for this customer') END;
          SELECT CASE WHEN round(NEW.amount*100)>round((SELECT total FROM invoices WHERE id=NEW.invoice_id)*100)
            -coalesce((SELECT round(sum(amount)*100) FROM payments WHERE invoice_id=NEW.invoice_id),0)
            THEN RAISE(ABORT,'Payment exceeds outstanding balance') END;
        END;

CREATE TRIGGER security_audit_no_delete BEFORE DELETE ON security_audit BEGIN SELECT RAISE(ABORT,'Audit history is append-only'); END;

CREATE TRIGGER security_audit_no_update BEFORE UPDATE ON security_audit BEGIN SELECT RAISE(ABORT,'Audit history is append-only'); END;

CREATE TRIGGER staff_audit_activities_delete AFTER DELETE ON "activities"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','activities',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'job_id',OLD."job_id",'estimate_id',OLD."estimate_id",'invoice_id',OLD."invoice_id",'activity_type',OLD."activity_type",'description',OLD."description",'performed_by',OLD."performed_by",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_activities_insert AFTER INSERT ON "activities"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','activities',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'job_id',NEW."job_id",'estimate_id',NEW."estimate_id",'invoice_id',NEW."invoice_id",'activity_type',NEW."activity_type",'description',NEW."description",'performed_by',NEW."performed_by",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_activities_update AFTER UPDATE ON "activities"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','activities',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'job_id',OLD."job_id",'estimate_id',OLD."estimate_id",'invoice_id',OLD."invoice_id",'activity_type',OLD."activity_type",'description',OLD."description",'performed_by',OLD."performed_by",'created_at',OLD."created_at"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'job_id',NEW."job_id",'estimate_id',NEW."estimate_id",'invoice_id',NEW."invoice_id",'activity_type',NEW."activity_type",'description',NEW."description",'performed_by',NEW."performed_by",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_asset_details_delete AFTER DELETE ON "asset_details"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','asset_details',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'asset_id',OLD."asset_id",'asset_category',OLD."asset_category",'location_name',OLD."location_name",'building',OLD."building",'floor',OLD."floor",'room_number',OLD."room_number",'area',OLD."area",'item_name',OLD."item_name",'item_type',OLD."item_type",'manufacturer',OLD."manufacturer",'model',OLD."model",'serial_number',OLD."serial_number",'material_type',OLD."material_type",'fabric_type',OLD."fabric_type",'color',OLD."color",'pattern',OLD."pattern",'dimensions',OLD."dimensions",'quantity',OLD."quantity",'condition',OLD."condition",'damage_location',OLD."damage_location",'damage_description',OLD."damage_description",'repair_notes',OLD."repair_notes",'photo_url',OLD."photo_url",'replacement_value',OLD."replacement_value",'status',OLD."status",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_asset_details_insert AFTER INSERT ON "asset_details"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','asset_details',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'asset_id',NEW."asset_id",'asset_category',NEW."asset_category",'location_name',NEW."location_name",'building',NEW."building",'floor',NEW."floor",'room_number',NEW."room_number",'area',NEW."area",'item_name',NEW."item_name",'item_type',NEW."item_type",'manufacturer',NEW."manufacturer",'model',NEW."model",'serial_number',NEW."serial_number",'material_type',NEW."material_type",'fabric_type',NEW."fabric_type",'color',NEW."color",'pattern',NEW."pattern",'dimensions',NEW."dimensions",'quantity',NEW."quantity",'condition',NEW."condition",'damage_location',NEW."damage_location",'damage_description',NEW."damage_description",'repair_notes',NEW."repair_notes",'photo_url',NEW."photo_url",'replacement_value',NEW."replacement_value",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_asset_details_update AFTER UPDATE ON "asset_details"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','asset_details',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'asset_id',OLD."asset_id",'asset_category',OLD."asset_category",'location_name',OLD."location_name",'building',OLD."building",'floor',OLD."floor",'room_number',OLD."room_number",'area',OLD."area",'item_name',OLD."item_name",'item_type',OLD."item_type",'manufacturer',OLD."manufacturer",'model',OLD."model",'serial_number',OLD."serial_number",'material_type',OLD."material_type",'fabric_type',OLD."fabric_type",'color',OLD."color",'pattern',OLD."pattern",'dimensions',OLD."dimensions",'quantity',OLD."quantity",'condition',OLD."condition",'damage_location',OLD."damage_location",'damage_description',OLD."damage_description",'repair_notes',OLD."repair_notes",'photo_url',OLD."photo_url",'replacement_value',OLD."replacement_value",'status',OLD."status",'created_at',OLD."created_at"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'asset_id',NEW."asset_id",'asset_category',NEW."asset_category",'location_name',NEW."location_name",'building',NEW."building",'floor',NEW."floor",'room_number',NEW."room_number",'area',NEW."area",'item_name',NEW."item_name",'item_type',NEW."item_type",'manufacturer',NEW."manufacturer",'model',NEW."model",'serial_number',NEW."serial_number",'material_type',NEW."material_type",'fabric_type',NEW."fabric_type",'color',NEW."color",'pattern',NEW."pattern",'dimensions',NEW."dimensions",'quantity',NEW."quantity",'condition',NEW."condition",'damage_location',NEW."damage_location",'damage_description',NEW."damage_description",'repair_notes',NEW."repair_notes",'photo_url',NEW."photo_url",'replacement_value',NEW."replacement_value",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_assets_delete AFTER DELETE ON "assets"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','assets',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'asset_type',OLD."asset_type",'name',OLD."name",'description',OLD."description",'location',OLD."location",'notes',OLD."notes"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_assets_insert AFTER INSERT ON "assets"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','assets',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'asset_type',NEW."asset_type",'name',NEW."name",'description',NEW."description",'location',NEW."location",'notes',NEW."notes"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_assets_update AFTER UPDATE ON "assets"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','assets',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'asset_type',OLD."asset_type",'name',OLD."name",'description',OLD."description",'location',OLD."location",'notes',OLD."notes"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'asset_type',NEW."asset_type",'name',NEW."name",'description',NEW."description",'location',NEW."location",'notes',NEW."notes"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_bookings_delete AFTER DELETE ON "bookings"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','bookings',OLD.id,
          json_object('id',OLD."id",'booking_number',OLD."booking_number",'customer_id',OLD."customer_id",'customer_name',OLD."customer_name",'customer_email',OLD."customer_email",'customer_phone',OLD."customer_phone",'vehicle_info',OLD."vehicle_info",'service_type',OLD."service_type",'booking_type',OLD."booking_type",'preferred_date',OLD."preferred_date",'preferred_time',OLD."preferred_time",'description',OLD."description",'status',OLD."status",'scheduled_slot_id',OLD."scheduled_slot_id",'confirmed_date',OLD."confirmed_date",'confirmed_time',OLD."confirmed_time",'assigned_technician_id',OLD."assigned_technician_id",'notes',OLD."notes",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_bookings_insert AFTER INSERT ON "bookings"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','bookings',NEW.id,
          NULL,json_object('id',NEW."id",'booking_number',NEW."booking_number",'customer_id',NEW."customer_id",'customer_name',NEW."customer_name",'customer_email',NEW."customer_email",'customer_phone',NEW."customer_phone",'vehicle_info',NEW."vehicle_info",'service_type',NEW."service_type",'booking_type',NEW."booking_type",'preferred_date',NEW."preferred_date",'preferred_time',NEW."preferred_time",'description',NEW."description",'status',NEW."status",'scheduled_slot_id',NEW."scheduled_slot_id",'confirmed_date',NEW."confirmed_date",'confirmed_time',NEW."confirmed_time",'assigned_technician_id',NEW."assigned_technician_id",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_bookings_update AFTER UPDATE ON "bookings"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','bookings',NEW.id,
          json_object('id',OLD."id",'booking_number',OLD."booking_number",'customer_id',OLD."customer_id",'customer_name',OLD."customer_name",'customer_email',OLD."customer_email",'customer_phone',OLD."customer_phone",'vehicle_info',OLD."vehicle_info",'service_type',OLD."service_type",'booking_type',OLD."booking_type",'preferred_date',OLD."preferred_date",'preferred_time',OLD."preferred_time",'description',OLD."description",'status',OLD."status",'scheduled_slot_id',OLD."scheduled_slot_id",'confirmed_date',OLD."confirmed_date",'confirmed_time',OLD."confirmed_time",'assigned_technician_id',OLD."assigned_technician_id",'notes',OLD."notes",'created_at',OLD."created_at"),json_object('id',NEW."id",'booking_number',NEW."booking_number",'customer_id',NEW."customer_id",'customer_name',NEW."customer_name",'customer_email',NEW."customer_email",'customer_phone',NEW."customer_phone",'vehicle_info',NEW."vehicle_info",'service_type',NEW."service_type",'booking_type',NEW."booking_type",'preferred_date',NEW."preferred_date",'preferred_time',NEW."preferred_time",'description',NEW."description",'status',NEW."status",'scheduled_slot_id',NEW."scheduled_slot_id",'confirmed_date',NEW."confirmed_date",'confirmed_time',NEW."confirmed_time",'assigned_technician_id',NEW."assigned_technician_id",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_campaigns_delete AFTER DELETE ON "campaigns"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','campaigns',OLD.id,
          json_object('id',OLD."id",'name',OLD."name",'campaign_type',OLD."campaign_type",'status',OLD."status",'target_segment',OLD."target_segment",'start_date',OLD."start_date",'end_date',OLD."end_date",'budget',OLD."budget",'sent_count',OLD."sent_count",'response_count',OLD."response_count",'conversion_count',OLD."conversion_count",'notes',OLD."notes",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_campaigns_insert AFTER INSERT ON "campaigns"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','campaigns',NEW.id,
          NULL,json_object('id',NEW."id",'name',NEW."name",'campaign_type',NEW."campaign_type",'status',NEW."status",'target_segment',NEW."target_segment",'start_date',NEW."start_date",'end_date',NEW."end_date",'budget',NEW."budget",'sent_count',NEW."sent_count",'response_count',NEW."response_count",'conversion_count',NEW."conversion_count",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_campaigns_update AFTER UPDATE ON "campaigns"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','campaigns',NEW.id,
          json_object('id',OLD."id",'name',OLD."name",'campaign_type',OLD."campaign_type",'status',OLD."status",'target_segment',OLD."target_segment",'start_date',OLD."start_date",'end_date',OLD."end_date",'budget',OLD."budget",'sent_count',OLD."sent_count",'response_count',OLD."response_count",'conversion_count',OLD."conversion_count",'notes',OLD."notes",'created_at',OLD."created_at"),json_object('id',NEW."id",'name',NEW."name",'campaign_type',NEW."campaign_type",'status',NEW."status",'target_segment',NEW."target_segment",'start_date',NEW."start_date",'end_date',NEW."end_date",'budget',NEW."budget",'sent_count',NEW."sent_count",'response_count',NEW."response_count",'conversion_count',NEW."conversion_count",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_coi_certificates_delete AFTER DELETE ON "coi_certificates"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','coi_certificates',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'certificate_name',OLD."certificate_name",'insurance_company',OLD."insurance_company",'policy_number',OLD."policy_number",'policy_type',OLD."policy_type",'certificate_holder',OLD."certificate_holder",'coverage_limit',OLD."coverage_limit",'effective_date',OLD."effective_date",'expiration_date',OLD."expiration_date",'agent_name',OLD."agent_name",'agent_email',OLD."agent_email",'agent_phone',OLD."agent_phone",'status',OLD."status",'required_before_work',OLD."required_before_work",'document_url',OLD."document_url",'notes',OLD."notes",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_coi_certificates_insert AFTER INSERT ON "coi_certificates"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','coi_certificates',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'certificate_name',NEW."certificate_name",'insurance_company',NEW."insurance_company",'policy_number',NEW."policy_number",'policy_type',NEW."policy_type",'certificate_holder',NEW."certificate_holder",'coverage_limit',NEW."coverage_limit",'effective_date',NEW."effective_date",'expiration_date',NEW."expiration_date",'agent_name',NEW."agent_name",'agent_email',NEW."agent_email",'agent_phone',NEW."agent_phone",'status',NEW."status",'required_before_work',NEW."required_before_work",'document_url',NEW."document_url",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_coi_certificates_update AFTER UPDATE ON "coi_certificates"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','coi_certificates',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'certificate_name',OLD."certificate_name",'insurance_company',OLD."insurance_company",'policy_number',OLD."policy_number",'policy_type',OLD."policy_type",'certificate_holder',OLD."certificate_holder",'coverage_limit',OLD."coverage_limit",'effective_date',OLD."effective_date",'expiration_date',OLD."expiration_date",'agent_name',OLD."agent_name",'agent_email',OLD."agent_email",'agent_phone',OLD."agent_phone",'status',OLD."status",'required_before_work',OLD."required_before_work",'document_url',OLD."document_url",'notes',OLD."notes",'created_at',OLD."created_at"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'certificate_name',NEW."certificate_name",'insurance_company',NEW."insurance_company",'policy_number',NEW."policy_number",'policy_type',NEW."policy_type",'certificate_holder',NEW."certificate_holder",'coverage_limit',NEW."coverage_limit",'effective_date',NEW."effective_date",'expiration_date',NEW."expiration_date",'agent_name',NEW."agent_name",'agent_email',NEW."agent_email",'agent_phone',NEW."agent_phone",'status',NEW."status",'required_before_work',NEW."required_before_work",'document_url',NEW."document_url",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_contacts_delete AFTER DELETE ON "contacts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','contacts',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'name',OLD."name",'title',OLD."title",'email',OLD."email",'phone',OLD."phone",'is_primary',OLD."is_primary"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_contacts_insert AFTER INSERT ON "contacts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','contacts',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'name',NEW."name",'title',NEW."title",'email',NEW."email",'phone',NEW."phone",'is_primary',NEW."is_primary"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_contacts_update AFTER UPDATE ON "contacts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','contacts',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'name',OLD."name",'title',OLD."title",'email',OLD."email",'phone',OLD."phone",'is_primary',OLD."is_primary"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'name',NEW."name",'title',NEW."title",'email',NEW."email",'phone',NEW."phone",'is_primary',NEW."is_primary"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_customers_delete AFTER DELETE ON "customers"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','customers',OLD.id,
          json_object('id',OLD."id",'customer_number',OLD."customer_number",'first_name',OLD."first_name",'last_name',OLD."last_name",'company_name',OLD."company_name",'customer_type',OLD."customer_type",'email',OLD."email",'phone',OLD."phone",'mobile',OLD."mobile",'address',OLD."address",'city',OLD."city",'state',OLD."state",'zip',OLD."zip",'notes',OLD."notes",'referral_source',OLD."referral_source",'tax_exempt',OLD."tax_exempt",'credit_limit',OLD."credit_limit",'status',OLD."status",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_customers_insert AFTER INSERT ON "customers"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','customers',NEW.id,
          NULL,json_object('id',NEW."id",'customer_number',NEW."customer_number",'first_name',NEW."first_name",'last_name',NEW."last_name",'company_name',NEW."company_name",'customer_type',NEW."customer_type",'email',NEW."email",'phone',NEW."phone",'mobile',NEW."mobile",'address',NEW."address",'city',NEW."city",'state',NEW."state",'zip',NEW."zip",'notes',NEW."notes",'referral_source',NEW."referral_source",'tax_exempt',NEW."tax_exempt",'credit_limit',NEW."credit_limit",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_customers_update AFTER UPDATE ON "customers"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','customers',NEW.id,
          json_object('id',OLD."id",'customer_number',OLD."customer_number",'first_name',OLD."first_name",'last_name',OLD."last_name",'company_name',OLD."company_name",'customer_type',OLD."customer_type",'email',OLD."email",'phone',OLD."phone",'mobile',OLD."mobile",'address',OLD."address",'city',OLD."city",'state',OLD."state",'zip',OLD."zip",'notes',OLD."notes",'referral_source',OLD."referral_source",'tax_exempt',OLD."tax_exempt",'credit_limit',OLD."credit_limit",'status',OLD."status",'created_at',OLD."created_at"),json_object('id',NEW."id",'customer_number',NEW."customer_number",'first_name',NEW."first_name",'last_name',NEW."last_name",'company_name',NEW."company_name",'customer_type',NEW."customer_type",'email',NEW."email",'phone',NEW."phone",'mobile',NEW."mobile",'address',NEW."address",'city',NEW."city",'state',NEW."state",'zip',NEW."zip",'notes',NEW."notes",'referral_source',NEW."referral_source",'tax_exempt',NEW."tax_exempt",'credit_limit',NEW."credit_limit",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_document_deliveries_delete AFTER DELETE ON "document_deliveries"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','document_deliveries',OLD.id,
          json_object('id',OLD."id",'document_type',OLD."document_type",'document_id',OLD."document_id",'channel',OLD."channel",'recipient',OLD."recipient",'state',OLD."state",'provider_id',OLD."provider_id",'detail',OLD."detail",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_document_deliveries_insert AFTER INSERT ON "document_deliveries"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','document_deliveries',NEW.id,
          NULL,json_object('id',NEW."id",'document_type',NEW."document_type",'document_id',NEW."document_id",'channel',NEW."channel",'recipient',NEW."recipient",'state',NEW."state",'provider_id',NEW."provider_id",'detail',NEW."detail",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_document_deliveries_update AFTER UPDATE ON "document_deliveries"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','document_deliveries',NEW.id,
          json_object('id',OLD."id",'document_type',OLD."document_type",'document_id',OLD."document_id",'channel',OLD."channel",'recipient',OLD."recipient",'state',OLD."state",'provider_id',OLD."provider_id",'detail',OLD."detail",'created_at',OLD."created_at"),json_object('id',NEW."id",'document_type',NEW."document_type",'document_id',NEW."document_id",'channel',NEW."channel",'recipient',NEW."recipient",'state',NEW."state",'provider_id',NEW."provider_id",'detail',NEW."detail",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimate_labor_allocations_delete AFTER DELETE ON "estimate_labor_allocations"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','estimate_labor_allocations',OLD.id,
          json_object('id',OLD."id",'line_id',OLD."line_id",'technician_id',OLD."technician_id",'share_bps',OLD."share_bps"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimate_labor_allocations_insert AFTER INSERT ON "estimate_labor_allocations"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','estimate_labor_allocations',NEW.id,
          NULL,json_object('id',NEW."id",'line_id',NEW."line_id",'technician_id',NEW."technician_id",'share_bps',NEW."share_bps"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimate_labor_allocations_update AFTER UPDATE ON "estimate_labor_allocations"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','estimate_labor_allocations',NEW.id,
          json_object('id',OLD."id",'line_id',OLD."line_id",'technician_id',OLD."technician_id",'share_bps',OLD."share_bps"),json_object('id',NEW."id",'line_id',NEW."line_id",'technician_id',NEW."technician_id",'share_bps',NEW."share_bps"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimate_line_items_delete AFTER DELETE ON "estimate_line_items"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','estimate_line_items',OLD.id,
          json_object('id',OLD."id",'estimate_id',OLD."estimate_id",'service_category',OLD."service_category",'description',OLD."description",'quantity',OLD."quantity",'unit',OLD."unit",'unit_price',OLD."unit_price",'total',OLD."total",'panel_location',OLD."panel_location",'damage_size',OLD."damage_size",'damage_severity',OLD."damage_severity",'allocation_version',OLD."allocation_version",'line_type',OLD."line_type",'unit_cost',OLD."unit_cost",'use_tax_rate',OLD."use_tax_rate",'tax_note',OLD."tax_note",'repair_action',OLD."repair_action"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimate_line_items_insert AFTER INSERT ON "estimate_line_items"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','estimate_line_items',NEW.id,
          NULL,json_object('id',NEW."id",'estimate_id',NEW."estimate_id",'service_category',NEW."service_category",'description',NEW."description",'quantity',NEW."quantity",'unit',NEW."unit",'unit_price',NEW."unit_price",'total',NEW."total",'panel_location',NEW."panel_location",'damage_size',NEW."damage_size",'damage_severity',NEW."damage_severity",'allocation_version',NEW."allocation_version",'line_type',NEW."line_type",'unit_cost',NEW."unit_cost",'use_tax_rate',NEW."use_tax_rate",'tax_note',NEW."tax_note",'repair_action',NEW."repair_action"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimate_line_items_update AFTER UPDATE ON "estimate_line_items"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','estimate_line_items',NEW.id,
          json_object('id',OLD."id",'estimate_id',OLD."estimate_id",'service_category',OLD."service_category",'description',OLD."description",'quantity',OLD."quantity",'unit',OLD."unit",'unit_price',OLD."unit_price",'total',OLD."total",'panel_location',OLD."panel_location",'damage_size',OLD."damage_size",'damage_severity',OLD."damage_severity",'allocation_version',OLD."allocation_version",'line_type',OLD."line_type",'unit_cost',OLD."unit_cost",'use_tax_rate',OLD."use_tax_rate",'tax_note',OLD."tax_note",'repair_action',OLD."repair_action"),json_object('id',NEW."id",'estimate_id',NEW."estimate_id",'service_category',NEW."service_category",'description',NEW."description",'quantity',NEW."quantity",'unit',NEW."unit",'unit_price',NEW."unit_price",'total',NEW."total",'panel_location',NEW."panel_location",'damage_size',NEW."damage_size",'damage_severity',NEW."damage_severity",'allocation_version',NEW."allocation_version",'line_type',NEW."line_type",'unit_cost',NEW."unit_cost",'use_tax_rate',NEW."use_tax_rate",'tax_note',NEW."tax_note",'repair_action',NEW."repair_action"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimates_delete AFTER DELETE ON "estimates"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','estimates',OLD.id,
          json_object('id',OLD."id",'estimate_number',OLD."estimate_number",'job_id',OLD."job_id",'customer_id',OLD."customer_id",'vehicle_id',OLD."vehicle_id",'asset_id',OLD."asset_id",'service_type',OLD."service_type",'status',OLD."status",'subtotal',OLD."subtotal",'tax_rate',OLD."tax_rate",'tax_amount',OLD."tax_amount",'discount',OLD."discount",'total',OLD."total",'notes',OLD."notes",'valid_until',OLD."valid_until",'approved_date',OLD."approved_date",'invoice_id',OLD."invoice_id",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimates_insert AFTER INSERT ON "estimates"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','estimates',NEW.id,
          NULL,json_object('id',NEW."id",'estimate_number',NEW."estimate_number",'job_id',NEW."job_id",'customer_id',NEW."customer_id",'vehicle_id',NEW."vehicle_id",'asset_id',NEW."asset_id",'service_type',NEW."service_type",'status',NEW."status",'subtotal',NEW."subtotal",'tax_rate',NEW."tax_rate",'tax_amount',NEW."tax_amount",'discount',NEW."discount",'total',NEW."total",'notes',NEW."notes",'valid_until',NEW."valid_until",'approved_date',NEW."approved_date",'invoice_id',NEW."invoice_id",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_estimates_update AFTER UPDATE ON "estimates"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','estimates',NEW.id,
          json_object('id',OLD."id",'estimate_number',OLD."estimate_number",'job_id',OLD."job_id",'customer_id',OLD."customer_id",'vehicle_id',OLD."vehicle_id",'asset_id',OLD."asset_id",'service_type',OLD."service_type",'status',OLD."status",'subtotal',OLD."subtotal",'tax_rate',OLD."tax_rate",'tax_amount',OLD."tax_amount",'discount',OLD."discount",'total',OLD."total",'notes',OLD."notes",'valid_until',OLD."valid_until",'approved_date',OLD."approved_date",'invoice_id',OLD."invoice_id",'created_at',OLD."created_at"),json_object('id',NEW."id",'estimate_number',NEW."estimate_number",'job_id',NEW."job_id",'customer_id',NEW."customer_id",'vehicle_id',NEW."vehicle_id",'asset_id',NEW."asset_id",'service_type',NEW."service_type",'status',NEW."status",'subtotal',NEW."subtotal",'tax_rate',NEW."tax_rate",'tax_amount',NEW."tax_amount",'discount',NEW."discount",'total',NEW."total",'notes',NEW."notes",'valid_until',NEW."valid_until",'approved_date',NEW."approved_date",'invoice_id',NEW."invoice_id",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_fleet_accounts_delete AFTER DELETE ON "fleet_accounts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','fleet_accounts',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'fleet_name',OLD."fleet_name",'fleet_size',OLD."fleet_size",'account_number',OLD."account_number",'billing_cycle',OLD."billing_cycle",'payment_terms',OLD."payment_terms",'contracted_rate_type',OLD."contracted_rate_type",'pdr_discount_percent',OLD."pdr_discount_percent",'hail_discount_percent',OLD."hail_discount_percent",'interior_discount_percent',OLD."interior_discount_percent",'upholstery_discount_percent',OLD."upholstery_discount_percent",'tint_discount_percent',OLD."tint_discount_percent",'labor_rate',OLD."labor_rate",'po_required',OLD."po_required",'authorization_required',OLD."authorization_required",'default_third_party_payer_id',OLD."default_third_party_payer_id",'contract_start_date',OLD."contract_start_date",'contract_end_date',OLD."contract_end_date",'status',OLD."status",'notes',OLD."notes",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_fleet_accounts_insert AFTER INSERT ON "fleet_accounts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','fleet_accounts',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'fleet_name',NEW."fleet_name",'fleet_size',NEW."fleet_size",'account_number',NEW."account_number",'billing_cycle',NEW."billing_cycle",'payment_terms',NEW."payment_terms",'contracted_rate_type',NEW."contracted_rate_type",'pdr_discount_percent',NEW."pdr_discount_percent",'hail_discount_percent',NEW."hail_discount_percent",'interior_discount_percent',NEW."interior_discount_percent",'upholstery_discount_percent',NEW."upholstery_discount_percent",'tint_discount_percent',NEW."tint_discount_percent",'labor_rate',NEW."labor_rate",'po_required',NEW."po_required",'authorization_required',NEW."authorization_required",'default_third_party_payer_id',NEW."default_third_party_payer_id",'contract_start_date',NEW."contract_start_date",'contract_end_date',NEW."contract_end_date",'status',NEW."status",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_fleet_accounts_update AFTER UPDATE ON "fleet_accounts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','fleet_accounts',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'fleet_name',OLD."fleet_name",'fleet_size',OLD."fleet_size",'account_number',OLD."account_number",'billing_cycle',OLD."billing_cycle",'payment_terms',OLD."payment_terms",'contracted_rate_type',OLD."contracted_rate_type",'pdr_discount_percent',OLD."pdr_discount_percent",'hail_discount_percent',OLD."hail_discount_percent",'interior_discount_percent',OLD."interior_discount_percent",'upholstery_discount_percent',OLD."upholstery_discount_percent",'tint_discount_percent',OLD."tint_discount_percent",'labor_rate',OLD."labor_rate",'po_required',OLD."po_required",'authorization_required',OLD."authorization_required",'default_third_party_payer_id',OLD."default_third_party_payer_id",'contract_start_date',OLD."contract_start_date",'contract_end_date',OLD."contract_end_date",'status',OLD."status",'notes',OLD."notes",'created_at',OLD."created_at"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'fleet_name',NEW."fleet_name",'fleet_size',NEW."fleet_size",'account_number',NEW."account_number",'billing_cycle',NEW."billing_cycle",'payment_terms',NEW."payment_terms",'contracted_rate_type',NEW."contracted_rate_type",'pdr_discount_percent',NEW."pdr_discount_percent",'hail_discount_percent',NEW."hail_discount_percent",'interior_discount_percent',NEW."interior_discount_percent",'upholstery_discount_percent',NEW."upholstery_discount_percent",'tint_discount_percent',NEW."tint_discount_percent",'labor_rate',NEW."labor_rate",'po_required',NEW."po_required",'authorization_required',NEW."authorization_required",'default_third_party_payer_id',NEW."default_third_party_payer_id",'contract_start_date',NEW."contract_start_date",'contract_end_date',NEW."contract_end_date",'status',NEW."status",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_fleet_authorized_contacts_delete AFTER DELETE ON "fleet_authorized_contacts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','fleet_authorized_contacts',OLD.id,
          json_object('id',OLD."id",'fleet_account_id',OLD."fleet_account_id",'customer_id',OLD."customer_id",'name',OLD."name",'title',OLD."title",'email',OLD."email",'phone',OLD."phone",'can_approve_estimates',OLD."can_approve_estimates",'can_approve_work',OLD."can_approve_work",'can_approve_invoices',OLD."can_approve_invoices",'approval_limit',OLD."approval_limit",'notes',OLD."notes"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_fleet_authorized_contacts_insert AFTER INSERT ON "fleet_authorized_contacts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','fleet_authorized_contacts',NEW.id,
          NULL,json_object('id',NEW."id",'fleet_account_id',NEW."fleet_account_id",'customer_id',NEW."customer_id",'name',NEW."name",'title',NEW."title",'email',NEW."email",'phone',NEW."phone",'can_approve_estimates',NEW."can_approve_estimates",'can_approve_work',NEW."can_approve_work",'can_approve_invoices',NEW."can_approve_invoices",'approval_limit',NEW."approval_limit",'notes',NEW."notes"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_fleet_authorized_contacts_update AFTER UPDATE ON "fleet_authorized_contacts"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','fleet_authorized_contacts',NEW.id,
          json_object('id',OLD."id",'fleet_account_id',OLD."fleet_account_id",'customer_id',OLD."customer_id",'name',OLD."name",'title',OLD."title",'email',OLD."email",'phone',OLD."phone",'can_approve_estimates',OLD."can_approve_estimates",'can_approve_work',OLD."can_approve_work",'can_approve_invoices',OLD."can_approve_invoices",'approval_limit',OLD."approval_limit",'notes',OLD."notes"),json_object('id',NEW."id",'fleet_account_id',NEW."fleet_account_id",'customer_id',NEW."customer_id",'name',NEW."name",'title',NEW."title",'email',NEW."email",'phone',NEW."phone",'can_approve_estimates',NEW."can_approve_estimates",'can_approve_work',NEW."can_approve_work",'can_approve_invoices',NEW."can_approve_invoices",'approval_limit',NEW."approval_limit",'notes',NEW."notes"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoice_labor_credits_delete AFTER DELETE ON "invoice_labor_credits"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','invoice_labor_credits',OLD.id,
          json_object('id',OLD."id",'line_id',OLD."line_id",'technician_id',OLD."technician_id",'technician_name',OLD."technician_name",'share_bps',OLD."share_bps",'net_labor_cents',OLD."net_labor_cents"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoice_labor_credits_insert AFTER INSERT ON "invoice_labor_credits"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','invoice_labor_credits',NEW.id,
          NULL,json_object('id',NEW."id",'line_id',NEW."line_id",'technician_id',NEW."technician_id",'technician_name',NEW."technician_name",'share_bps',NEW."share_bps",'net_labor_cents',NEW."net_labor_cents"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoice_labor_credits_update AFTER UPDATE ON "invoice_labor_credits"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','invoice_labor_credits',NEW.id,
          json_object('id',OLD."id",'line_id',OLD."line_id",'technician_id',OLD."technician_id",'technician_name',OLD."technician_name",'share_bps',OLD."share_bps",'net_labor_cents',OLD."net_labor_cents"),json_object('id',NEW."id",'line_id',NEW."line_id",'technician_id',NEW."technician_id",'technician_name',NEW."technician_name",'share_bps',NEW."share_bps",'net_labor_cents',NEW."net_labor_cents"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoice_line_items_delete AFTER DELETE ON "invoice_line_items"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','invoice_line_items',OLD.id,
          json_object('id',OLD."id",'invoice_id',OLD."invoice_id",'description',OLD."description",'quantity',OLD."quantity",'unit',OLD."unit",'unit_price',OLD."unit_price",'total',OLD."total",'line_type',OLD."line_type",'unit_cost',OLD."unit_cost",'use_tax_rate',OLD."use_tax_rate",'tax_note',OLD."tax_note",'repair_action',OLD."repair_action",'service_category',OLD."service_category"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoice_line_items_insert AFTER INSERT ON "invoice_line_items"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','invoice_line_items',NEW.id,
          NULL,json_object('id',NEW."id",'invoice_id',NEW."invoice_id",'description',NEW."description",'quantity',NEW."quantity",'unit',NEW."unit",'unit_price',NEW."unit_price",'total',NEW."total",'line_type',NEW."line_type",'unit_cost',NEW."unit_cost",'use_tax_rate',NEW."use_tax_rate",'tax_note',NEW."tax_note",'repair_action',NEW."repair_action",'service_category',NEW."service_category"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoice_line_items_update AFTER UPDATE ON "invoice_line_items"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','invoice_line_items',NEW.id,
          json_object('id',OLD."id",'invoice_id',OLD."invoice_id",'description',OLD."description",'quantity',OLD."quantity",'unit',OLD."unit",'unit_price',OLD."unit_price",'total',OLD."total",'line_type',OLD."line_type",'unit_cost',OLD."unit_cost",'use_tax_rate',OLD."use_tax_rate",'tax_note',OLD."tax_note",'repair_action',OLD."repair_action",'service_category',OLD."service_category"),json_object('id',NEW."id",'invoice_id',NEW."invoice_id",'description',NEW."description",'quantity',NEW."quantity",'unit',NEW."unit",'unit_price',NEW."unit_price",'total',NEW."total",'line_type',NEW."line_type",'unit_cost',NEW."unit_cost",'use_tax_rate',NEW."use_tax_rate",'tax_note',NEW."tax_note",'repair_action',NEW."repair_action",'service_category',NEW."service_category"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoices_delete AFTER DELETE ON "invoices"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','invoices',OLD.id,
          json_object('id',OLD."id",'invoice_number',OLD."invoice_number",'customer_id',OLD."customer_id",'job_id',OLD."job_id",'estimate_id',OLD."estimate_id",'status',OLD."status",'subtotal',OLD."subtotal",'tax_rate',OLD."tax_rate",'tax_amount',OLD."tax_amount",'discount',OLD."discount",'total',OLD."total",'amount_paid',OLD."amount_paid",'balance_due',OLD."balance_due",'issue_date',OLD."issue_date",'due_date',OLD."due_date",'notes',OLD."notes",'qb_synced',OLD."qb_synced",'qb_txn_id',OLD."qb_txn_id",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoices_insert AFTER INSERT ON "invoices"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','invoices',NEW.id,
          NULL,json_object('id',NEW."id",'invoice_number',NEW."invoice_number",'customer_id',NEW."customer_id",'job_id',NEW."job_id",'estimate_id',NEW."estimate_id",'status',NEW."status",'subtotal',NEW."subtotal",'tax_rate',NEW."tax_rate",'tax_amount',NEW."tax_amount",'discount',NEW."discount",'total',NEW."total",'amount_paid',NEW."amount_paid",'balance_due',NEW."balance_due",'issue_date',NEW."issue_date",'due_date',NEW."due_date",'notes',NEW."notes",'qb_synced',NEW."qb_synced",'qb_txn_id',NEW."qb_txn_id",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_invoices_update AFTER UPDATE ON "invoices"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','invoices',NEW.id,
          json_object('id',OLD."id",'invoice_number',OLD."invoice_number",'customer_id',OLD."customer_id",'job_id',OLD."job_id",'estimate_id',OLD."estimate_id",'status',OLD."status",'subtotal',OLD."subtotal",'tax_rate',OLD."tax_rate",'tax_amount',OLD."tax_amount",'discount',OLD."discount",'total',OLD."total",'amount_paid',OLD."amount_paid",'balance_due',OLD."balance_due",'issue_date',OLD."issue_date",'due_date',OLD."due_date",'notes',OLD."notes",'qb_synced',OLD."qb_synced",'qb_txn_id',OLD."qb_txn_id",'created_at',OLD."created_at"),json_object('id',NEW."id",'invoice_number',NEW."invoice_number",'customer_id',NEW."customer_id",'job_id',NEW."job_id",'estimate_id',NEW."estimate_id",'status',NEW."status",'subtotal',NEW."subtotal",'tax_rate',NEW."tax_rate",'tax_amount',NEW."tax_amount",'discount',NEW."discount",'total',NEW."total",'amount_paid',NEW."amount_paid",'balance_due',NEW."balance_due",'issue_date',NEW."issue_date",'due_date',NEW."due_date",'notes',NEW."notes",'qb_synced',NEW."qb_synced",'qb_txn_id',NEW."qb_txn_id",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_jobs_delete AFTER DELETE ON "jobs"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','jobs',OLD.id,
          json_object('id',OLD."id",'job_number',OLD."job_number",'customer_id',OLD."customer_id",'vehicle_id',OLD."vehicle_id",'asset_id',OLD."asset_id",'service_type',OLD."service_type",'title',OLD."title",'description',OLD."description",'status',OLD."status",'assigned_tech',OLD."assigned_tech",'scheduled_date',OLD."scheduled_date",'completed_date',OLD."completed_date",'priority',OLD."priority",'insurance_claim',OLD."insurance_claim",'insurance_adjuster',OLD."insurance_adjuster",'warranty_months',OLD."warranty_months",'warranty_expiry',OLD."warranty_expiry",'warranty_status',OLD."warranty_status",'created_at',OLD."created_at",'assigned_tech_id',OLD."assigned_tech_id"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_jobs_insert AFTER INSERT ON "jobs"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','jobs',NEW.id,
          NULL,json_object('id',NEW."id",'job_number',NEW."job_number",'customer_id',NEW."customer_id",'vehicle_id',NEW."vehicle_id",'asset_id',NEW."asset_id",'service_type',NEW."service_type",'title',NEW."title",'description',NEW."description",'status',NEW."status",'assigned_tech',NEW."assigned_tech",'scheduled_date',NEW."scheduled_date",'completed_date',NEW."completed_date",'priority',NEW."priority",'insurance_claim',NEW."insurance_claim",'insurance_adjuster',NEW."insurance_adjuster",'warranty_months',NEW."warranty_months",'warranty_expiry',NEW."warranty_expiry",'warranty_status',NEW."warranty_status",'created_at',NEW."created_at",'assigned_tech_id',NEW."assigned_tech_id"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_jobs_update AFTER UPDATE ON "jobs"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','jobs',NEW.id,
          json_object('id',OLD."id",'job_number',OLD."job_number",'customer_id',OLD."customer_id",'vehicle_id',OLD."vehicle_id",'asset_id',OLD."asset_id",'service_type',OLD."service_type",'title',OLD."title",'description',OLD."description",'status',OLD."status",'assigned_tech',OLD."assigned_tech",'scheduled_date',OLD."scheduled_date",'completed_date',OLD."completed_date",'priority',OLD."priority",'insurance_claim',OLD."insurance_claim",'insurance_adjuster',OLD."insurance_adjuster",'warranty_months',OLD."warranty_months",'warranty_expiry',OLD."warranty_expiry",'warranty_status',OLD."warranty_status",'created_at',OLD."created_at",'assigned_tech_id',OLD."assigned_tech_id"),json_object('id',NEW."id",'job_number',NEW."job_number",'customer_id',NEW."customer_id",'vehicle_id',NEW."vehicle_id",'asset_id',NEW."asset_id",'service_type',NEW."service_type",'title',NEW."title",'description',NEW."description",'status',NEW."status",'assigned_tech',NEW."assigned_tech",'scheduled_date',NEW."scheduled_date",'completed_date',NEW."completed_date",'priority',NEW."priority",'insurance_claim',NEW."insurance_claim",'insurance_adjuster',NEW."insurance_adjuster",'warranty_months',NEW."warranty_months",'warranty_expiry',NEW."warranty_expiry",'warranty_status',NEW."warranty_status",'created_at',NEW."created_at",'assigned_tech_id',NEW."assigned_tech_id"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_absences_delete AFTER DELETE ON "ops_absences"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_absences',OLD.id,
          json_object('id',OLD."id",'technician_id',OLD."technician_id",'date',OLD."date",'start_time',OLD."start_time",'end_time',OLD."end_time",'reason',OLD."reason"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_absences_insert AFTER INSERT ON "ops_absences"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_absences',NEW.id,
          NULL,json_object('id',NEW."id",'technician_id',NEW."technician_id",'date',NEW."date",'start_time',NEW."start_time",'end_time',NEW."end_time",'reason',NEW."reason"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_absences_update AFTER UPDATE ON "ops_absences"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_absences',NEW.id,
          json_object('id',OLD."id",'technician_id',OLD."technician_id",'date',OLD."date",'start_time',OLD."start_time",'end_time',OLD."end_time",'reason',OLD."reason"),json_object('id',NEW."id",'technician_id',NEW."technician_id",'date',NEW."date",'start_time',NEW."start_time",'end_time',NEW."end_time",'reason',NEW."reason"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_cases_delete AFTER DELETE ON "ops_cases"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_cases',OLD.id,
          json_object('id',OLD."id",'estimate_id',OLD."estimate_id",'job_id',OLD."job_id",'department',OLD."department",'promised_date',OLD."promised_date",'forecast_date',OLD."forecast_date",'hold_reason',OLD."hold_reason",'hold_since',OLD."hold_since",'parts_ready',OLD."parts_ready",'qc',OLD."qc",'cost_complete',OLD."cost_complete",'created_at',OLD."created_at",'completed_at',OLD."completed_at",'delivered_at',OLD."delivered_at",'version',OLD."version",'notes',OLD."notes"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_cases_insert AFTER INSERT ON "ops_cases"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_cases',NEW.id,
          NULL,json_object('id',NEW."id",'estimate_id',NEW."estimate_id",'job_id',NEW."job_id",'department',NEW."department",'promised_date',NEW."promised_date",'forecast_date',NEW."forecast_date",'hold_reason',NEW."hold_reason",'hold_since',NEW."hold_since",'parts_ready',NEW."parts_ready",'qc',NEW."qc",'cost_complete',NEW."cost_complete",'created_at',NEW."created_at",'completed_at',NEW."completed_at",'delivered_at',NEW."delivered_at",'version',NEW."version",'notes',NEW."notes"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_cases_update AFTER UPDATE ON "ops_cases"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_cases',NEW.id,
          json_object('id',OLD."id",'estimate_id',OLD."estimate_id",'job_id',OLD."job_id",'department',OLD."department",'promised_date',OLD."promised_date",'forecast_date',OLD."forecast_date",'hold_reason',OLD."hold_reason",'hold_since',OLD."hold_since",'parts_ready',OLD."parts_ready",'qc',OLD."qc",'cost_complete',OLD."cost_complete",'created_at',OLD."created_at",'completed_at',OLD."completed_at",'delivered_at',OLD."delivered_at",'version',OLD."version",'notes',OLD."notes"),json_object('id',NEW."id",'estimate_id',NEW."estimate_id",'job_id',NEW."job_id",'department',NEW."department",'promised_date',NEW."promised_date",'forecast_date',NEW."forecast_date",'hold_reason',NEW."hold_reason",'hold_since',NEW."hold_since",'parts_ready',NEW."parts_ready",'qc',NEW."qc",'cost_complete',NEW."cost_complete",'created_at',NEW."created_at",'completed_at',NEW."completed_at",'delivered_at',NEW."delivered_at",'version',NEW."version",'notes',NEW."notes"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_costs_delete AFTER DELETE ON "ops_costs"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_costs',OLD.id,
          json_object('id',OLD."id",'case_id',OLD."case_id",'kind',OLD."kind",'amount_cents',OLD."amount_cents",'note',OLD."note",'retry_key',OLD."retry_key",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_costs_insert AFTER INSERT ON "ops_costs"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_costs',NEW.id,
          NULL,json_object('id',NEW."id",'case_id',NEW."case_id",'kind',NEW."kind",'amount_cents',NEW."amount_cents",'note',NEW."note",'retry_key',NEW."retry_key",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_costs_update AFTER UPDATE ON "ops_costs"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_costs',NEW.id,
          json_object('id',OLD."id",'case_id',OLD."case_id",'kind',OLD."kind",'amount_cents',OLD."amount_cents",'note',OLD."note",'retry_key',OLD."retry_key",'created_at',OLD."created_at"),json_object('id',NEW."id",'case_id',NEW."case_id",'kind',NEW."kind",'amount_cents',NEW."amount_cents",'note',NEW."note",'retry_key',NEW."retry_key",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_followups_delete AFTER DELETE ON "ops_followups"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_followups',OLD.id,
          json_object('id',OLD."id",'estimate_id',OLD."estimate_id",'owner_id',OLD."owner_id",'next_date',OLD."next_date",'last_contact',OLD."last_contact",'state',OLD."state",'reason',OLD."reason",'note',OLD."note",'version',OLD."version",'presented_date',OLD."presented_date",'created_at',OLD."created_at",'updated_at',OLD."updated_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_followups_insert AFTER INSERT ON "ops_followups"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_followups',NEW.id,
          NULL,json_object('id',NEW."id",'estimate_id',NEW."estimate_id",'owner_id',NEW."owner_id",'next_date',NEW."next_date",'last_contact',NEW."last_contact",'state',NEW."state",'reason',NEW."reason",'note',NEW."note",'version',NEW."version",'presented_date',NEW."presented_date",'created_at',NEW."created_at",'updated_at',NEW."updated_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_followups_update AFTER UPDATE ON "ops_followups"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_followups',NEW.id,
          json_object('id',OLD."id",'estimate_id',OLD."estimate_id",'owner_id',OLD."owner_id",'next_date',OLD."next_date",'last_contact',OLD."last_contact",'state',OLD."state",'reason',OLD."reason",'note',OLD."note",'version',OLD."version",'presented_date',OLD."presented_date",'created_at',OLD."created_at",'updated_at',OLD."updated_at"),json_object('id',NEW."id",'estimate_id',NEW."estimate_id",'owner_id',NEW."owner_id",'next_date',NEW."next_date",'last_contact',NEW."last_contact",'state',NEW."state",'reason',NEW."reason",'note',NEW."note",'version',NEW."version",'presented_date',NEW."presented_date",'created_at',NEW."created_at",'updated_at',NEW."updated_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_profiles_delete AFTER DELETE ON "ops_profiles"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_profiles',OLD.id,
          json_object('id',OLD."id",'technician_id',OLD."technician_id",'department',OLD."department",'windows',OLD."windows",'confirmed',OLD."confirmed",'version',OLD."version"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_profiles_insert AFTER INSERT ON "ops_profiles"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_profiles',NEW.id,
          NULL,json_object('id',NEW."id",'technician_id',NEW."technician_id",'department',NEW."department",'windows',NEW."windows",'confirmed',NEW."confirmed",'version',NEW."version"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_profiles_update AFTER UPDATE ON "ops_profiles"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_profiles',NEW.id,
          json_object('id',OLD."id",'technician_id',OLD."technician_id",'department',OLD."department",'windows',OLD."windows",'confirmed',OLD."confirmed",'version',OLD."version"),json_object('id',NEW."id",'technician_id',NEW."technician_id",'department',NEW."department",'windows',NEW."windows",'confirmed',NEW."confirmed",'version',NEW."version"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_reservations_delete AFTER DELETE ON "ops_reservations"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_reservations',OLD.id,
          json_object('id',OLD."id",'slot_id',OLD."slot_id",'resource_id',OLD."resource_id",'retry_key',OLD."retry_key",'request_json',OLD."request_json",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_reservations_insert AFTER INSERT ON "ops_reservations"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_reservations',NEW.id,
          NULL,json_object('id',NEW."id",'slot_id',NEW."slot_id",'resource_id',NEW."resource_id",'retry_key',NEW."retry_key",'request_json',NEW."request_json",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_reservations_update AFTER UPDATE ON "ops_reservations"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_reservations',NEW.id,
          json_object('id',OLD."id",'slot_id',OLD."slot_id",'resource_id',OLD."resource_id",'retry_key',OLD."retry_key",'request_json',OLD."request_json",'created_at',OLD."created_at"),json_object('id',NEW."id",'slot_id',NEW."slot_id",'resource_id',NEW."resource_id",'retry_key',NEW."retry_key",'request_json',NEW."request_json",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_resources_delete AFTER DELETE ON "ops_resources"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_resources',OLD.id,
          json_object('id',OLD."id",'name',OLD."name",'department',OLD."department"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_resources_insert AFTER INSERT ON "ops_resources"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_resources',NEW.id,
          NULL,json_object('id',NEW."id",'name',NEW."name",'department',NEW."department"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_resources_update AFTER UPDATE ON "ops_resources"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_resources',NEW.id,
          json_object('id',OLD."id",'name',OLD."name",'department',OLD."department"),json_object('id',NEW."id",'name',NEW."name",'department',NEW."department"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_tasks_delete AFTER DELETE ON "ops_tasks"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_tasks',OLD.id,
          json_object('id',OLD."id",'case_id',OLD."case_id",'source_line_id',OLD."source_line_id",'description',OLD."description",'line_type',OLD."line_type",'net_cents',OLD."net_cents",'estimated_minutes',OLD."estimated_minutes",'standard_minutes',OLD."standard_minutes",'completed_at',OLD."completed_at",'version',OLD."version"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_tasks_insert AFTER INSERT ON "ops_tasks"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_tasks',NEW.id,
          NULL,json_object('id',NEW."id",'case_id',NEW."case_id",'source_line_id',NEW."source_line_id",'description',NEW."description",'line_type',NEW."line_type",'net_cents',NEW."net_cents",'estimated_minutes',NEW."estimated_minutes",'standard_minutes',NEW."standard_minutes",'completed_at',NEW."completed_at",'version',NEW."version"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_tasks_update AFTER UPDATE ON "ops_tasks"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_tasks',NEW.id,
          json_object('id',OLD."id",'case_id',OLD."case_id",'source_line_id',OLD."source_line_id",'description',OLD."description",'line_type',OLD."line_type",'net_cents',OLD."net_cents",'estimated_minutes',OLD."estimated_minutes",'standard_minutes',OLD."standard_minutes",'completed_at',OLD."completed_at",'version',OLD."version"),json_object('id',NEW."id",'case_id',NEW."case_id",'source_line_id',NEW."source_line_id",'description',NEW."description",'line_type',NEW."line_type",'net_cents',NEW."net_cents",'estimated_minutes',NEW."estimated_minutes",'standard_minutes',NEW."standard_minutes",'completed_at',NEW."completed_at",'version',NEW."version"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_time_delete AFTER DELETE ON "ops_time"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','ops_time',OLD.id,
          json_object('id',OLD."id",'task_id',OLD."task_id",'technician_id',OLD."technician_id",'work_date',OLD."work_date",'minutes',OLD."minutes",'kind',OLD."kind",'note',OLD."note",'retry_key',OLD."retry_key",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_time_insert AFTER INSERT ON "ops_time"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','ops_time',NEW.id,
          NULL,json_object('id',NEW."id",'task_id',NEW."task_id",'technician_id',NEW."technician_id",'work_date',NEW."work_date",'minutes',NEW."minutes",'kind',NEW."kind",'note',NEW."note",'retry_key',NEW."retry_key",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_ops_time_update AFTER UPDATE ON "ops_time"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','ops_time',NEW.id,
          json_object('id',OLD."id",'task_id',OLD."task_id",'technician_id',OLD."technician_id",'work_date',OLD."work_date",'minutes',OLD."minutes",'kind',OLD."kind",'note',OLD."note",'retry_key',OLD."retry_key",'created_at',OLD."created_at"),json_object('id',NEW."id",'task_id',NEW."task_id",'technician_id',NEW."technician_id",'work_date',NEW."work_date",'minutes',NEW."minutes",'kind',NEW."kind",'note',NEW."note",'retry_key',NEW."retry_key",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_payments_delete AFTER DELETE ON "payments"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','payments',OLD.id,
          json_object('id',OLD."id",'payment_number',OLD."payment_number",'invoice_id',OLD."invoice_id",'customer_id',OLD."customer_id",'amount',OLD."amount",'payment_method',OLD."payment_method",'payment_date',OLD."payment_date",'reference',OLD."reference",'qb_synced',OLD."qb_synced",'qb_txn_id',OLD."qb_txn_id",'created_at',OLD."created_at",'idempotency_key',OLD."idempotency_key"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_payments_insert AFTER INSERT ON "payments"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','payments',NEW.id,
          NULL,json_object('id',NEW."id",'payment_number',NEW."payment_number",'invoice_id',NEW."invoice_id",'customer_id',NEW."customer_id",'amount',NEW."amount",'payment_method',NEW."payment_method",'payment_date',NEW."payment_date",'reference',NEW."reference",'qb_synced',NEW."qb_synced",'qb_txn_id',NEW."qb_txn_id",'created_at',NEW."created_at",'idempotency_key',NEW."idempotency_key"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_payments_update AFTER UPDATE ON "payments"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','payments',NEW.id,
          json_object('id',OLD."id",'payment_number',OLD."payment_number",'invoice_id',OLD."invoice_id",'customer_id',OLD."customer_id",'amount',OLD."amount",'payment_method',OLD."payment_method",'payment_date',OLD."payment_date",'reference',OLD."reference",'qb_synced',OLD."qb_synced",'qb_txn_id',OLD."qb_txn_id",'created_at',OLD."created_at",'idempotency_key',OLD."idempotency_key"),json_object('id',NEW."id",'payment_number',NEW."payment_number",'invoice_id',NEW."invoice_id",'customer_id',NEW."customer_id",'amount',NEW."amount",'payment_method',NEW."payment_method",'payment_date',NEW."payment_date",'reference',NEW."reference",'qb_synced',NEW."qb_synced",'qb_txn_id',NEW."qb_txn_id",'created_at',NEW."created_at",'idempotency_key',NEW."idempotency_key"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_report_definitions_delete AFTER DELETE ON "report_definitions"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','report_definitions',OLD.id,
          json_object('id',OLD."id",'name',OLD."name",'config',OLD."config",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_report_definitions_insert AFTER INSERT ON "report_definitions"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','report_definitions',NEW.id,
          NULL,json_object('id',NEW."id",'name',NEW."name",'config',NEW."config",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_report_definitions_update AFTER UPDATE ON "report_definitions"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','report_definitions',NEW.id,
          json_object('id',OLD."id",'name',OLD."name",'config',OLD."config",'created_at',OLD."created_at"),json_object('id',NEW."id",'name',NEW."name",'config',NEW."config",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_schedule_slots_delete AFTER DELETE ON "schedule_slots"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','schedule_slots',OLD.id,
          json_object('id',OLD."id",'job_id',OLD."job_id",'customer_id',OLD."customer_id",'technician_id',OLD."technician_id",'date',OLD."date",'start_time',OLD."start_time",'end_time',OLD."end_time",'duration_hours',OLD."duration_hours",'slot_type',OLD."slot_type",'status',OLD."status",'notes',OLD."notes",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_schedule_slots_insert AFTER INSERT ON "schedule_slots"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','schedule_slots',NEW.id,
          NULL,json_object('id',NEW."id",'job_id',NEW."job_id",'customer_id',NEW."customer_id",'technician_id',NEW."technician_id",'date',NEW."date",'start_time',NEW."start_time",'end_time',NEW."end_time",'duration_hours',NEW."duration_hours",'slot_type',NEW."slot_type",'status',NEW."status",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_schedule_slots_update AFTER UPDATE ON "schedule_slots"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','schedule_slots',NEW.id,
          json_object('id',OLD."id",'job_id',OLD."job_id",'customer_id',OLD."customer_id",'technician_id',OLD."technician_id",'date',OLD."date",'start_time',OLD."start_time",'end_time',OLD."end_time",'duration_hours',OLD."duration_hours",'slot_type',OLD."slot_type",'status',OLD."status",'notes',OLD."notes",'created_at',OLD."created_at"),json_object('id',NEW."id",'job_id',NEW."job_id",'customer_id',NEW."customer_id",'technician_id',NEW."technician_id",'date',NEW."date",'start_time',NEW."start_time",'end_time',NEW."end_time",'duration_hours',NEW."duration_hours",'slot_type',NEW."slot_type",'status',NEW."status",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_service_history_delete AFTER DELETE ON "service_history"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','service_history',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'vehicle_id',OLD."vehicle_id",'asset_id',OLD."asset_id",'job_id',OLD."job_id",'estimate_id',OLD."estimate_id",'invoice_id',OLD."invoice_id",'service_date',OLD."service_date",'service_type',OLD."service_type",'description',OLD."description",'technician',OLD."technician",'warranty_months',OLD."warranty_months",'warranty_expiry',OLD."warranty_expiry",'warranty_status',OLD."warranty_status",'cost',OLD."cost",'status',OLD."status",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_service_history_insert AFTER INSERT ON "service_history"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','service_history',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'vehicle_id',NEW."vehicle_id",'asset_id',NEW."asset_id",'job_id',NEW."job_id",'estimate_id',NEW."estimate_id",'invoice_id',NEW."invoice_id",'service_date',NEW."service_date",'service_type',NEW."service_type",'description',NEW."description",'technician',NEW."technician",'warranty_months',NEW."warranty_months",'warranty_expiry',NEW."warranty_expiry",'warranty_status',NEW."warranty_status",'cost',NEW."cost",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_service_history_update AFTER UPDATE ON "service_history"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','service_history',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'vehicle_id',OLD."vehicle_id",'asset_id',OLD."asset_id",'job_id',OLD."job_id",'estimate_id',OLD."estimate_id",'invoice_id',OLD."invoice_id",'service_date',OLD."service_date",'service_type',OLD."service_type",'description',OLD."description",'technician',OLD."technician",'warranty_months',OLD."warranty_months",'warranty_expiry',OLD."warranty_expiry",'warranty_status',OLD."warranty_status",'cost',OLD."cost",'status',OLD."status",'created_at',OLD."created_at"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'vehicle_id',NEW."vehicle_id",'asset_id',NEW."asset_id",'job_id',NEW."job_id",'estimate_id',NEW."estimate_id",'invoice_id',NEW."invoice_id",'service_date',NEW."service_date",'service_type',NEW."service_type",'description',NEW."description",'technician',NEW."technician",'warranty_months',NEW."warranty_months",'warranty_expiry',NEW."warranty_expiry",'warranty_status',NEW."warranty_status",'cost',NEW."cost",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_tax_jurisdictions_delete AFTER DELETE ON "tax_jurisdictions"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','tax_jurisdictions',OLD.id,
          json_object('id',OLD."id",'jurisdiction_name',OLD."jurisdiction_name",'city',OLD."city",'county',OLD."county",'state',OLD."state",'zip',OLD."zip",'tax_rate',OLD."tax_rate",'tax_code',OLD."tax_code",'qb_tax_code',OLD."qb_tax_code",'tax_exempt_allowed',OLD."tax_exempt_allowed",'notes',OLD."notes",'status',OLD."status",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_tax_jurisdictions_insert AFTER INSERT ON "tax_jurisdictions"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','tax_jurisdictions',NEW.id,
          NULL,json_object('id',NEW."id",'jurisdiction_name',NEW."jurisdiction_name",'city',NEW."city",'county',NEW."county",'state',NEW."state",'zip',NEW."zip",'tax_rate',NEW."tax_rate",'tax_code',NEW."tax_code",'qb_tax_code',NEW."qb_tax_code",'tax_exempt_allowed',NEW."tax_exempt_allowed",'notes',NEW."notes",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_tax_jurisdictions_update AFTER UPDATE ON "tax_jurisdictions"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','tax_jurisdictions',NEW.id,
          json_object('id',OLD."id",'jurisdiction_name',OLD."jurisdiction_name",'city',OLD."city",'county',OLD."county",'state',OLD."state",'zip',OLD."zip",'tax_rate',OLD."tax_rate",'tax_code',OLD."tax_code",'qb_tax_code',OLD."qb_tax_code",'tax_exempt_allowed',OLD."tax_exempt_allowed",'notes',OLD."notes",'status',OLD."status",'created_at',OLD."created_at"),json_object('id',NEW."id",'jurisdiction_name',NEW."jurisdiction_name",'city',NEW."city",'county',NEW."county",'state',NEW."state",'zip',NEW."zip",'tax_rate',NEW."tax_rate",'tax_code',NEW."tax_code",'qb_tax_code',NEW."qb_tax_code",'tax_exempt_allowed',NEW."tax_exempt_allowed",'notes',NEW."notes",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_technicians_delete AFTER DELETE ON "technicians"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','technicians',OLD.id,
          json_object('id',OLD."id",'user_id',OLD."user_id",'name',OLD."name",'email',OLD."email",'phone',OLD."phone",'skill_areas',OLD."skill_areas",'technician_type',OLD."technician_type",'status',OLD."status",'color',OLD."color",'capacity',OLD."capacity",'notes',OLD."notes",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_technicians_insert AFTER INSERT ON "technicians"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','technicians',NEW.id,
          NULL,json_object('id',NEW."id",'user_id',NEW."user_id",'name',NEW."name",'email',NEW."email",'phone',NEW."phone",'skill_areas',NEW."skill_areas",'technician_type',NEW."technician_type",'status',NEW."status",'color',NEW."color",'capacity',NEW."capacity",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_technicians_update AFTER UPDATE ON "technicians"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','technicians',NEW.id,
          json_object('id',OLD."id",'user_id',OLD."user_id",'name',OLD."name",'email',OLD."email",'phone',OLD."phone",'skill_areas',OLD."skill_areas",'technician_type',OLD."technician_type",'status',OLD."status",'color',OLD."color",'capacity',OLD."capacity",'notes',OLD."notes",'created_at',OLD."created_at"),json_object('id',NEW."id",'user_id',NEW."user_id",'name',NEW."name",'email',NEW."email",'phone',NEW."phone",'skill_areas',NEW."skill_areas",'technician_type',NEW."technician_type",'status',NEW."status",'color',NEW."color",'capacity',NEW."capacity",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_third_party_payers_delete AFTER DELETE ON "third_party_payers"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','third_party_payers',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'payer_type',OLD."payer_type",'payer_name',OLD."payer_name",'contact_name',OLD."contact_name",'contact_title',OLD."contact_title",'email',OLD."email",'phone',OLD."phone",'billing_address',OLD."billing_address",'billing_city',OLD."billing_city",'billing_state',OLD."billing_state",'billing_zip',OLD."billing_zip",'account_number',OLD."account_number",'claim_number',OLD."claim_number",'authorization_number',OLD."authorization_number",'po_required',OLD."po_required",'approval_required',OLD."approval_required",'payment_terms',OLD."payment_terms",'tax_exempt',OLD."tax_exempt",'notes',OLD."notes",'status',OLD."status",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_third_party_payers_insert AFTER INSERT ON "third_party_payers"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','third_party_payers',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'payer_type',NEW."payer_type",'payer_name',NEW."payer_name",'contact_name',NEW."contact_name",'contact_title',NEW."contact_title",'email',NEW."email",'phone',NEW."phone",'billing_address',NEW."billing_address",'billing_city',NEW."billing_city",'billing_state',NEW."billing_state",'billing_zip',NEW."billing_zip",'account_number',NEW."account_number",'claim_number',NEW."claim_number",'authorization_number',NEW."authorization_number",'po_required',NEW."po_required",'approval_required',NEW."approval_required",'payment_terms',NEW."payment_terms",'tax_exempt',NEW."tax_exempt",'notes',NEW."notes",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_third_party_payers_update AFTER UPDATE ON "third_party_payers"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','third_party_payers',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'payer_type',OLD."payer_type",'payer_name',OLD."payer_name",'contact_name',OLD."contact_name",'contact_title',OLD."contact_title",'email',OLD."email",'phone',OLD."phone",'billing_address',OLD."billing_address",'billing_city',OLD."billing_city",'billing_state',OLD."billing_state",'billing_zip',OLD."billing_zip",'account_number',OLD."account_number",'claim_number',OLD."claim_number",'authorization_number',OLD."authorization_number",'po_required',OLD."po_required",'approval_required',OLD."approval_required",'payment_terms',OLD."payment_terms",'tax_exempt',OLD."tax_exempt",'notes',OLD."notes",'status',OLD."status",'created_at',OLD."created_at"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'payer_type',NEW."payer_type",'payer_name',NEW."payer_name",'contact_name',NEW."contact_name",'contact_title',NEW."contact_title",'email',NEW."email",'phone',NEW."phone",'billing_address',NEW."billing_address",'billing_city',NEW."billing_city",'billing_state',NEW."billing_state",'billing_zip',NEW."billing_zip",'account_number',NEW."account_number",'claim_number',NEW."claim_number",'authorization_number',NEW."authorization_number",'po_required',NEW."po_required",'approval_required',NEW."approval_required",'payment_terms',NEW."payment_terms",'tax_exempt',NEW."tax_exempt",'notes',NEW."notes",'status',NEW."status",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_vehicles_delete AFTER DELETE ON "vehicles"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','vehicles',OLD.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'vin',OLD."vin",'year',OLD."year",'make',OLD."make",'model',OLD."model",'trim',OLD."trim",'body_class',OLD."body_class",'vehicle_type',OLD."vehicle_type",'color',OLD."color",'engine_info',OLD."engine_info",'fuel_type',OLD."fuel_type",'gvwr',OLD."gvwr",'plant_country',OLD."plant_country",'license_plate',OLD."license_plate",'notes',OLD."notes",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_vehicles_insert AFTER INSERT ON "vehicles"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','vehicles',NEW.id,
          NULL,json_object('id',NEW."id",'customer_id',NEW."customer_id",'vin',NEW."vin",'year',NEW."year",'make',NEW."make",'model',NEW."model",'trim',NEW."trim",'body_class',NEW."body_class",'vehicle_type',NEW."vehicle_type",'color',NEW."color",'engine_info',NEW."engine_info",'fuel_type',NEW."fuel_type",'gvwr',NEW."gvwr",'plant_country',NEW."plant_country",'license_plate',NEW."license_plate",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_vehicles_update AFTER UPDATE ON "vehicles"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','vehicles',NEW.id,
          json_object('id',OLD."id",'customer_id',OLD."customer_id",'vin',OLD."vin",'year',OLD."year",'make',OLD."make",'model',OLD."model",'trim',OLD."trim",'body_class',OLD."body_class",'vehicle_type',OLD."vehicle_type",'color',OLD."color",'engine_info',OLD."engine_info",'fuel_type',OLD."fuel_type",'gvwr',OLD."gvwr",'plant_country',OLD."plant_country",'license_plate',OLD."license_plate",'notes',OLD."notes",'created_at',OLD."created_at"),json_object('id',NEW."id",'customer_id',NEW."customer_id",'vin',NEW."vin",'year',NEW."year",'make',NEW."make",'model',NEW."model",'trim',NEW."trim",'body_class',NEW."body_class",'vehicle_type',NEW."vehicle_type",'color',NEW."color",'engine_info',NEW."engine_info",'fuel_type',NEW."fuel_type",'gvwr',NEW."gvwr",'plant_country',NEW."plant_country",'license_plate',NEW."license_plate",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_warranty_claims_delete AFTER DELETE ON "warranty_claims"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.delete','warranty_claims',OLD.id,
          json_object('id',OLD."id",'claim_number',OLD."claim_number",'customer_id',OLD."customer_id",'vehicle_id',OLD."vehicle_id",'asset_id',OLD."asset_id",'service_history_id',OLD."service_history_id",'original_job_id',OLD."original_job_id",'original_invoice_id',OLD."original_invoice_id",'corrective_job_id',OLD."corrective_job_id",'claim_date',OLD."claim_date",'warranty_expiry',OLD."warranty_expiry",'status',OLD."status",'issue_description',OLD."issue_description",'inspection_findings',OLD."inspection_findings",'resolution',OLD."resolution",'responsibility',OLD."responsibility",'assigned_tech',OLD."assigned_tech",'resolved_date',OLD."resolved_date",'labor_hours',OLD."labor_hours",'claim_cost',OLD."claim_cost",'notes',OLD."notes",'created_at',OLD."created_at"),NULL,staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_warranty_claims_insert AFTER INSERT ON "warranty_claims"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.insert','warranty_claims',NEW.id,
          NULL,json_object('id',NEW."id",'claim_number',NEW."claim_number",'customer_id',NEW."customer_id",'vehicle_id',NEW."vehicle_id",'asset_id',NEW."asset_id",'service_history_id',NEW."service_history_id",'original_job_id',NEW."original_job_id",'original_invoice_id',NEW."original_invoice_id",'corrective_job_id',NEW."corrective_job_id",'claim_date',NEW."claim_date",'warranty_expiry',NEW."warranty_expiry",'status',NEW."status",'issue_description',NEW."issue_description",'inspection_findings',NEW."inspection_findings",'resolution',NEW."resolution",'responsibility',NEW."responsibility",'assigned_tech',NEW."assigned_tech",'resolved_date',NEW."resolved_date",'labor_hours',NEW."labor_hours",'claim_cost',NEW."claim_cost",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;

CREATE TRIGGER staff_audit_warranty_claims_update AFTER UPDATE ON "warranty_claims"
          BEGIN INSERT INTO security_audit(actor_id,actor_label,event,entity,record_id,before_json,after_json,request_id,occurred_at)
          VALUES(staff_actor_id(),staff_actor_label(),'record.update','warranty_claims',NEW.id,
          json_object('id',OLD."id",'claim_number',OLD."claim_number",'customer_id',OLD."customer_id",'vehicle_id',OLD."vehicle_id",'asset_id',OLD."asset_id",'service_history_id',OLD."service_history_id",'original_job_id',OLD."original_job_id",'original_invoice_id',OLD."original_invoice_id",'corrective_job_id',OLD."corrective_job_id",'claim_date',OLD."claim_date",'warranty_expiry',OLD."warranty_expiry",'status',OLD."status",'issue_description',OLD."issue_description",'inspection_findings',OLD."inspection_findings",'resolution',OLD."resolution",'responsibility',OLD."responsibility",'assigned_tech',OLD."assigned_tech",'resolved_date',OLD."resolved_date",'labor_hours',OLD."labor_hours",'claim_cost',OLD."claim_cost",'notes',OLD."notes",'created_at',OLD."created_at"),json_object('id',NEW."id",'claim_number',NEW."claim_number",'customer_id',NEW."customer_id",'vehicle_id',NEW."vehicle_id",'asset_id',NEW."asset_id",'service_history_id',NEW."service_history_id",'original_job_id',NEW."original_job_id",'original_invoice_id',NEW."original_invoice_id",'corrective_job_id',NEW."corrective_job_id",'claim_date',NEW."claim_date",'warranty_expiry',NEW."warranty_expiry",'status',NEW."status",'issue_description',NEW."issue_description",'inspection_findings',NEW."inspection_findings",'resolution',NEW."resolution",'responsibility',NEW."responsibility",'assigned_tech',NEW."assigned_tech",'resolved_date',NEW."resolved_date",'labor_hours',NEW."labor_hours",'claim_cost',NEW."claim_cost",'notes',NEW."notes",'created_at',NEW."created_at"),staff_request_id(),strftime('%Y-%m-%dT%H:%M:%fZ','now')); END;
