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
  const cls = "h-11 sm:h-9 rounded-md border border-input bg-background px-2 text-sm";
  // One compact line: "Sort by [list] [order]  4 records shown".
  return <section aria-label="List sorting" className="text-sm">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <label className="flex items-center gap-2">Sort by<select aria-label="Sort by" value={field} className={cls} onChange={e => { const f = e.target.value as WorkSort; onChange(f, f === "priority" ? "desc" : "asc"); }}>
        <option value="number">Record number</option><option value="priority">Repair urgency</option><option value="assignedTech">Lead technician</option><option value="scheduledDate">Planned schedule date</option>
      </select></label>
      <label className="flex items-center gap-2"><span className="sr-only">Sort order</span><select aria-label="Sort order" value={direction} className={cls} onChange={e => onChange(field, e.target.value as SortDirection)}>
        <option value="asc">{orders[field][0]}</option><option value="desc">{orders[field][1]}</option>
      </select></label>
      <p role="status" className="text-xs text-muted-foreground">{count} records shown</p>
    </div>
    <p className="mt-1 text-[11px] text-muted-foreground">Unassigned or undated records stay at the bottom. Ties use record number. Sorting changes this view only.</p>
  </section>;
}
