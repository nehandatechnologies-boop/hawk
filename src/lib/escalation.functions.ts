import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Auto-escalation dispatcher. Called immediately after a Critical/High
 * alert is raised. Requires an authenticated operational staff session,
 * then loads the alert with service role, posts a redacted payload to the
 * configured WATCHLIST_WEBHOOK_URL, and logs the attempt in `escalations`.
 * Failures never propagate to the client — escalation is best-effort and audited.
 */
export const dispatchEscalation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { alertId: string }) => {
    const alertId = String(d?.alertId ?? "");
    if (!/^[0-9a-fA-F-]{36}$/.test(alertId)) throw new Error("invalid_alert_id");
    return { alertId };
  })
  .handler(async ({ data, context }) => {
    // Only operational staff may trigger outbound escalations.
    const roles = ["Administrator", "Supervisor", "Security Officer", "Operator"] as const;
    let allowed = false;
    for (const role of roles) {
      const { data: ok } = await context.supabase.rpc("has_role", {
        _user_id: context.userId,
        _role: role,
      });
      if (ok) { allowed = true; break; }
    }
    if (!allowed) return { ok: false as const, error: "forbidden" };


    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: alert } = await supabaseAdmin
      .from("alerts")
      .select("id, title, priority, status, source, camera_id, subject_id, subject_category, match_confidence, latitude, longitude, description, created_at")
      .eq("id", data.alertId)
      .maybeSingle();
    if (!alert) return { ok: false as const, error: "not_found" };

    const webhookUrl = process.env.WATCHLIST_WEBHOOK_URL;
    if (!webhookUrl) {
      // Log the missed dispatch so admins can see coverage gaps.
      await supabaseAdmin.from("escalations").insert({
        alert_id: alert.id,
        subject_id: alert.subject_id,
        channel: "webhook",
        target: "unconfigured",
        status: "failed",
        response_excerpt: "WATCHLIST_WEBHOOK_URL not configured",
        payload: alert as any,
      });
      return { ok: false as const, error: "no_webhook" };
    }

    const payload = {
      event: "hawktrace.sighting",
      alert_id: alert.id,
      priority: alert.priority,
      subject_category: alert.subject_category,
      subject_id: alert.subject_id,
      confidence: alert.match_confidence,
      camera_id: alert.camera_id,
      location: { latitude: alert.latitude, longitude: alert.longitude },
      source: alert.source,
      title: alert.title,
      description: alert.description,
      detected_at: alert.created_at,
    };

    const targetLabel = (() => {
      try { const u = new URL(webhookUrl); return `${u.protocol}//${u.host}`; }
      catch { return "webhook"; }
    })();

    let httpStatus: number | null = null;
    let excerpt = "";
    let status: "dispatched" | "failed" = "failed";
    try {
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json", "x-hawktrace-event": "sighting" },
        body: JSON.stringify(payload),
      });
      httpStatus = res.status;
      const text = await res.text().catch(() => "");
      excerpt = text.slice(0, 300);
      status = res.ok ? "dispatched" : "failed";
    } catch (e: any) {
      excerpt = String(e?.message ?? e).slice(0, 300);
    }

    await supabaseAdmin.from("escalations").insert({
      alert_id: alert.id,
      subject_id: alert.subject_id,
      channel: "webhook",
      target: targetLabel,
      status,
      http_status: httpStatus,
      response_excerpt: excerpt,
      payload: payload as any,
    });

    return { ok: status === "dispatched", httpStatus };
  });
