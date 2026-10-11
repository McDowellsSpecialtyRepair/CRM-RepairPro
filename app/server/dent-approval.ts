import { sqlite } from "./storage-db";
import { packageComparison, packageNeedsApproval } from "../shared/dents";

// Package price approval (Phase 2.2). Kept free of billing imports so billing, sending and production
// can all ask the same question. A package below its calculated individual dent total (or with
// incomplete pricing) needs approval from an owner, administrator or manager, for its exact price.
const thresholdPercent = (): number | null => {
  const v = (sqlite.prepare("SELECT value FROM pdr_pricing_settings WHERE key='package_approval_threshold_percent'").get() as any)?.value;
  return v == null || v === "" ? null : Number(v);
};

export function packageStatus(g: any) {
  const calculated = g.calculated_total === null ? null : g.calculated_total;
  const comparison = packageComparison(calculated, g.manual_price);
  const approvalRequired = packageNeedsApproval(calculated, g.manual_price, thresholdPercent());
  const approved = approvalRequired && g.approved_price !== null && g.approved_price === g.manual_price && !!g.approved_at;
  return { comparison, approvalRequired, approved, blocking: approvalRequired && !approved };
}

// Active packages on the estimate whose price still needs management approval.
export function unapprovedPackages(estimateId: number) {
  return (sqlite.prepare("SELECT * FROM estimate_dent_groups WHERE estimate_id=? AND status='active'").all(estimateId) as any[])
    .filter(g => packageStatus(g).blocking);
}
export function assertPackagesApproved(estimateId: number, action: string) {
  const blocked = unapprovedPackages(estimateId);
  if (blocked.length)
    throw Object.assign(new Error(`An owner, administrator or manager must approve the package price before this estimate can be ${action}: ${blocked.map(g => g.label).join("; ")}.`), { status: 409 });
}
