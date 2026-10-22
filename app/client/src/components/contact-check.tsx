import { checkEmail, checkPhone } from "@shared/contact-validation";
import { Button } from "@/components/ui/button";

// The message under a phone or email box: what's wrong, and for an email typo a one-click fix or "keep it".
// Shown once something has been typed; the server applies the same checks when saving.
export function ContactCheck({ kind, value, keep, onFix, onKeep, testId }: { kind: "phone" | "email"; value: string; keep?: boolean; onFix: (v: string) => void; onKeep?: (keep: boolean) => void; testId?: string }) {
  if (!value.trim()) return null;
  const r = kind === "phone" ? checkPhone(value) : checkEmail(value);
  if (r.ok) {
    if (kind === "phone" && r.value !== value.trim()) return <p className="text-xs text-muted-foreground mt-1" data-testid={testId}>Will be saved as {r.value}</p>;
    return null;
  }
  const canKeep = kind === "email" && !!r.suggestion && !/\s/.test(value.trim()) && !!onKeep;
  if (canKeep && keep) return <p className="text-xs text-muted-foreground mt-1" data-testid={testId}>Keeping the email exactly as typed. <button type="button" className="underline" onClick={() => onKeep!(false)}>Check it again</button></p>;
  return <div role="alert" className="mt-1 text-xs text-destructive space-y-1" data-testid={testId}>
    <p>{r.message}</p>
    {r.suggestion && <div className="flex flex-wrap items-center gap-2 text-foreground">
      <span>Did you mean <strong>{r.suggestion}</strong>?</span>
      <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => onFix(r.suggestion!)} data-testid={testId ? `${testId}-fix` : undefined}>Use this</Button>
      {canKeep && <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => onKeep!(true)}>Keep as typed</Button>}
    </div>}
  </div>;
}

// Problems that stop a customer from being saved, in plain words, for the list next to the save button.
export function contactProblems(phone: string, email: string, keepEmail: boolean) {
  const out: string[] = [];
  const p = checkPhone(phone), e = checkEmail(email);
  if (!p.ok) out.push("Fix the phone number (see the message under it).");
  if (!e.ok && !(keepEmail && e.suggestion && !/\s/.test(email.trim()))) out.push("Fix the email address, or leave it blank (see the message under it).");
  return out;
}
