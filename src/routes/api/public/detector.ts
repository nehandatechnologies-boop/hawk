import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * External detector webhook.
 *
 * Runs 24/7 on any machine (edge box, on-prem worker, third-party AI/DVR).
 * The worker POSTs a signed payload here whenever a face match hits; we
 * insert an `alerts` row which fans out to every operator over Realtime
 * (toast + priority tone + spoken details via GlobalAlertMonitor).
 *
 * Signing: HMAC-SHA256 of the raw request body using DETECTOR_WEBHOOK_SECRET,
 * hex-encoded, sent in the `x-hawktrace-signature` header.
 */

interface DetectorPayload {
  external_id?: string;
  title?: string;
  description?: string;
  priority?: "Critical" | "High" | "Medium" | "Low";
  camera_id?: string;
  camera_name?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  subject_id?: string;
  subject_name?: string;
  subject_category?: string;
  match_confidence?: number;
  thumbnail?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

function isPayload(v: unknown): v is DetectorPayload {
  return typeof v === "object" && v !== null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function handlePost(request: Request) {
  const secret = process.env.DETECTOR_WEBHOOK_SECRET;
  if (!secret) return json({ error: "webhook not configured" }, 503);

  const signature = request.headers.get("x-hawktrace-signature") ?? "";
  const raw = await request.text();
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return json({ error: "invalid signature" }, 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!isPayload(payload)) return json({ error: "invalid payload" }, 400);

  const priority = payload.priority ?? "Medium";
  const title =
    payload.title ??
    (payload.subject_name ? `Match: ${payload.subject_name}` : "Detector hit");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("alerts")
    .insert({
      external_id: payload.external_id ?? null,
      title,
      description: payload.description ?? null,
      priority,
      status: "Open",
      source: payload.source ?? "detector-webhook",
      camera_id: payload.camera_id ?? null,
      camera_name: payload.camera_name ?? null,
      location: payload.location ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      subject_id: payload.subject_id ?? null,
      subject_name: payload.subject_name ?? null,
      subject_category: payload.subject_category ?? null,
      match_confidence: payload.match_confidence ?? null,
      thumbnail: payload.thumbnail ?? null,
      metadata: (payload.metadata ?? {}) as never,
    })
    .select("id")
    .single();

  if (error) return json({ error: error.message }, 500);

  // Fan out to Web Push devices + Slack so operators are alerted 24/7,
  // even with no dashboard open.
  try {
    const { notifyAlert } = await import("@/lib/notify.server");
    await notifyAlert(data.id);
  } catch {
    // Notification delivery is best-effort; the alert row already landed.
  }

  return json({ ok: true, id: data.id });
}

export const Route = createFileRoute("/api/public/detector")({
  server: {
    handlers: {
      POST: ({ request }) => handlePost(request),
      GET: () => json({ ok: true, endpoint: "hawktrace detector webhook" }),
    },
  },
});
