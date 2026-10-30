import { createServerFn } from "@tanstack/react-start";

/**
 * Operator sign-in. Accepts an Operator ID + password and performs the
 * password sign-in server-side using the service-role client, so the
 * operator's email address is never exposed over the network. Returns
 * only session tokens (or a generic error) — no email enumeration.
 */
export const operatorSignIn = createServerFn({ method: "POST" })
  .inputValidator((data: { operatorId: string; password: string }) => {
    const operatorId = String(data?.operatorId ?? "").trim().toUpperCase();
    const password = String(data?.password ?? "");
    if (!/^[A-Z0-9-]{3,32}$/.test(operatorId)) {
      throw new Error("invalid_operator_id");
    }
    if (password.length < 6 || password.length > 128) {
      throw new Error("invalid_credentials");
    }
    return { operatorId, password };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, status")
      .eq("operator_id", data.operatorId)
      .maybeSingle();

    if (!profile?.email || profile.status !== "Active") {
      // Generic error — do not reveal whether the ID exists.
      return { ok: false as const, error: "invalid_credentials" };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const authClient = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, storage: undefined } },
    );
    const { data: signIn, error } = await authClient.auth.signInWithPassword({
      email: profile.email,
      password: data.password,
    });
    if (error || !signIn.session) {
      return { ok: false as const, error: "invalid_credentials" };
    }
    return {
      ok: true as const,
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    };
  });
