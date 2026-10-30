import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  priority: string;
  status: string;
  camera_name: string | null;
  subject_id: string | null;
  created_at: string;
};

const PRIORITY_STYLE: Record<string, string> = {
  Critical: "text-destructive border-destructive/40 bg-destructive/10",
  High: "text-chart-2 border-chart-2/40 bg-chart-2/10",
  Medium: "text-chart-3 border-chart-3/40 bg-chart-3/10",
  Low: "text-muted-foreground border-border bg-muted/40",
};

async function fetchUnresolved(): Promise<Row[]> {
  const { data, error } = await supabase
    .from("alerts")
    .select("id, title, priority, status, camera_name, subject_id, created_at")
    .in("status", ["Open", "Acknowledged"])
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as Row[];
}

function ago(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** Header alert bell — live unresolved sighting count + triage shortcut. */
export function AlertBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);

  const { data = [] } = useQuery({
    queryKey: ["alerts", "unresolved-bell"],
    queryFn: fetchUnresolved,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const topic = `hawktrace-bell-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        qc.invalidateQueries({ queryKey: ["alerts", "unresolved-bell"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const urgent = data.filter((a) => a.priority === "Critical" || a.priority === "High").length;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md border border-border bg-card p-2 hover:bg-accent"
        aria-label={`Unresolved sightings: ${data.length}`}
      >
        <Bell className="h-4 w-4" />
        {data.length > 0 && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
              urgent > 0
                ? "animate-pulse bg-destructive text-destructive-foreground"
                : "bg-chart-3 text-background",
            )}
          >
            {data.length > 99 ? "99+" : data.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[22rem] overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Unresolved sightings
            </span>
            <span className="font-mono text-xs text-muted-foreground">{data.length}</span>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {data.length === 0 ? (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Network clear — no unresolved sightings.
              </div>
            ) : (
              data.map((a) => (
                <div key={a.id} className="border-b border-border/60 px-3 py-2.5 last:border-0">
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase",
                        PRIORITY_STYLE[a.priority] ?? PRIORITY_STYLE.Low,
                      )}
                    >
                      {a.priority}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm leading-snug">{a.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {a.camera_name ?? "Unknown camera"} · {ago(a.created_at)} ago · {a.status}
                      </p>
                    </div>
                    {a.subject_id && (
                      <Link
                        to="/track/$subjectId"
                        params={{ subjectId: a.subject_id }}
                        onClick={() => setOpen(false)}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-primary"
                        aria-label="Track subject"
                        title="Open tracking dossier"
                      >
                        <Crosshair className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            to="/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-border px-3 py-2 text-center text-xs font-medium text-primary hover:bg-accent"
          >
            Open triage console
          </Link>
        </div>
      )}
    </div>
  );
}
