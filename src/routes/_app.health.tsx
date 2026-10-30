import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, Camera as CameraIcon, CheckCircle2, Clock,
  Cpu, Radio, Timer, WifiOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cameraService } from "@/services/resources";
import { PageHeader, Panel, StatCard, LoadingSkeleton } from "@/components/common/Primitives";
import { cn } from "@/lib/utils";

const STALE_MS = 3 * 60 * 1000;

type AlertLite = { id: string; priority: string; status: string; source: string | null; created_at: string; updated_at: string };

async function fetchRecentAlerts(): Promise<AlertLite[]> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("alerts")
    .select("id, priority, status, source, created_at, updated_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as AlertLite[];
}

function HealthPage() {
  const cameras = useQuery({ queryKey: ["cameras"], queryFn: cameraService.list, refetchInterval: 30_000 });
  const alerts = useQuery({ queryKey: ["alerts", "health-24h"], queryFn: fetchRecentAlerts, refetchInterval: 30_000 });

  const cams = cameras.data ?? [];
  const rows = alerts.data ?? [];

  const stats = useMemo(() => {
    const now = Date.now();
    const stale = cams.filter(
      (c) => c.status === "Online" && (!c.lastHeartbeat || now - new Date(c.lastHeartbeat).getTime() > STALE_MS),
    );
    const online = cams.filter((c) => c.status === "Online");
    const offline = cams.filter((c) => c.status === "Offline");
    const degraded = cams.filter((c) => c.status === "Degraded");
    const noGeo = cams.filter((c) => c.latitude == null || c.longitude == null);

    // Worker liveness: detector-sourced alerts are the only proof the
    // off-browser RTSP pipeline is actually running.
    const detector = rows.filter((a) => (a.source ?? "").includes("detector"));
    const lastDetector = detector[0]?.created_at ?? null;
    const workerAgeMin = lastDetector ? (now - new Date(lastDetector).getTime()) / 60000 : null;

    const acknowledged = rows.filter((a) => a.status !== "Open");
    const ackTimes = acknowledged
      .map((a) => (new Date(a.updated_at).getTime() - new Date(a.created_at).getTime()) / 1000)
      .filter((s) => s > 0 && s < 86400);
    const medianAck = ackTimes.length
      ? [...ackTimes].sort((a, b) => a - b)[Math.floor(ackTimes.length / 2)]
      : null;

    const breaches = rows.filter(
      (a) =>
        a.status === "Open" &&
        (a.priority === "Critical" || a.priority === "High") &&
        now - new Date(a.created_at).getTime() > 5 * 60 * 1000,
    );

    return {
      online, offline, degraded, stale, noGeo,
      coverage: cams.length ? Math.round((online.length / cams.length) * 100) : 0,
      detectorCount: detector.length,
      workerAgeMin,
      medianAck,
      breaches,
      last24h: rows.length,
    };
  }, [cams, rows]);

  const workerState =
    stats.workerAgeMin == null
      ? { label: "No signal", tone: "danger" as const, note: "The background detector has not reported in the last 24 hours." }
      : stats.workerAgeMin < 15
        ? { label: "Healthy", tone: "success" as const, note: `Last detector hit ${Math.round(stats.workerAgeMin)} min ago.` }
        : { label: "Degraded", tone: "warning" as const, note: `Last detector hit ${Math.round(stats.workerAgeMin)} min ago.` };

  if (cameras.isLoading) return <LoadingSkeleton rows={8} />;

  return (
    <>
      <PageHeader
        title="System Health"
        description="Live readiness of the camera network, the off-browser detector pipeline and operator response times."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Network coverage"
          value={`${stats.coverage}%`}
          hint={`${stats.online.length} of ${cams.length} cameras online`}
          icon={<CameraIcon className="h-4 w-4" />}
          tone={stats.coverage >= 90 ? "success" : stats.coverage >= 60 ? "warning" : "danger"}
        />
        <StatCard
          label="Detector pipeline"
          value={workerState.label}
          hint={workerState.note}
          icon={<Cpu className="h-4 w-4" />}
          tone={workerState.tone}
          index={1}
        />
        <StatCard
          label="Median acknowledgement"
          value={stats.medianAck == null ? "—" : `${Math.round(stats.medianAck)}s`}
          hint="Time from sighting to operator action (24h)"
          icon={<Timer className="h-4 w-4" />}
          tone={stats.medianAck != null && stats.medianAck <= 120 ? "success" : "warning"}
          index={2}
        />
        <StatCard
          label="SLA breaches"
          value={stats.breaches.length}
          hint="Critical/High open beyond 5 minutes"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={stats.breaches.length ? "danger" : "success"}
          index={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Camera heartbeats"
          action={
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radio className="h-3 w-3 animate-pulse text-primary" /> polling 30s
            </span>
          }
        >
          {cams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cameras registered yet.</p>
          ) : (
            <div className="max-h-96 space-y-1.5 overflow-y-auto scrollbar-thin">
              {cams.map((c) => {
                const age = c.lastHeartbeat ? Date.now() - new Date(c.lastHeartbeat).getTime() : Infinity;
                const bad = c.status !== "Online" || age > STALE_MS;
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        c.status === "Online" && !bad
                          ? "bg-[color:var(--color-success)]"
                          : c.status === "Degraded"
                            ? "bg-[color:var(--color-warning)]"
                            : "bg-destructive",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="hidden truncate text-xs text-muted-foreground sm:block">{c.location}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {Number.isFinite(age) ? `${Math.round(age / 60000)}m` : "—"}
                    </span>
                    {bad ? (
                      <WifiOff className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[color:var(--color-success)]" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-4">
          <Panel title="Pipeline diagnostics">
            <dl className="space-y-2 text-sm">
              {[
                ["Sightings last 24h", String(stats.last24h)],
                ["Detector-sourced sightings", String(stats.detectorCount)],
                ["Cameras offline", String(stats.offline.length)],
                ["Cameras degraded", String(stats.degraded.length)],
                ["Online but stale heartbeat", String(stats.stale.length)],
                ["Cameras missing coordinates", String(stats.noGeo.length)],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-border/50 pb-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-mono font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Readiness checklist">
            <ul className="space-y-2 text-sm">
              {[
                { ok: cams.length > 0, label: "Camera network registered" },
                { ok: stats.noGeo.length === 0, label: "All cameras geo-referenced for map tracking" },
                { ok: stats.workerAgeMin != null && stats.workerAgeMin < 15, label: "Background detector reporting" },
                { ok: stats.breaches.length === 0, label: "No high-priority sightings past SLA" },
                { ok: stats.stale.length === 0, label: "All online cameras sending heartbeats" },
              ].map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  {c.ok ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-success)]" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-warning)]" />
                  )}
                  <span className={cn(c.ok ? "text-muted-foreground" : "font-medium")}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      {stats.breaches.length > 0 && (
        <Panel
          title="Response SLA breaches"
          className="mt-4 border-destructive/40"
          action={
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <Clock className="h-3 w-3" /> action required
            </span>
          }
        >
          <p className="text-sm text-muted-foreground">
            {stats.breaches.length} high-priority sighting{stats.breaches.length === 1 ? "" : "s"} remain unacknowledged
            beyond the five-minute response window. Escalate via the triage console.
          </p>
        </Panel>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Activity className="h-3 w-3" /> Health figures are computed live from the operational database — no cached or
        simulated values.
      </p>
    </>
  );
}

export const Route = createFileRoute("/_app/health")({
  component: HealthPage,
  head: () => ({
    meta: [
      { title: "System Health · HAWKTRACE" },
      { name: "description", content: "Live readiness of the CCTV network, detector pipeline and operator response SLAs." },
      { property: "og:title", content: "System Health · HAWKTRACE" },
      { property: "og:description", content: "Live readiness of the CCTV network and detector pipeline." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
