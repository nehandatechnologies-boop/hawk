import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side audit log writer. Uses the service-role client so the client
 * cannot forge actor identity or bypass authentication. The actor id/email
 * are taken from the verified session, not from client input.
 */
export const writeAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { action: string; module: string; recordId?: string }) => {
    const action = String(data?.action ?? "").slice(0, 64);
    const mod = String(data?.module ?? "").slice(0, 64);
    const recordId = String(data?.recordId ?? "").slice(0, 128);
    if (!action || !mod) throw new Error("action and module are required");
    return { action, module: mod, recordId };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId, claims } = context as { userId: string; claims: { email?: string } };
    const email = claims?.email ?? "";
    await supabaseAdmin.from("audit_logs").insert({
      actor_email: email,
      actor_id: userId,
      action: data.action,
      module: data.module,
      record_id: data.recordId,
      ip_address: "",
    } as never);
    return { ok: true as const };
  });
