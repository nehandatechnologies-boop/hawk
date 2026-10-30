import { supabase } from "@/integrations/supabase/client";
import type { SecurityAlert } from "@/types";

/**
 * Mirror an alert into the Lovable Cloud `alerts` table so it streams to every
 * connected operator over Realtime. The external FastAPI backend remains the
 * source of truth for the operational alert; this row exists purely as the
 * push-channel signal.
 */
export async function mirrorAlertToCloud(input: {
  alert: SecurityAlert;
  cameraName?: string;
  location?: string;
  subjectName?: string;
  thumbnail?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { alert } = input;
  const { data: sess } = await supabase.auth.getSession();
  const userId = sess.session?.user.id ?? null;

  const { error } = await supabase.from("alerts").insert({
    external_id: alert.id,
    title: alert.title,
    description: alert.description,
    priority: alert.priority,
    status: alert.status,
    source: alert.source,
    camera_id: alert.cameraId,
    camera_name: input.cameraName,
    location: input.location,
    subject_id: alert.subjectId,
    subject_name: input.subjectName,
    subject_category: alert.subjectCategory,
    match_confidence: alert.confidence,
    thumbnail: input.thumbnail,
    raised_by: userId,
    metadata: (input.metadata ?? {}) as never,
  });
  if (error) {
    // Non-fatal — the external backend already has the canonical alert.
    console.warn("[hawktrace] realtime mirror failed:", error.message);
  }
}
