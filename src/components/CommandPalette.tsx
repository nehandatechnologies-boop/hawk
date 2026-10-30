import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell, Camera as CameraIcon, CornerDownLeft, Crosshair, LayoutDashboard, Loader2,
  Map as MapIcon, ScanFace, Search, ShieldAlert, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Hit = {
  id: string;
  kind: "Subject" | "Camera" | "Alert" | "Page";
  title: string;
  subtitle?: string;
  badge?: string;
  to: string;
};

const PAGES: Hit[] = [
  { id: "p-dash", kind: "Page", title: "Dashboard", to: "/dashboard" },
  { id: "p-poi", kind: "Page", title: "Persons of Interest", to: "/personnel" },
  { id: "p-cam", kind: "Page", title: "CCTV cameras", to: "/cameras" },
  { id: "p-rec", kind: "Page", title: "Recognition", to: "/recognition" },
  { id: "p-grid", kind: "Page", title: "Live Grid", to: "/live-grid" },
  { id: "p-geo", kind: "Page", title: "Geo-Map Tracking", to: "/geo-map" },
  { id: "p-alerts", kind: "Page", title: "Sighting alerts", to: "/alerts" },
  { id: "p-health", kind: "Page", title: "System Health", to: "/health" },
  { id: "p-audit", kind: "Page", title: "Audit log", to: "/audit" },
  { id: "p-reports", kind: "Page", title: "Reports", to: "/reports" },
];

const KIND_ICON: Record<Hit["kind"], React.ReactNode> = {
  Subject: <Users className="h-4 w-4 text-primary" />,
  Camera: <CameraIcon className="h-4 w-4 text-chart-3" />,
  Alert: <Bell className="h-4 w-4 text-destructive" />,
  Page: <LayoutDashboard className="h-4 w-4 text-muted-foreground" />,
};

/** Escape PostgREST `or()` filter metacharacters in a user-supplied term. */
function safeTerm(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

async function searchAll(q: string): Promise<Hit[]> {
  const term = safeTerm(q);
  if (term.length < 2) return [];
  const like = `%${term}%`;

  const [subs, cams, alerts] = await Promise.all([
    supabase
      .from("subjects")
      .select("id, first_name, last_name, employee_number, category, danger_level, department")
      .or(
        `first_name.ilike.${like},last_name.ilike.${like},employee_number.ilike.${like},aliases.ilike.${like}`,
      )
      .limit(6),
    supabase
      .from("cameras")
      .select("id, name, location, building, status")
      .or(`name.ilike.${like},location.ilike.${like},building.ilike.${like}`)
      .limit(5),
    supabase
      .from("alerts")
      .select("id, title, priority, status, camera_name, created_at")
      .or(`title.ilike.${like},subject_name.ilike.${like},camera_name.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const hits: Hit[] = [];
  for (const s of subs.data ?? []) {
    hits.push({
      id: `s-${s.id}`,
      kind: "Subject",
      title: `${s.first_name} ${s.last_name}`,
      subtitle: [s.employee_number, s.department].filter(Boolean).join(" · "),
      badge: s.category ?? undefined,
      to: `/track/${s.id}`,
    });
  }
  for (const c of cams.data ?? []) {
    hits.push({
      id: `c-${c.id}`,
      kind: "Camera",
      title: c.name,
      subtitle: [c.location, c.building].filter(Boolean).join(", "),
      badge: c.status ?? undefined,
      to: "/cameras",
    });
  }
  for (const a of alerts.data ?? []) {
    hits.push({
      id: `a-${a.id}`,
      kind: "Alert",
      title: a.title,
      subtitle: [a.camera_name, new Date(a.created_at).toLocaleString()].filter(Boolean).join(" · "),
      badge: a.priority ?? undefined,
      to: "/alerts",
    });
  }
  return hits;
}

/**
 * Command deck — Ctrl/Cmd+K global lookup across subjects, cameras, alerts
 * and pages. Subject hits jump straight to the cross-camera tracking dossier.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: remote = [], isFetching } = useQuery({
    queryKey: ["command-search", q],
    queryFn: () => searchAll(q),
    enabled: open && safeTerm(q).length >= 2,
    staleTime: 15_000,
  });

  const pageHits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return PAGES;
    return PAGES.filter((p) => p.title.toLowerCase().includes(t));
  }, [q]);

  const results = useMemo(() => [...remote, ...pageHits], [remote, pageHits]);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => setCursor(0), [q]);

  if (!open) return null;

  const go = (hit: Hit) => {
    onOpenChange(false);
    navigate({ to: hit.to });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-background/80 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => onOpenChange(false)}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command deck"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(c + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(c - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const hit = results[cursor];
                if (hit) go(hit);
              } else if (e.key === "Escape") {
                onOpenChange(false);
              }
            }}
            placeholder="Search subjects, case numbers, cameras, sightings…"
            className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
          />
          {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto scrollbar-thin py-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {safeTerm(q).length >= 2 ? "No records match that query." : "Type at least 2 characters to query the network."}
            </div>
          ) : (
            results.map((hit, i) => (
              <button
                key={hit.id}
                type="button"
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(hit)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm",
                  i === cursor ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                {KIND_ICON[hit.kind]}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{hit.title}</span>
                  {hit.subtitle && (
                    <span className="block truncate text-xs text-muted-foreground">{hit.subtitle}</span>
                  )}
                </span>
                {hit.badge && (
                  <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {hit.badge}
                  </span>
                )}
                <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{hit.kind}</span>
                {i === cursor && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ShieldAlert className="h-3 w-3" /> All queries are audited
          </span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Crosshair className="h-3 w-3" /> Track</span>
            <span className="flex items-center gap-1"><ScanFace className="h-3 w-3" /> Recognise</span>
            <span className="flex items-center gap-1"><MapIcon className="h-3 w-3" /> Geo</span>
          </span>
        </div>
      </div>
    </div>
  );
}
