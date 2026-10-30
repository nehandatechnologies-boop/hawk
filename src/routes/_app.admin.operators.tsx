import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, KeyRound, Power, Copy, Loader2 } from "lucide-react";
import { PageHeader, Panel, LoadingSkeleton, StatusPill } from "@/components/common/Primitives";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createOperator, updateOperator } from "@/lib/operators.functions";
import type { Role } from "@/types";

const ROLES: Role[] = ["Administrator", "Supervisor", "Security Officer", "Operator", "Auditor", "Viewer"];

interface OperatorRow {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  operator_id: string | null;
  status: string;
  issued_at: string | null;
  created_at: string;
  role: Role | null;
}

async function fetchOperators(): Promise<OperatorRow[]> {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, department, operator_id, status, issued_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const ids = (profiles ?? []).map((p) => p.id);
  let roleMap: Record<string, Role> = {};
  if (ids.length) {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);
    roleMap = Object.fromEntries((roles ?? []).map((r) => [r.user_id, r.role as Role]));
  }
  return (profiles ?? []).map((p) => ({ ...p, role: roleMap[p.id] ?? null }));
}

function generateOperatorId(role: Role): string {
  const prefix = role === "Administrator" ? "ADM" : role === "Supervisor" ? "SUP" : role === "Auditor" ? "AUD" : "OP";
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${n}`;
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz!@#";
  return Array.from({ length: 14 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function OperatorsPage() {
  const { hasRole } = useAuth();
  if (!hasRole("Administrator")) return <Navigate to="/dashboard" />;

  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["operators"], queryFn: fetchOperators });

  const createFn = useServerFn(createOperator);
  const updateFn = useServerFn(updateOperator);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    department: "Security Operations",
    role: "Operator" as Role,
    operatorId: generateOperatorId("Operator"),
    password: generatePassword(),
  });
  const [credsToShare, setCredsToShare] = useState<null | { operatorId: string; email: string; password: string }>(null);

  const create = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: () => {
      toast.success(`Issued ${form.operatorId} to ${form.fullName}`);
      setCredsToShare({ operatorId: form.operatorId, email: form.email, password: form.password });
      qc.invalidateQueries({ queryKey: ["operators"] });
      setForm((f) => ({
        ...f,
        fullName: "",
        email: "",
        operatorId: generateOperatorId(f.role),
        password: generatePassword(),
      }));
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to create operator"),
  });

  const update = useMutation({
    mutationFn: (vars: { userId: string; status?: "Active" | "Suspended"; role?: Role }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["operators"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const copy = (s: string) => {
    navigator.clipboard.writeText(s).then(() => toast.success("Copied"));
  };

  return (
    <>
      <PageHeader
        title="Operator Enrollment"
        description="Administrator-only console for issuing Operator IDs and credentials. All accounts must be enrolled here — public sign-ups are non-privileged Viewers."
      />

      <Panel title="Issue new operator credentials" className="mb-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm block">
            <span className="mb-1 block text-muted-foreground">Full name</span>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full rounded-md border border-input bg-card px-3 py-2" />
          </label>
          <label className="text-sm block">
            <span className="mb-1 block text-muted-foreground">Recovery email</span>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-md border border-input bg-card px-3 py-2" />
          </label>
          <label className="text-sm block">
            <span className="mb-1 block text-muted-foreground">Department / Unit</span>
            <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="w-full rounded-md border border-input bg-card px-3 py-2" />
          </label>
          <label className="text-sm block">
            <span className="mb-1 block text-muted-foreground">Role</span>
            <select value={form.role}
              onChange={(e) => {
                const role = e.target.value as Role;
                setForm({ ...form, role, operatorId: generateOperatorId(role) });
              }}
              className="w-full rounded-md border border-input bg-card px-3 py-2">
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="text-sm block">
            <span className="mb-1 block text-muted-foreground">Operator ID</span>
            <div className="flex gap-1">
              <input value={form.operatorId} onChange={(e) => setForm({ ...form, operatorId: e.target.value.toUpperCase() })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono" />
              <button type="button" onClick={() => setForm({ ...form, operatorId: generateOperatorId(form.role) })}
                className="rounded-md border border-border bg-card px-2 text-xs hover:bg-accent">↻</button>
            </div>
          </label>
          <label className="text-sm block">
            <span className="mb-1 block text-muted-foreground">Temporary password</span>
            <div className="flex gap-1">
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-xs" />
              <button type="button" onClick={() => setForm({ ...form, password: generatePassword() })}
                className="rounded-md border border-border bg-card px-2 text-xs hover:bg-accent">↻</button>
            </div>
          </label>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            The operator signs in with their <strong className="text-foreground">Operator ID</strong> (or email) plus the temporary password.
            Share credentials over a secure channel. They should change the password after first login.
          </p>
          <button
            onClick={() => create.mutate()}
            disabled={!form.fullName || !form.email || !form.operatorId || !form.password || create.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Issue credentials
          </button>
        </div>
      </Panel>

      {credsToShare && (
        <Panel title="Share these credentials securely" className="mb-4 border-primary/50">
          <div className="grid gap-2 sm:grid-cols-3 text-sm">
            {[
              { k: "Operator ID", v: credsToShare.operatorId },
              { k: "Email", v: credsToShare.email },
              { k: "Temp password", v: credsToShare.password },
            ].map((row) => (
              <div key={row.k} className="rounded-md border border-border bg-card px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{row.k}</div>
                <div className="flex items-center justify-between gap-2 font-mono text-sm">
                  <span className="truncate">{row.v}</span>
                  <button onClick={() => copy(row.v)} className="text-muted-foreground hover:text-foreground"><Copy className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-right">
            <button onClick={() => setCredsToShare(null)} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        </Panel>
      )}

      <Panel title="Enrolled operators">
        {isLoading ? <LoadingSkeleton rows={6} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3">Operator ID</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Issued</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono">{u.operator_id ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2 pr-3">{u.full_name ?? "—"}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{u.email}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={u.role ?? "Viewer"}
                        onChange={(e) => update.mutate({ userId: u.id, role: e.target.value as Role })}
                        className="rounded-md border border-input bg-card px-2 py-1 text-xs"
                      >
                        {ROLES.map((r) => <option key={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3"><StatusPill status={u.status} /></td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground font-mono">{u.issued_at ? new Date(u.issued_at).toLocaleDateString() : "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        onClick={() => update.mutate({ userId: u.id, status: u.status === "Active" ? "Suspended" : "Active" })}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Power className="h-3 w-3" />
                        {u.status === "Active" ? "Suspend" : "Reinstate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">No operators yet. Issue the first one above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div>
          You are the primary Administrator. Promote another user to <strong className="text-foreground">Administrator</strong>
          here to create additional admins. Suspended accounts cannot sign in via Operator ID until reinstated.
        </div>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_app/admin/operators")({ component: OperatorsPage });
