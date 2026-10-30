import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, Panel } from "@/components/common/Primitives";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function Page() {
  const { user } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const initials = user.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    if (next !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      // Re-authenticate to verify current password
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: current,
      });
      if (reauthErr) {
        toast.error("Current password is incorrect");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Password updated");
      setCurrent(""); setNext(""); setConfirm("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Profile" description="Your HAWKTRACE operator account." />
      <div className="grid lg:grid-cols-3 gap-4">
        <Panel className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <div className="h-24 w-24 rounded-full bg-primary/20 text-primary grid place-items-center font-display text-3xl font-semibold">{initials}</div>
            <div className="mt-3 font-display text-lg">{user.name}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
            <div className="mt-3 inline-flex items-center rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-medium">{user.role}</div>
          </div>
        </Panel>
        <Panel title="Account details" className="lg:col-span-2">
          <dl className="grid sm:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Department</dt><dd className="mt-1">{user.department}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Role</dt><dd className="mt-1">{user.role}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">User ID</dt><dd className="mt-1 font-mono text-xs">{user.id}</dd></div>
            <div><dt className="text-muted-foreground text-xs uppercase tracking-wider">Session</dt><dd className="mt-1">Active · {new Date().toLocaleString()}</dd></div>
          </dl>
        </Panel>

        <Panel title="Change password" className="lg:col-span-3">
          <p className="text-xs text-muted-foreground mb-3">Rotate your sign-in credential. Requires your current password.</p>
          <form onSubmit={changePassword} className="grid sm:grid-cols-3 gap-3 max-w-3xl">
            <label className="text-sm block">
              <span className="mb-1 block text-muted-foreground">Current password</span>
              <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required
                className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
            </label>
            <label className="text-sm block">
              <span className="mb-1 block text-muted-foreground">New password</span>
              <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
            </label>
            <label className="text-sm block">
              <span className="mb-1 block text-muted-foreground">Confirm new password</span>
              <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
            </label>
            <div className="sm:col-span-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Use at least 8 characters. Mix letters, numbers, and symbols for stronger security.</p>
              <button type="submit" disabled={busy}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {busy ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_app/profile")({ component: Page });
