// Asks the service advisor whether a different phone / email / address
// means the customer changed it (new number, new email, moved) or has more than one.

export type ContactAnswer = "replaced" | "both" | "kept";

const Q: Record<string, { title: (d: any) => string; opts: { v: ContactAnswer; label: (d: any) => string; hint: string }[] }> = {
  phone: {
    title: () => "Did the customer get a new phone number?",
    opts: [
      { v: "replaced", label: (d) => `Yes, ${d.incoming} replaced ${d.current || "the old number"}`, hint: "Old number is recorded as no longer in use." },
      { v: "both", label: () => "No, they use both numbers", hint: "Second number is saved as mobile or an extra contact." },
      { v: "kept", label: (d) => `No, ${d.current} is still correct`, hint: "The other number is noted but not used." },
    ],
  },
  mobile: {
    title: () => "Did the customer get a new mobile number?",
    opts: [
      { v: "replaced", label: (d) => `Yes, ${d.incoming} replaced ${d.current || "the old mobile"}`, hint: "Old mobile is recorded as no longer in use." },
      { v: "both", label: () => "No, they use both", hint: "Extra number is saved as an additional contact." },
      { v: "kept", label: (d) => `No, ${d.current} is still correct`, hint: "The other number is noted but not used." },
    ],
  },
  email: {
    title: () => "Did the customer change their email?",
    opts: [
      { v: "replaced", label: (d) => `Yes, use ${d.incoming} from now on`, hint: "Estimates and invoices go to the new email." },
      { v: "both", label: () => "No, they use both emails", hint: "Second email is saved as an extra contact; billing stays on the current one." },
      { v: "kept", label: (d) => `No, keep ${d.current}`, hint: "The other email is noted but not used." },
    ],
  },
  address: {
    title: () => "Did the customer move?",
    opts: [
      { v: "replaced", label: (d) => `Yes, they moved to ${d.incomingText}`, hint: "Street, city, state and ZIP update together; old address kept in history." },
      { v: "both", label: () => "No, it's a second location", hint: "Primary/billing address stays; second location saved to notes." },
      { v: "kept", label: (d) => `No, ${d.currentText} is still correct`, hint: "The other address is noted but not used." },
    ],
  },
};

interface Props {
  diffs: any[];
  answers: Record<string, ContactAnswer | undefined>;
  onChange: (key: string, a: ContactAnswer) => void;
}

export function ContactChangeQuestions({ diffs, answers, onChange }: Props) {
  if (!diffs.length) return null;
  return (
    <div className="space-y-3" data-testid="contact-change-questions">
      {diffs.map((d) => {
        const q = Q[d.key];
        const cur = d.key === "address" ? d.currentText : d.current;
        const inc = d.key === "address" ? d.incomingText : d.incoming;
        return (
          <div key={d.key} className="rounded-md border border-border p-3" data-testid={`contact-q-${d.key}`}>
            <div className="text-sm font-semibold">{q.title(d)}</div>
            <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
              <div><span className="font-medium text-foreground">On file:</span> {cur || "(blank)"}</div>
              <div><span className="font-medium text-foreground">New:</span> {inc}</div>
            </div>
            <div className="mt-2 space-y-1.5">
              {q.opts.map((o) => {
                if (o.v === "kept" && !cur) return null;
                const on = answers[d.key] === o.v;
                const incomplete = d.key === "address" && o.v === "replaced" && (!d.incoming?.city || !d.incoming?.zip);
                return (
                  <button key={o.v} type="button" onClick={() => !incomplete && onChange(d.key, o.v)} disabled={incomplete}
                    className={`w-full text-left rounded-md border px-3 py-2 ${on ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"} ${incomplete ? "opacity-50" : ""}`}
                    data-testid={`contact-a-${d.key}-${o.v}`}>
                    <span className="block text-sm break-words">{o.label(d)}</span>
                    <span className="block text-[11px] text-muted-foreground">{incomplete ? "Go back and enter the new city and ZIP to record a move." : o.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const allAnswered = (diffs: any[], answers: Record<string, any>) => diffs.every((d) => !!answers[d.key]);
