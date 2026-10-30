import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Web Push public key + whether the channel is configured. */
export const getPushConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getPushPublicKey } = await import("@/lib/notify.server");
    const publicKey = getPushPublicKey();
    return { publicKey, configured: Boolean(publicKey) };
  });

/** Register (or refresh) the calling operator's device for push delivery. */
export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) => {
    const endpoint = String(d?.endpoint ?? "");
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 2000) throw new Error("invalid_endpoint");
    const p256dh = String(d?.p256dh ?? "");
    const auth = String(d?.auth ?? "");
    if (!p256dh || !auth || p256dh.length > 300 || auth.length > 300) throw new Error("invalid_keys");
    return { endpoint, p256dh, auth, userAgent: String(d?.userAgent ?? "").slice(0, 300) };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("push_subscriptions").upsert(
      {
        user_id: context.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.userAgent,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Unregister a device. */
export const removePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { endpoint: string }) => ({ endpoint: String(d?.endpoint ?? "") }))
  .handler(async ({ data, context }) => {
    await context.supabase.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true as const };
  });

/** Devices registered by the calling operator. */
export const listMyPushDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("push_subscriptions")
      .select("id, endpoint, user_agent, created_at, last_seen_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

/** Send a test push to the caller's own devices. */
export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendWebPush } = await import("@/lib/notify.server");
    const { data: subs } = await context.supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");
    let sent = 0;
    for (const s of subs ?? []) {
      const { status } = await sendWebPush(s, {
        title: "HAWKTRACE test alert",
        body: "Push notifications are live on this device.",
        priority: "Medium",
        url: "/alerts",
        tag: "hawktrace-test",
      });
      if (status >= 200 && status < 300) sent += 1;
    }
    return { ok: sent > 0, sent, devices: (subs ?? []).length };
  });

/** Fan a sighting out to Web Push + Slack. Called right after an alert is raised. */
export const dispatchAlertNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { alertId: string }) => {
    const alertId = String(d?.alertId ?? "");
    if (!/^[0-9a-fA-F-]{36}$/.test(alertId)) throw new Error("invalid_alert_id");
    return { alertId };
  })
  .handler(async ({ data }) => {
    const { notifyAlert } = await import("@/lib/notify.server");
    return notifyAlert(data.alertId);
  });

/** Administrator: read the Slack channel configuration. */
export const getSlackWebhook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value, updated_at")
      .eq("key", "slack_webhook_url")
      .maybeSingle();
    if (error) return { allowed: false as const, url: "", updatedAt: null };
    const url = data?.value ?? "";
    // Never echo the full secret path back to the browser.
    const masked = url ? `${url.slice(0, 34)}…${url.slice(-4)}` : "";
    return { allowed: true as const, url: masked, configured: Boolean(url), updatedAt: data?.updated_at ?? null };
  });

/** Administrator: set or clear the Slack incoming-webhook URL. */
export const setSlackWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string }) => {
    const url = String(d?.url ?? "").trim();
    if (url && !/^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]{10,200}$/.test(url)) {
      throw new Error("invalid_slack_webhook");
    }
    return { url };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("app_settings").upsert(
      {
        key: "slack_webhook_url",
        value: data.url,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) return { ok: false as const, error: "not_permitted" };
    return { ok: true as const, configured: Boolean(data.url) };
  });

/** Administrator: post a test message to the Slack channel. */
export const testSlackWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("app_settings")
      .select("value")
      .eq("key", "slack_webhook_url")
      .maybeSingle();
    const url = (data?.value ?? "").trim();
    if (error || !url) return { ok: false as const, error: "not_configured" };
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "✅ HAWKTRACE connected — critical sightings will post here." }),
      });
      return { ok: res.ok, status: res.status };
    } catch {
      return { ok: false as const, error: "unreachable" };
    }
  });
