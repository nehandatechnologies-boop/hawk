import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, Mail, IdCard, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M12 11v3.2h5.3c-.2 1.4-1.7 4.1-5.3 4.1-3.2 0-5.8-2.6-5.8-5.9S8.8 6.5 12 6.5c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 4.1 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.7 8.6-8.8 0-.6-.1-1.1-.2-1.6H12z"/>
    </svg>
  );
}

function AdminLoginPage() {
  const { signInWithPassword, signInWithGoogle, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate({ to: (search.redirect as string) || "/admin/operators" });
    }
  }, [loading, isAuthenticated, navigate, search.redirect]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password) { setErr("Email and password are required."); return; }
    setBusy(true);
    const { error } = await signInWithPassword(email.trim().toLowerCase(), password);
    setBusy(false);
    if (error) setErr("Invalid credentials, or this account has no administrator privileges.");
  };

  const onGoogle = async () => {
    setErr(null); setBusy(true);
    const { error } = await signInWithGoogle();
    if (error) { setErr(error); setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-12 border-r border-border overflow-hidden"
           style={{ background: "linear-gradient(160deg, color-mix(in oklab, var(--color-primary) 18%, var(--color-sidebar)) 0%, var(--color-sidebar) 60%)" }}>
        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground grid place-items-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display font-semibold tracking-wide">HAWKTRACE</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Administrator Console</div>
          </div>
        </div>
        <div className="relative">
          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="font-display text-4xl font-semibold leading-tight">
            Command &amp; control.<br />
            <span className="text-primary">Sign in as administrator.</span>
          </motion.h2>
          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            Enroll operators, issue IDs, manage roles, and oversee the audit trail.
            Administrator access is restricted and every action is logged.
          </p>
          <div className="mt-8 rounded-md border border-border/60 bg-card/40 p-4 text-xs text-muted-foreground max-w-md">
            <div className="flex items-center gap-2 text-foreground font-medium mb-1">
              <Lock className="h-3.5 w-3.5" /> Restricted area
            </div>
            Only accounts with the Administrator role may proceed past sign-in.
            Non-privileged accounts will be denied.
          </div>
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
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="font-display font-semibold">HAWKTRACE · Admin</div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary mb-2">
              <ShieldCheck className="h-3 w-3" /> Administrator sign-in
            </div>
            <h1 className="font-display text-2xl font-semibold">Administrator access</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Use your administrator email &amp; password, or Google (primary admin only).
            </p>
          </div>

          <button type="button" onClick={onGoogle} disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-60">
            <GoogleIcon className="h-4 w-4" />
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-[11px] uppercase tracking-wider"><span className="bg-background px-2 text-muted-foreground">or</span></div>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Administrator email
            </span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username" required
              placeholder="admin@yourorg.gov"
              className="w-full rounded-md border border-input bg-card px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
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
            Sign in as administrator
          </button>

          <div className="pt-2 border-t border-border">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <IdCard className="h-3.5 w-3.5" />
              ← Operator sign-in
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Unauthorized access attempts are logged and reported.
          </p>
        </motion.form>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/admin/login")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" && s.redirect ? s.redirect : undefined,
  }),
  component: AdminLoginPage,
});
