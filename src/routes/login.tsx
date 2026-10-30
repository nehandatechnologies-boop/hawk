import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert, Loader2, IdCard, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { operatorSignIn } from "@/lib/operator-signin.functions";

function LoginPage() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [operatorId, setOperatorId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate({ to: (search.redirect as string) || "/dashboard" });
    }
  }, [loading, isAuthenticated, navigate, search.redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const opId = operatorId.trim().toUpperCase();
    if (!opId || !password) { setErr("Operator ID and password are required."); return; }
    if (opId.includes("@")) { setErr("Enter your Operator ID, not an email. Administrators sign in on a different page."); return; }
    if (!/^[A-Z0-9-]{3,32}$/.test(opId)) { setErr("Operator IDs look like OP-1234."); return; }
    setBusy(true);
    try {
      const result = await operatorSignIn({ data: { operatorId: opId, password } }).catch(() => null);
      if (!result || !result.ok) {
        setErr("Invalid credentials. Contact your administrator if the issue persists.");
        return;
      }
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) { setErr("Sign-in failed. Please try again."); return; }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-sidebar border-r border-sidebar-border overflow-hidden">
        <div className="absolute inset-0 opacity-30 pointer-events-none"
             style={{ background: "radial-gradient(ellipse at top, color-mix(in oklab, var(--color-primary) 25%, transparent), transparent 60%)" }} />
        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-semibold tracking-wide">HAWKTRACE</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Operator Console · NEHANDA Systems</div>
          </div>
        </div>
        <div className="relative">
          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl font-semibold leading-tight">
            Eyes on every perimeter.<br />
            <span className="text-primary">Sign in as an operator.</span>
          </motion.h2>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            CCTV facial-recognition tracking of wanted, missing and surveillance subjects.
            Only administrator-issued Operator IDs can access this console.
          </p>
        </div>
        <div className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} NEHANDA Systems · Brian Levy Madhobhi
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <motion.form
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          onSubmit={onSubmit}
          className="w-full max-w-sm space-y-5"
        >
          <div className="lg:hidden flex items-center gap-2">
            <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="font-display font-semibold">HAWKTRACE</div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              <IdCard className="h-3 w-3" /> Operator sign-in
            </div>
            <h1 className="font-display text-2xl font-semibold">Enter your Operator ID</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Use the ID issued by your administrator. Email sign-in is disabled for operators.
            </p>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block text-muted-foreground flex items-center gap-1.5">
              <IdCard className="h-3.5 w-3.5" /> Operator ID
            </span>
            <input value={operatorId} onChange={(e) => setOperatorId(e.target.value.toUpperCase())} type="text"
              autoComplete="username" required placeholder="OP-1234"
              className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono uppercase focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-muted-foreground">Password</span>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
              autoComplete="current-password" required minLength={6}
              className="w-full rounded-md border border-input bg-card px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
          </label>
          {err && <div className="text-sm text-destructive">{err}</div>}
          <button type="submit" disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>

          <div className="rounded-md border border-border bg-card/60 px-3 py-2 text-[11px] text-muted-foreground">
            Forgot your password? Contact your administrator for a reset.
          </div>

          <div className="pt-2 border-t border-border">
            <Link
              to="/admin/login"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Administrator sign-in →
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground">
            By signing in you accept the HAWKTRACE acceptable-use policy. All activity is logged.
          </p>
        </motion.form>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" && s.redirect ? s.redirect : undefined,
  }),
  component: LoginPage,
});
