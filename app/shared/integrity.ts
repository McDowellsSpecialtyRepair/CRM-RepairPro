// Relationship catalog used by the versioned SQLite migration. Ownership FKs
// are deferred so an entire customer's graph can move in one transaction.
export const relationshipTargets: Record<string, string> = {
  customer_id: "customers", vehicle_id: "vehicles", asset_id: "assets",
  job_id: "jobs", estimate_id: "estimates", invoice_id: "invoices",
  user_id: "users", technician_id: "technicians",
  assigned_technician_id: "technicians", scheduled_slot_id: "schedule_slots",
  default_third_party_payer_id: "third_party_payers", fleet_account_id: "fleet_accounts",
  service_history_id: "service_history", original_job_id: "jobs",
  original_invoice_id: "invoices", corrective_job_id: "jobs",
};
