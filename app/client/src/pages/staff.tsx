import { useState } from "react";
import { AssignedWorkScope } from "@/components/assigned-work-scope";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { authState } from "@/lib/auth-state";
import { useAuth } from "@/components/auth-provider";
import { ROLES, type Role } from "@shared/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Users, History, KeyRound } from "lucide-react";
const selectClass = "w-full h-11 rounded-md border bg-background px-3 text-sm";
export default function StaffAccess() {
  const { user, can } = useAuth();
  const [tab, setTab] = useState(can("staff.manage") ? "staff" : "audit");
  const [draft, setDraft] = useState({
    fullName: "",
    email: "",
    role: "technician",
    technicianId: "",
  });
  const [editing, setEditing] = useState<any>(null),
    [reason, setReason] = useState("");
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const [filter, setFilter] = useState({
      actor: "",
      entity: "",
      event: "",
      from: "",
      to: "",
    }),
    [offset, setOffset] = useState(0);
  const staff = useQuery<any[]>({
    queryKey: ["/api/staff"],
    enabled: can("staff.manage"),
  });
  const techs = useQuery<any[]>({
    queryKey: ["/api/technicians"],
    enabled: can("staff.manage"),
  });
  const audit = useQuery<any>({
    queryKey: ["/api/staff/audit", filter, offset],
    queryFn: () =>
      apiRequest(
        "GET",
        `/api/staff/audit?${new URLSearchParams({ ...filter, offset: String(offset) })}`,
      ),
    enabled: can("audit.read") && tab === "audit",
  });
  const roles = Object.entries(ROLES).filter(
    ([r]) => r !== "owner" || user.role === "owner",
  );
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await staff.refetch();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const roleSelect = (value: string, change: (r: string) => void) => (
    <select
      aria-label={editing ? "Edit role" : "New staff role"}
      className={selectClass}
      value={value}
      onChange={(e) => change(e.target.value)}
    >
      {roles.map(([r, d]) => (
        <option key={r} value={r}>
          {d.label}
        </option>
      ))}
    </select>
  );
  const techSelect = (value: string, change: (r: string) => void) => (
    <select
      aria-label="Linked technician"
      className={selectClass}
      value={value}
      onChange={(e) => change(e.target.value)}
    >
      <option value="">Choose technician profile</option>
      {(techs.data || [])
        .filter((t) => t.status === "active")
        .map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
    </select>
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Staff access & audit
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Named accounts, role-based permissions and a traceable record of
          changes.
        </p>
      </div>
      <div className="flex gap-2">
        {can("staff.manage") && (
          <Button
            variant={tab === "staff" ? "default" : "outline"}
            onClick={() => setTab("staff")}
          >
            <Users className="h-4 w-4" />
            Staff accounts
          </Button>
        )}
        {can("audit.read") && (
          <Button
            variant={tab === "audit" ? "default" : "outline"}
            onClick={() => setTab("audit")}
          >
            <History className="h-4 w-4" />
            Audit history
          </Button>
        )}
        <Button
          variant={tab === "roles" ? "default" : "outline"}
          onClick={() => setTab("roles")}
        >
          Role guide
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {invitation && (
        <Card className="border-primary">
          <CardContent className="pt-5 space-y-3">
            <h2 className="font-semibold">One-time activation code</h2>
            <p className="text-sm">
              For {invitation.email}. Expires{" "}
              {new Date(invitation.expiresAt).toLocaleString()}. Send it
              securely to this employee; it is shown only now and is not emailed
              automatically.
            </p>
            <Input
              aria-label="Generated activation code"
              value={invitation.activationCode}
              readOnly
              onFocus={(e) => e.target.select()}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              The employee opens RepairPro, selects “I have an activation code,”
              and sets their own password. Reissuing a code invalidates the
              previous code and all sessions.
            </p>
            <Button variant="outline" onClick={() => setInvitation(null)}>
              I have saved the code securely
            </Button>
          </CardContent>
        </Card>
      )}
      {tab === "roles" && (
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(ROLES).map(([r, d]) => (
            <Card key={r}>
              <CardContent className="pt-4">
                <h2 className="font-semibold">{d.label}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {d.description}
                </p>
                <details className="text-xs mt-3">
                  <summary className="cursor-pointer">
                    Exact permissions
                  </summary>
                  <p className="mt-2 leading-6">{d.permissions.join(" · ")}</p>
                </details>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {tab === "staff" && can("staff.manage") && (
        <>
          <Card>
            <CardContent className="pt-5">
              <h2 className="font-semibold mb-3">Invite a staff member</h2>
              <form
                className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(async () => {
                    const r = await apiRequest("POST", "/api/staff", {
                      ...draft,
                      technicianId:
                        draft.role === "technician"
                          ? Number(draft.technicianId)
                          : null,
                    });
                    setInvitation({ ...r, email: draft.email });
                    setDraft({
                      fullName: "",
                      email: "",
                      role: "technician",
                      technicianId: "",
                    });
                  });
                }}
              >
                <label className="text-sm">
                  Full name
                  <Input
                    aria-label="Staff full name"
                    required
                    maxLength={100}
                    value={draft.fullName}
                    onChange={(e) =>
                      setDraft({ ...draft, fullName: e.target.value })
                    }
                    className="h-11 mt-1"
                  />
                </label>
                <label className="text-sm">
                  Email
                  <Input
                    aria-label="Staff email"
                    type="email"
                    required
                    value={draft.email}
                    onChange={(e) =>
                      setDraft({ ...draft, email: e.target.value })
                    }
                    className="h-11 mt-1"
                  />
                </label>
                <label className="text-sm">
                  Role
                  {roleSelect(draft.role, (role) =>
                    setDraft({ ...draft, role }),
                  )}
                </label>
                {draft.role === "technician" && (
                  <label className="text-sm">
                    Assigned technician profile
                    {techSelect(draft.technicianId, (technicianId) =>
                      setDraft({ ...draft, technicianId }),
                    )}
                  </label>
                )}
                <Button
                  type="submit"
                  disabled={busy}
                  className="sm:col-span-2 xl:col-span-4 min-h-11"
                >
                  Create invitation
                </Button>
              </form>
              <p className="text-xs text-muted-foreground mt-3">
                Each employee needs a unique email. Technician accounts must
                link to a technician profile. Account creation does not send
                email or reveal anyone's password.
              </p>
            </CardContent>
          </Card>
          {editing && (
            <Card>
              <CardContent className="pt-5 space-y-3">
                <h2 className="font-semibold">Manage {editing.fullName}</h2>
                <div className="grid sm:grid-cols-3 gap-3">
                  <label className="text-sm">
                    Role
                    {roleSelect(editing.role, (role) =>
                      setEditing({ ...editing, role }),
                    )}
                  </label>
                  <label className="text-sm">
                    Status
                    <select
                      aria-label="Staff status"
                      className={selectClass}
                      value={editing.status}
                      onChange={(e) =>
                        setEditing({ ...editing, status: e.target.value })
                      }
                    >
                      {editing.status === "invited" && (
                        <option value="invited">Awaiting activation</option>
                      )}
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </label>
                  {editing.role === "technician" && (
                    <label className="text-sm">
                      Technician profile
                      {techSelect(
                        String(editing.technicianId || ""),
                        (technicianId) =>
                          setEditing({
                            ...editing,
                            technicianId: Number(technicianId),
                          }),
                      )}
                    </label>
                  )}
                </div>
                <label className="block text-sm">
                  Reason for access change / reset
                  <Input
                    aria-label="Access change reason"
                    maxLength={250}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="mt-1"
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  Saving access changes immediately signs this employee out on
                  all devices and invalidates outstanding invitation codes. The
                  last active owner is protected.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      action(async () => {
                        await apiRequest("PATCH", `/api/staff/${editing.id}`, {
                          role: editing.role,
                          status: editing.status,
                          technicianId: editing.technicianId,
                          version: editing.version,
                          reason,
                        });
                        setEditing(null);
                        setNotice(
                          "Access updated. All of this employee's sessions were revoked.",
                        );
                      })
                    }
                  >
                    Save access and revoke sessions
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      action(async () => {
                        const r = await apiRequest(
                          "POST",
                          `/api/staff/${editing.id}/invitation`,
                          { reason },
                        );
                        setInvitation({ ...r, email: editing.email });
                        setEditing(null);
                      })
                    }
                  >
                    Reset / new invitation
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      action(async () => {
                        await apiRequest(
                          "POST",
                          `/api/staff/${editing.id}/revoke-sessions`,
                          { reason },
                        );
                        setEditing(null);
                        setNotice("All sessions revoked.");
                      })
                    }
                  >
                    Sign out all devices
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="border rounded-md overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {[
                    "Staff member",
                    "Role",
                    "Status",
                    "Last sign-in",
                    "Sessions",
                    "Access",
                  ].map((h) => (
                    <th key={h} className="text-left p-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(staff.data || []).map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">
                      <p className="font-medium">
                        {u.fullName}
                        {u.id === user.id ? " (you)" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {ROLES[u.role as Role].label}
                    </td>
                    <td className="p-3">{u.status}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString()
                        : "Not yet"}
                    </td>
                    <td className="p-3">{u.activeSessions}</td>
                    <td className="p-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={u.role === "owner" && user.role !== "owner"}
                        onClick={() => {
                          setEditing(u);
                          setReason("");
                        }}
                      >
                        Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {staff.isError && (
            <p className="text-destructive">
              Staff accounts could not be loaded.
            </p>
          )}
        </>
      )}
      {tab === "audit" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Business changes record before/after values in the same database
            transaction. Login, access and security events start from this
            feature's installation; earlier history is not invented. Audit dates
            below are UTC.
          </p>
          <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {(["actor", "entity", "event", "from", "to"] as const).map((k) => (
              <label key={k} className="text-xs capitalize">
                {k === "actor" ? "Staff ID" : k}
                <Input
                  aria-label={`Audit ${k}`}
                  type={k === "from" || k === "to" ? "date" : "text"}
                  value={filter[k]}
                  placeholder={
                    k === "entity"
                      ? "customers, jobs…"
                      : k === "event"
                        ? "login.succeeded"
                        : ""
                  }
                  onChange={(e) => {
                    setFilter({ ...filter, [k]: e.target.value });
                    setOffset(0);
                  }}
                />
              </label>
            ))}
          </div>
          <Button variant="outline" onClick={() => audit.refetch()}>
            Refresh audit
          </Button>
          {audit.isError && (
            <p role="alert" className="text-destructive text-sm">
              Audit history could not be loaded.
            </p>
          )}
          <div className="space-y-2">
            {(audit.data?.events || []).map((ev: any) => (
              <details key={ev.id} className="border rounded-md p-3 text-sm">
                <summary className="cursor-pointer break-words">
                  <span className="font-medium">{ev.actor_label}</span> ·{" "}
                  {ev.event} · {ev.entity} {ev.record_id}
                  <span className="block text-xs text-muted-foreground mt-1">
                    {new Date(ev.occurred_at).toLocaleString()} · Staff ID{" "}
                    {ev.actor_id ?? "system"} · Event #{ev.id}
                  </span>
                </summary>
                <div className="grid lg:grid-cols-2 gap-3 mt-3">
                  {["before_json", "after_json"].map((k) => (
                    <div key={k}>
                      <h3 className="text-xs font-semibold mb-1">
                        {k === "before_json"
                          ? "Before"
                          : "After / event details"}
                      </h3>
                      <pre className="text-xs whitespace-pre-wrap break-all bg-muted/50 p-3 rounded">
                        {ev[k]
                          ? JSON.stringify(JSON.parse(ev[k]), null, 2)
                          : "Not applicable"}
                      </pre>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-2 text-muted-foreground">
                  Request {ev.request_id}
                </p>
              </details>
            ))}
          </div>
          {audit.data?.events.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No matching audit events.
            </p>
          )}
          <div className="flex justify-end items-center gap-3">
            <Button
              variant="outline"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, offset - 50))}
            >
              Previous
            </Button>
            <span className="text-xs">
              {audit.data?.total || 0} events · Page{" "}
              {Math.floor(offset / 50) + 1}
            </span>
            <Button
              variant="outline"
              disabled={offset + 50 >= (audit.data?.total || 0)}
              onClick={() => setOffset(offset + 50)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
export function MyAccount() {
  const { user } = useAuth();
  const [currentPassword, setCurrent] = useState(""),
    [newPassword, setNew] = useState(""),
    [confirm, setConfirm] = useState(""),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const sessions = useQuery<any[]>({ queryKey: ["/api/auth/sessions"] });
  return (
    <div className="space-y-5 max-w-3xl">
      <h1 className="text-xl font-bold">My account</h1>
      <p className="text-sm">
        {user.fullName} · {user.email} · {ROLES[user.role].label}
      </p>
      <Card>
        <CardContent className="pt-5">
          <h2 className="font-semibold flex gap-2 items-center">
            <KeyRound className="h-4 w-4" />
            Change password
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            A password change signs you out everywhere, including here. Use a
            unique 15–128 character passphrase.
          </p>
          <form
            className="space-y-3 mt-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              if (newPassword !== confirm) {
                setError("The passwords do not match.");
                return;
              }
              setBusy(true);
              try {
                await apiRequest("POST", "/api/auth/change-password", {
                  currentPassword,
                  newPassword,
                });
                await queryClient.cancelQueries();
                queryClient.clear();
                authState.set(null);
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-sm">
              Current password
              <Input
                aria-label="Current password"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              New password
              <Input
                aria-label="New password"
                type="password"
                autoComplete="new-password"
                minLength={15}
                maxLength={128}
                required
                value={newPassword}
                onChange={(e) => setNew(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Confirm new password
              <Input
                aria-label="Confirm new password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <Button disabled={busy}>Change password and sign out</Button>
          </form>
          {error && (
            <p role="alert" className="text-sm text-destructive mt-3">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-5 space-y-3">
          <h2 className="font-semibold">Active sessions</h2>
          {(sessions.data || []).map((s) => (
            <div key={s.id} className="border-b pb-3 text-xs">
              <p className="font-medium text-sm">
                {s.current ? "This session" : "Another session"}
              </p>
              <p className="break-all text-muted-foreground">{s.user_agent}</p>
              <p>Last activity: {new Date(s.last_seen).toLocaleString()}</p>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await apiRequest("POST", "/api/auth/revoke-others", {});
                await sessions.refetch();
                setMessage("Other sessions signed out.");
              } catch (e: any) {
                setError(e.message);
              }
            }}
          >
            Sign out other sessions
          </Button>
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
export function MyWork() {
  const { can } = useAuth(),
    [error, setError] = useState(""),
    [note, setNote] = useState<Record<number, string>>({}),
    [busy, setBusy] = useState(false);
  const work = useQuery<any[]>({
    queryKey: ["/api/my-work"],
    enabled: can("mywork"),
  });
  async function update(id: number, action: string, body: any) {
    setBusy(true);
    setError("");
    try {
      await apiRequest("POST", `/api/my-work/${id}/${action}`, body);
      await work.refetch();
      await queryClient.invalidateQueries({ queryKey: ["/api/my-work", id, "scope"] });
      setNote((n) => ({ ...n, [id]: "" }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!can("mywork"))
    return (
      <div>
        <h1 className="text-xl font-bold">Your workspace</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Choose an authorized area from the navigation. Your role does not
          include the financial dashboard.
        </p>
      </div>
    );
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My assigned work</h1>
      <p className="text-sm text-muted-foreground">
        Only work assigned to your linked technician profile appears here. You
        can start/complete work and record repair notes.
      </p>
      {(error || work.isError) && (
        <p role="alert" className="text-destructive text-sm">
          {error || "Assigned work could not be loaded."}
        </p>
      )}
      {(work.data || []).map((j) => (
        <Card key={j.id}>
          <CardContent className="pt-4 space-y-3">
            <div>
              <span className="text-xs text-muted-foreground">
                {j.jobNumber} · {j.status}
              </span>
              <h2 className="font-semibold">{j.title}</h2>
              <p className="text-sm">
                {j.companyName || `${j.firstName || ""} ${j.lastName || ""}`} ·{" "}
              {[j.year, j.make, j.model].filter(Boolean).join(" ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Scheduled: {j.scheduledDate || "Not scheduled"}
                {j.vin ? ` · VIN ${j.vin}` : ""}
              </p>
            </div>
            <AssignedWorkScope id={j.id} />
            <div className="flex flex-wrap gap-2">
              {["pending", "scheduled"].includes(j.status) && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    update(j.id, "status", { status: "in_progress" })
                  }
                >
                  Start work
                </Button>
              )}
              {j.status === "in_progress" && (
                <Button
                  disabled={busy}
                  onClick={() =>
                    update(j.id, "status", { status: "completed" })
                  }
                >
                  Mark completed
                </Button>
              )}
            </div>
            <label className="block text-sm">
              Repair note
              <Input
                aria-label={`Repair note ${j.jobNumber}`}
                maxLength={2000}
                value={note[j.id] || ""}
                onChange={(e) => setNote({ ...note, [j.id]: e.target.value })}
              />
            </label>
            <Button
              variant="outline"
              disabled={busy || !note[j.id]?.trim()}
              onClick={() => update(j.id, "notes", { note: note[j.id] })}
            >
              Save repair note
            </Button>
          </CardContent>
        </Card>
      ))}
      {work.data?.length === 0 && (
        <p className="border rounded-md p-6 text-sm text-muted-foreground">
          No work is assigned to you yet. Ask your dispatcher to assign a work
          order.
        </p>
      )}
    </div>
  );
}
