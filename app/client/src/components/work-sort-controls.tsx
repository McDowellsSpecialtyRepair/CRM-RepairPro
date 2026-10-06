import type { WorkSort, SortDirection } from "@shared/work-sort";
const orders: Record<WorkSort, [string, string]> = {
  number: ["Number: low to high", "Number: high to low"],
  priority: ["Low urgency first", "Urgent repairs first"],
  assignedTech: ["Technician: A to Z", "Technician: Z to A"],
  scheduledDate: ["Earliest date first", "Latest date first"],
};
export function WorkSortControls({ field, direction, onChange, count }: {
  field: WorkSort; direction: SortDirection; onChange: (field: WorkSort, direction: SortDirection) => void; count: number;
}) {
  const cls = "mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return <section aria-label="List sorting" className="rounded-lg border p-3">
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <label className="text-sm">Sort by<select aria-label="Sort by" value={field} className={cls} onChange={e => { const f = e.target.value as WorkSort; onChange(f, f === "priority" ? "desc" : "asc"); }}>
        <option value="number">Record number</option><option value="priority">Repair urgency</option><option value="assignedTech">Lead technician</option><option value="scheduledDate">Planned schedule date</option>
      </select></label>
      <label className="text-sm">Sort order<select aria-label="Sort order" value={direction} className={cls} onChange={e => onChange(field, e.target.value as SortDirection)}>
        <option value="asc">{orders[field][0]}</option><option value="desc">{orders[field][1]}</option>
      </select></label>
      <p role="status" className="text-xs text-muted-foreground pb-2">{count} records shown</p>
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Unassigned or undated records stay at the bottom. Ties use record number. Sorting changes this view only.</p>
  </section>;
}
