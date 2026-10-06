import { createContext, useContext, useEffect, useSyncExternalStore, useState } from "react";
import { authState } from "@/lib/auth-state";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, LockKeyhole } from "lucide-react";
import type { StaffUser } from "@shared/security";
import { useQuery } from "@tanstack/react-query";
const Auth = createContext<{ user: StaffUser; can: (p: string) => boolean; logout: () => Promise<void> }>(null as any);
export const useAuth = () => useContext(Auth);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(authState.subscribe, authState.get, authState.get);
  const setup = useQuery<any>({queryKey:["/api/auth/status"],enabled:!session});
  const [mode, setMode] = useState<"login" | "activate">("login");
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [confirmation, setConfirmation] = useState(""), [code, setCode] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => { void apiRequest("GET", "/api/auth/me").catch(() => {}); }, 60000);
    return () => clearInterval(timer);
  }, [session?.user.id]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    if(mode==="activate"&&code.includes("@")){setError("That looks like your email address. Put service@mcdowellsrepair.com in Work email. Activation code needs the separate one-time code from your private activation instructions, not your email address.");return;}
    if (mode === "activate" && password !== confirmation) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      const data = await apiRequest("POST", `/api/auth/${mode}`, mode === "activate" ? { email, password, activationCode: code.trim() } : { email, password });
      await queryClient.cancelQueries(); queryClient.clear(); authState.set({ token: data.token, user: data.user });
      setPassword(""); setConfirmation(""); setCode("");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }
  const logout = async () => {
    // Do not silently drop the only token if the server cannot revoke it.
    await apiRequest("POST", "/api/auth/logout", {});
    await queryClient.cancelQueries(); queryClient.clear(); authState.set(null);
  };
  if (session) return <Auth.Provider value={{ user: session.user, can: p => session.user.permissions.includes(p), logout }}>{children}</Auth.Provider>;
  return <main className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="w-full max-w-md">
      <div className="flex items-center gap-3 mb-7"><ShieldCheck className="h-10 w-10 text-primary" /><div><h1 className="text-xl font-bold">RepairPro staff access</h1><p className="text-sm text-muted-foreground">McDowells Specialty Repair</p></div></div>
      <section className="border rounded-xl bg-card p-6 shadow-sm">
        {setup.data?.setupRequired && <p role="status" className="mb-4 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">First Owner setup is pending. Confirm the Owner email in the development conversation to receive a private one-time activation code. This does not use Facebook, WhatsApp or email delivery. Existing business records are preserved.</p>}
        <h2 className="text-lg font-semibold">{mode === "login" ? "Sign in to your workspace" : "Activate your staff account"}</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-5">{mode === "login" ? "Use your individual staff account. Shared demo logins are disabled." : "Use the one-time code from an owner or administrator, then choose your own password."}</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">Work email<Input aria-label="Work email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 h-11" /></label>
          {mode === "activate" && <label className="block text-sm">Activation code<Input aria-label="Activation code" autoComplete="off" required value={code} onChange={e => setCode(e.target.value)} className="mt-1 h-11 font-mono" /><span className="block text-xs text-muted-foreground mt-2">Enter the separate one-time code, not your email address. Codes expire after 24 hours and work only once. After activation, use Sign in with your email and the password you chose.</span></label>}
          <label className="block text-sm">{mode === "activate" ? "Choose a password" : "Password"}<Input aria-label="Password" type="password" autoComplete={mode === "activate" ? "new-password" : "current-password"} required minLength={mode === "activate" ? 15 : undefined} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 h-11" /></label>
          {mode === "activate" && <><p className="text-xs text-muted-foreground">Use a unique 15–128 character passphrase. Avoid common passwords and the company name. Password managers are welcome.</p><label className="block text-sm">Confirm password<Input aria-label="Confirm password" type="password" autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 h-11" /></label></>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button className="w-full min-h-11" type="submit" disabled={busy}><LockKeyhole className="h-4 w-4" />{busy ? "Checking…" : mode === "activate" ? "Activate and sign in" : "Sign in"}</Button>
        </form>
        <Button variant="ghost" className="w-full mt-3" onClick={() => { setMode(mode === "login" ? "activate" : "login"); setError(""); setPassword(""); setConfirmation(""); }}>{mode === "login" ? "I have an activation code" : "Back to sign in"}</Button>
      </section>
      <p className="text-xs text-muted-foreground mt-5 leading-relaxed">Forgot your password? Ask an owner or administrator for a new one-time code. For this embedded preview, refreshing or closing the page requires signing in again. Sessions end after 30 minutes without authenticated activity or 8 hours total.</p>
    </div>
  </main>;
}
