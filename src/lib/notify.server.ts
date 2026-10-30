/**
 * Server-only notification fan-out for HAWKTRACE sightings.
 *
 * Channels:
 *  - Web Push (VAPID) to every registered operator device — works with the
 *    dashboard closed, as long as the browser is running.
 *  - Slack incoming webhook to the 24/7 operations channel.
 *
 * Every attempt is logged in `escalations` so coverage gaps are auditable.
 * Failures are swallowed: notification is best-effort, never blocking.
 */
import { buildPushPayload } from "@block65/webcrypto-web-push";

type Priority = "Critical" | "High" | "Medium" | "Low";

export interface AlertRow {
  id: string;
  title: string | null;
  description: string | null;
  priority: Priority | string | null;
  subject_id: string | null;
  subject_name: string | null;
  subject_category: string | null;
  camera_id: string | null;
  camera_name: string | null;
  location: string | null;
  match_confidence: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
}

export interface PushMessagePayload {
  title: string;
  body: string;
  priority: string;
  alertId?: string | null;
  url?: string;
  tag?: string;
}

function vapid() {
  const publicKey = process.env["VAPID_PUBLIC_KEY"];
  const privateKey = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:ops@hawktrace.local";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function getPushPublicKey(): string | null {
  return process.env["VAPID_PUBLIC_KEY"] ?? null;
}

export function describeAlert(alert: AlertRow) {
  const priority = (alert.priority ?? "Medium") as Priority;
  const who = alert.subject_name?.trim() || alert.title?.trim() || "Unidentified subject";
  const where = alert.camera_name?.trim() || alert.location?.trim() || "unknown location";
  const conf =
    typeof alert.match_confidence === "number"
      ? ` · ${Math.round(alert.match_confidence * (alert.match_confidence <= 1 ? 100 : 1))}% match`
      : "";
  return {
    priority,
    title: `${priority.toUpperCase()} · ${who}`,
    body: `Detected at ${where}${conf}`,
    who,
    where,
  };
}

/** Send one Web Push message. Returns the HTTP status (0 on transport error). */
export async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  message: PushMessagePayload,
): Promise<{ status: number; error?: string }> {
  const keys = vapid();
  if (!keys) return { status: 0, error: "vapid_not_configured" };
  try {
    const sub = {
      endpoint: subscription.endpoint,
      expirationTime: null,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    };
    const payload = await buildPushPayload(
      {
        data: message as unknown as Record<string, string>,
        options: { urgency: message.priority === "Low" ? "normal" : "high", ttl: 3600 },
      },
      sub,
      keys,
    );
    const res = await fetch(subscription.endpoint, {
      method: payload.method,
      headers: payload.headers,
      body: payload.body as unknown as BodyInit,
    });
    return { status: res.status };
  } catch (e) {
    return { status: 0, error: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

async function slackWebhookUrl(
  supabaseAdmin: { from: (t: string) => any },
): Promise<string | null> {
  const fromEnv = process.env["SLACK_WEBHOOK_URL"];
  if (fromEnv) return fromEnv;
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "slack_webhook_url")
    .maybeSingle();
  const url = (data?.value ?? "").trim();
  return url.startsWith("https://hooks.slack.com/") ? url : null;
}

/**
 * Fan a sighting out to Web Push + Slack. Safe to call from server functions
 * and from the public detector webhook route.
 */
export async function notifyAlert(alertId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: alert } = await supabaseAdmin
    .from("alerts")
    .select(
      "id, title, description, priority, subject_id, subject_name, subject_category, camera_id, camera_name, location, match_confidence, latitude, longitude, created_at",
    )
    .eq("id", alertId)
    .maybeSingle();
  if (!alert) return { ok: false as const, error: "not_found" };

  const info = describeAlert(alert as AlertRow);
  const message: PushMessagePayload = {
    title: info.title,
    body: info.body,
    priority: info.priority,
    alertId: alert.id,
    url: "/alerts",
    tag: `hawktrace-${alert.id}`,
  };

  // ---- Web Push -------------------------------------------------------
  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  let pushSent = 0;
  let pushFailed = 0;
  const stale: string[] = [];

  for (const s of subs ?? []) {
    const { status } = await sendWebPush(s, message);
    if (status >= 200 && status < 300) pushSent += 1;
    else {
      pushFailed += 1;
      if (status === 404 || status === 410) stale.push(s.id);
    }
  }
  if (stale.length) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
  }

  if ((subs ?? []).length) {
    await supabaseAdmin.from("escalations").insert({
      alert_id: alert.id,
      subject_id: alert.subject_id,
      channel: "web-push",
      target: `${(subs ?? []).length} device(s)`,
      status: pushSent > 0 ? "dispatched" : "failed",
      response_excerpt: `sent=${pushSent} failed=${pushFailed} pruned=${stale.length}`,
      payload: message as never,
    });
  }

  // ---- Slack ----------------------------------------------------------
  let slackStatus: number | null = null;
  const slackUrl = await slackWebhookUrl(supabaseAdmin as never);
  if (slackUrl) {
    const emoji =
      info.priority === "Critical" ? "🚨" : info.priority === "High" ? "⚠️" : "👁️";
    const lines = [
      `${emoji} *${info.priority.toUpperCase()} sighting* — ${info.who}`,
      `• Location: ${info.where}`,
      alert.subject_category ? `• Category: ${alert.subject_category}` : null,
      alert.subject_id ? `• Subject ref: ${alert.subject_id}` : null,
      alert.latitude != null && alert.longitude != null
        ? `• Coords: ${alert.latitude}, ${alert.longitude}`
        : null,
      alert.created_at ? `• Detected: ${alert.created_at}` : null,
    ].filter(Boolean);
    let excerpt = "";
    try {
      const res = await fetch(slackUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: lines.join("\n") }),
      });
      slackStatus = res.status;
      excerpt = (await res.text().catch(() => "")).slice(0, 200);
    } catch (e) {
      excerpt = String((e as Error)?.message ?? e).slice(0, 200);
    }
    await supabaseAdmin.from("escalations").insert({
      alert_id: alert.id,
      subject_id: alert.subject_id,
      channel: "slack",
      target: "slack-webhook",
      status: slackStatus && slackStatus >= 200 && slackStatus < 300 ? "dispatched" : "failed",
      http_status: slackStatus,
      response_excerpt: excerpt,
      payload: { text: lines.join("\n") } as never,
    });
  }

  return {
    ok: true as const,
    push: { sent: pushSent, failed: pushFailed, pruned: stale.length },
    slack: slackStatus,
  };
}
