import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;
type Actor = { userId: string; email: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRow = Record<string, any>;

async function assertAdmin(supabase: SB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "Administrator",
  });
  if (error) throw new Error(`role check failed: ${error.message}`);
  if (!data) throw new Error("forbidden: administrator role required");
}

async function audit(action: string, meta: JsonRow, actor: Actor) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("audit_logs").insert({
    action,
    module: "dev-terminal",
    actor_id: actor.userId,
    actor_email: actor.email,
    metadata: meta as never,
    ip_address: "",
    record_id: "",
  } as never);
}

/** Read-only SQL query executed via the audited admin_readonly_query DB function. */
export const runDevSql = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sql: string }) => {
    const sql = String(d?.sql ?? "").slice(0, 4000);
    if (!sql.trim()) throw new Error("empty query");
    return { sql };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as { supabase: SB; userId: string; claims: { email?: string } };
    await assertAdmin(supabase, userId);
    // The DB helper is service-role only; it re-verifies the administrator role for _actor.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("admin_readonly_query" as never, {
      _sql: data.sql,
      _actor: userId,
    } as never);
    if (error) {
      await audit("sql.error", { sql: data.sql, error: error.message }, { userId, email: claims.email ?? "" });
      throw new Error(error.message);
    }
    await audit("sql.run", { sql: data.sql }, { userId, email: claims.email ?? "" });
    return { rows: (rows as JsonRow[] | null) ?? [] };
  });

/** HEAD-check a camera's stream URL to see whether it is reachable. */
export const pingCamera = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { cameraId: string }) => {
    const cameraId = String(d?.cameraId ?? "").slice(0, 128);
    if (!cameraId) throw new Error("cameraId required");
    return { cameraId };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as { supabase: SB; userId: string; claims: { email?: string } };
    await assertAdmin(supabase, userId);

    const { data: cam, error } = await supabase
      .from("cameras")
      .select("id,name,rtsp_url")
      .eq("id", data.cameraId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cam) throw new Error("camera not found");

    const url = cam.rtsp_url ?? "";
    if (!url) {
      return { reachable: false, message: "camera has no stream url", cameraName: cam.name, status: null as number | null, latencyMs: 0 };
    }

    if (!/^https?:\/\//i.test(url)) {
      const scheme = url.split(":")[0];
      await audit("camera.ping.skip", { cameraId: data.cameraId, scheme }, { userId, email: claims.email ?? "" });
      return { reachable: false, message: `non-http scheme (${scheme}) — check from your worker`, cameraName: cam.name, status: null as number | null, latencyMs: 0 };
    }

    const started = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { method: "HEAD", signal: controller.signal });
      clearTimeout(timer);
      const ms = Date.now() - started;
      await audit("camera.ping", { cameraId: data.cameraId, status: res.status, ms }, { userId, email: claims.email ?? "" });
      return { reachable: res.ok, status: res.status as number | null, latencyMs: ms, cameraName: cam.name, message: "" };
    } catch (e) {
      const ms = Date.now() - started;
      const message = e instanceof Error ? e.message : String(e);
      await audit("camera.ping.fail", { cameraId: data.cameraId, error: message, ms }, { userId, email: claims.email ?? "" });
      return { reachable: false, status: null as number | null, latencyMs: ms, cameraName: cam.name, message };
    }
  });

/** Re-emit the last N alerts on the realtime channel by touching updated_at. */
export const replayAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { count?: number }) => {
    const count = Math.min(50, Math.max(1, Number(d?.count ?? 5)));
    return { count };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as { supabase: SB; userId: string; claims: { email?: string } };
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("alerts")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(data.count);
    if (error) throw new Error(error.message);

    const ids = ((rows as { id: string }[] | null) ?? []).map((r) => r.id);
    for (const id of ids) {
      await supabaseAdmin.from("alerts").update({ updated_at: new Date().toISOString() }).eq("id", id);
    }
    await audit("alerts.replay", { count: ids.length }, { userId, email: claims.email ?? "" });
    return { replayed: ids.length, ids };
  });

/** Tail the most recent audit + escalation entries. */
export const tailLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) => ({ limit: Math.min(200, Math.max(1, Number(d?.limit ?? 40))) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as { supabase: SB; userId: string };
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [audits, escs] = await Promise.all([
      supabaseAdmin
        .from("audit_logs")
        .select("id,created_at,action,module,actor_email,metadata")
        .order("created_at", { ascending: false })
        .limit(data.limit),
      supabaseAdmin
        .from("escalations")
        .select("id,created_at,channel,target,status,http_status,response_excerpt")
        .order("created_at", { ascending: false })
        .limit(data.limit),
    ]);
    if (audits.error) throw new Error(audits.error.message);
    if (escs.error) throw new Error(escs.error.message);
    return {
      audits: (audits.data ?? []) as JsonRow[],
      escalations: (escs.data ?? []) as JsonRow[],
    };
  });

/** Signal the worker to reload (writes a row the worker polls / listens to). */
export const workerControl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { command: "restart" | "reload-model" | "resync-cameras" }) => {
    const command = d?.command;
    if (!["restart", "reload-model", "resync-cameras"].includes(command)) {
      throw new Error("unknown worker command");
    }
    return { command };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context as { supabase: SB; userId: string; claims: { email?: string } };
    await assertAdmin(supabase, userId);
    await audit(`worker.${data.command}`, { command: data.command }, { userId, email: claims.email ?? "" });
    return { ok: true as const, dispatched: data.command };
  });
