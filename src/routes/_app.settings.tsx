import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/common/Primitives";
import { toast } from "sonner";
import { useState } from "react";

function Page() {
  const [org, setOrg] = useState({ name: "NEHANDA Systems", contact: "operations@nehanda.systems", apiBaseUrl: "/api" });
  const [policy, setPolicy] = useState({ minLength: 12, requireSymbols: true, sessionTimeoutMin: 30, mfa: true });
  const [notif, setNotif] = useState({ emailAlerts: true, smsCritical: false, dailyDigest: true });

  const save = () => toast.success("Settings saved");

  return (
    <>
      <PageHeader title="Settings" description="Organization-wide configuration. Administrator access only." />
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Organization Profile">
          <div className="grid gap-3">
            <Field label="Organization Name" value={org.name} onChange={(v) => setOrg({ ...org, name: v })} />
            <Field label="Operations Contact" value={org.contact} onChange={(v) => setOrg({ ...org, contact: v })} />
            <Field label="API Base URL (FastAPI endpoint)" value={org.apiBaseUrl} onChange={(v) => setOrg({ ...org, apiBaseUrl: v })} hint="Override at runtime via VITE_API_BASE_URL." />
          </div>
        </Panel>

        <Panel title="Password & Session Policy">
          <div className="grid gap-3">
            <Field label="Minimum Length" type="number" value={String(policy.minLength)} onChange={(v) => setPolicy({ ...policy, minLength: +v })} />
            <Toggle label="Require Symbols" checked={policy.requireSymbols} onChange={(v) => setPolicy({ ...policy, requireSymbols: v })} />
            <Field label="Session Timeout (minutes)" type="number" value={String(policy.sessionTimeoutMin)} onChange={(v) => setPolicy({ ...policy, sessionTimeoutMin: +v })} />
            <Toggle label="Enforce Multi-Factor Authentication" checked={policy.mfa} onChange={(v) => setPolicy({ ...policy, mfa: v })} />
          </div>
        </Panel>

        <Panel title="Notifications">
          <div className="grid gap-3">
            <Toggle label="Email alerts" checked={notif.emailAlerts} onChange={(v) => setNotif({ ...notif, emailAlerts: v })} />
            <Toggle label="SMS for Critical priority" checked={notif.smsCritical} onChange={(v) => setNotif({ ...notif, smsCritical: v })} />
            <Toggle label="Daily digest" checked={notif.dailyDigest} onChange={(v) => setNotif({ ...notif, dailyDigest: v })} />
          </div>
        </Panel>

        <Panel title="Backups & Theme">
          <div className="grid gap-3">
            <Field label="Backup Window (cron)" value="0 2 * * *" onChange={() => {}} />
            <Field label="Retention (days)" type="number" value="90" onChange={() => {}} />
            <Field label="Theme" value="HAWKTRACE Dark (Default)" onChange={() => {}} />
          </div>
        </Panel>
      </div>
      <div className="mt-6 flex justify-end">
        <button onClick={save} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save changes</button>
      </div>
    </>
  );
}

function Field({ label, value, onChange, type = "text", hint }: { label: string; value: string; onChange: (v: string) => void; type?: string; hint?: string }) {
  return (
    <label className="text-sm block">
      <span className="mb-1 block text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between text-sm cursor-pointer">
      <span>{label}</span>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-card transition-transform ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

export const Route = createFileRoute("/_app/settings")({ component: Page });
