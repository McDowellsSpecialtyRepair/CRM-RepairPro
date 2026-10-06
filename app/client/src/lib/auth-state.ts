// Tokens deliberately live in memory, never browser storage or URLs.
import type { StaffUser } from "@shared/security";
let session: { token: string; user: StaffUser } | null = null;
const listeners = new Set<() => void>();
export const authState = {
  get: () => session,
  set: (s: typeof session) => { session = s; listeners.forEach(fn => fn()); },
  subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
};
