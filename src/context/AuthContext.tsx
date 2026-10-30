import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import type { AuthUser, Role } from "@/types";

interface AuthState {
  user: AuthUser | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string, fullName?: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function loadUser(session: Session | null): Promise<AuthUser | null> {
  if (!session?.user) return null;
  const u = session.user;
  // Read role directly from user_roles (RLS "Users can view own roles") — no SECURITY DEFINER RPC needed.
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", u.id),
    supabase
      .from("profiles")
      .select("full_name, department, email, operator_id, status")
      .eq("id", u.id)
      .maybeSingle(),
  ]);
  const priority: Record<string, number> = {
    Administrator: 1, Supervisor: 2, "Security Officer": 3, Operator: 4, Auditor: 5, Viewer: 6,
  };
  const role = (((roleRows ?? []).map((r) => r.role as Role).sort(
    (a, b) => (priority[a] ?? 99) - (priority[b] ?? 99),
  )[0]) ?? "Viewer") as Role;
  const name =
    profile?.full_name ||
    (u.user_metadata as { full_name?: string; name?: string } | null)?.full_name ||
    (u.user_metadata as { name?: string } | null)?.name ||
    (u.email?.split("@")[0] ?? "Operator");
  return {
    id: u.id,
    name,
    email: profile?.email || u.email || "",
    role,
    department: profile?.department || (role === "Administrator" ? "IT & Security" : "Security Operations"),
    operatorId: profile?.operator_id ?? null,
    status: profile?.status ?? "Active",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe FIRST, then read current session
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer Supabase calls out of the listener
      setTimeout(() => {
        loadUser(s).then(setUser);
      }, 0);
    });

    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      setUser(await loadUser(data.session));
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithPassword = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });
    return { error: error?.message ?? null };
  };

  const signInWithGoogle = async () => {
    const { lovable } = await import("@/integrations/lovable");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return { error: result.error.message || "Google sign-in failed" };
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const hasRole = (...roles: Role[]) => !!user && roles.includes(user.role);

  const refreshRole = async () => {
    setUser(await loadUser(session));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
        loading,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        signOut,
        hasRole,
        refreshRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
