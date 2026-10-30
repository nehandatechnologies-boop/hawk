import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Camera as CameraIcon, Clock, Crosshair, Fingerprint, MapPin,
  Radio, ShieldAlert, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { personnelService } from "@/services/resources";
import { PageHeader, Panel, LoadingSkeleton, EmptyState, StatCard } from "@/components/common/Primitives";
import { cn } from "@/lib/utils";

type Sighting = {
  id: string;
  title: string;
  priority: string;
  status: string;
  camera_id: string | null;
  camera_name: string | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  match_confidence: number | null;
  created_at: string;
};

const PRIORITY_DOT: Record<string, string> = {
  Critical: "bg-destructive",
  High: "bg-chart-2",
  Medium: "bg-chart-3",
  Low: "bg-muted-foreground",
};

async function fetchSightings(subjectId: string): Promise<Sighting[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select(
      "id, title, priority, status, camera_id, camera_name, location, latitude, longitude, match_confidence, created_at",
    )
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Sighting[];
}

function haversineKm(a: Sighting, b: Sighting) {
  if (a.latitude == null || a.longitude == null || b.latitude == null || b.longitude == null) return 0;
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function TrackPage() {
  const { subjectId } = Route.useParams();
  const qc = useQueryClient();

  const subject = useQuery({
    queryKey: ["subject", subjectId],
    queryFn: () => personnelService.get(subjectId),
  });

  const sightings = useQuery({
    queryKey: ["sightings", subjectId],
    queryFn: () => fetchSightings(subjectId),
  });

  // Live: any new alert for this subject appends to the timeline instantly.
  useEffect(() => {
    const topic = `hawktrace-track-${subjectId}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts", filter: `subject_id=eq.${subjectId}` },
        () => qc.invalidateQueries({ queryKey: ["sightings", subjectId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [subjectId, qc]);

  const rows = sightings.data ?? [];

  const intel = useMemo(() => {
    if (!rows.length) {
      return { cameras: [] as { name: string; count: number }[], distanceKm: 0, hours: [] as number[], last: null, first: null };
    }
    const byCam = new Map<string, number>();
    for (const r of rows) {
      const key = r.camera_name || r.location || "Unknown source";
      byCam.set(key, (byCam.get(key) ?? 0) + 1);
    }
    const asc = [...rows].reverse();
    let distanceKm = 0;
    for (let i = 1; i < asc.length; i++) distanceKm += haversineKm(asc[i - 1], asc[i]);

    const hours = Array.from({ length: 24 }, () => 0);
    for (const r of rows) hours[new Date(r.created_at).getHours()]++;

    return {
      cameras: [...byCam.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      distanceKm,
      hours,
      last: rows[0],
      first: asc[0],
    };
  }, [rows]);

  const maxHour = Math.max(1, ...intel.hours);

  if (subject.isLoading) return <LoadingSkeleton rows={8} />;
  if (subject.error || !subject.data) {
    return <EmptyState title="Subject file not found" hint="The record may have been archived or you lack clearance." />;
  }

  const s = subject.data;
  const name = `${s.firstName} ${s.lastName}`;

  return (
    <>
      <Link to="/personnel" className="mb-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to subject registry
      </Link>

      <PageHeader
        title={`Tracking dossier — ${name}`}
        description={`Cross-camera movement reconstruction for case ${s.employeeNumber}. All access to this file is audited.`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Confirmed sightings" value={rows.length} icon={<Crosshair className="h-4 w-4" />} />
        <StatCard label="Distinct cameras" value={intel.cameras.length} icon={<CameraIcon className="h-4 w-4" />} />
        <StatCard label="Tracked distance" value={`${intel.distanceKm.toFixed(1)} km`} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard
          label="Last seen"
          value={intel.last ? new Date(intel.last.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Subject profile" className="lg:col-span-1">
          <div className="flex items-start gap-3">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
              {s.photoUrl ? (
                <img src={s.photoUrl} alt={`Reference photograph of ${name}`} className="h-full w-full object-cover" />
              ) : (
                <Fingerprint className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold leading-tight">{name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {s.category && (
                  <span className="rounded border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-destructive">
                    {s.category}
                  </span>
                )}
                {s.dangerLevel && s.dangerLevel !== "Unknown" && (
                  <span className="rounded border border-chart-2/40 bg-chart-2/10 px-1.5 py-0.5 font-mono text-[10px] uppercase text-chart-2">
                    {s.dangerLevel}
                  </span>
                )}
              </div>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Case number", s.employeeNumber],
              ["Issuing agency", s.department],
              ["Descriptor", s.position],
              ["Aliases", s.aliases],
              ["Date of birth", s.dateOfBirth],
              ["Gender", s.gender],
              ["Status", s.status],
            ]
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-3 border-b border-border/50 pb-1.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
          </dl>
          {s.notes && (
            <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="mb-1 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-foreground">
                <ShieldAlert className="h-3.5 w-3.5" /> Intelligence notes
              </span>
              {s.notes}
            </div>
          )}
        </Panel>

        <Panel
          title="Movement timeline"
          className="lg:col-span-2"
          action={
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Radio className="h-3 w-3 animate-pulse text-primary" /> live
            </span>
          }
        >
          {sightings.isLoading ? (
            <LoadingSkeleton rows={6} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No sightings recorded"
              hint="This subject has not been matched on the camera network yet."
            />
          ) : (
            <ol className="relative ml-2 border-l border-border">
              {rows.map((r, i) => {
                const prev = rows[i + 1];
                const gapMin = prev
                  ? Math.round((new Date(r.created_at).getTime() - new Date(prev.created_at).getTime()) / 60000)
                  : null;
                return (
                  <motion.li
                    key={r.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.3) }}
                    className="relative py-3 pl-5"
                  >
                    <span
                      className={cn(
                        "absolute -left-[5px] top-5 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                        PRIORITY_DOT[r.priority] ?? PRIORITY_DOT.Low,
                      )}
                    />
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{new Date(r.created_at).toLocaleString()}</span>
                      <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase">
                        {r.priority}
                      </span>
                      {r.match_confidence != null && (
                        <span className="font-mono">{(r.match_confidence * 100).toFixed(1)}% match</span>
                      )}
                      {gapMin != null && <span>+{gapMin}m since previous</span>}
                    </div>
                    <p className="mt-1 text-sm leading-snug">{r.title}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CameraIcon className="h-3 w-3" />
                      {r.camera_name ?? "Unknown camera"}
                      {r.location && (
                        <>
                          <MapPin className="ml-1 h-3 w-3" />
                          {r.location}
                        </>
                      )}
                    </p>
                  </motion.li>
                );
              })}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Camera frequency">
          {intel.cameras.length === 0 ? (
            <p className="text-sm text-muted-foreground">No camera hits yet.</p>
          ) : (
            <div className="space-y-2">
              {intel.cameras.slice(0, 8).map((c) => (
                <div key={c.name}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="truncate">{c.name}</span>
                    <span className="font-mono text-muted-foreground">{c.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(c.count / intel.cameras[0].count) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Pattern of life — sightings by hour">
          <div className="flex h-32 items-end gap-1">
            {intel.hours.map((n, h) => (
              <div key={h} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn("w-full rounded-t", n ? "bg-primary" : "bg-muted")}
                  style={{ height: `${Math.max(2, (n / maxHour) * 100)}%` }}
                  title={`${String(h).padStart(2, "0")}:00 — ${n} sighting(s)`}
                />
                {h % 6 === 0 && <span className="font-mono text-[9px] text-muted-foreground">{h}</span>}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Peak activity window helps plan lawful interception and patrol tasking.
          </p>
        </Panel>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_app/track/$subjectId")({
  component: TrackPage,
  head: () => ({
    meta: [
      { title: "Subject Tracking Dossier · HAWKTRACE" },
      { name: "description", content: "Cross-camera movement reconstruction and pattern-of-life analysis for a tracked subject." },
      { property: "og:title", content: "Subject Tracking Dossier · HAWKTRACE" },
      { property: "og:description", content: "Cross-camera movement reconstruction for a tracked subject." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});
