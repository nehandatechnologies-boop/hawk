import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Grid3x3, Loader2, Radio, ShieldAlert } from "lucide-react";
import { PageHeader, Panel } from "@/components/common/Primitives";
import { cameraService, personnelService } from "@/services/resources";
import { faceEnrollmentService } from "@/services/faceEnrollments";
import {
  loadFaceModels, detectAllDescriptors, findBestMatch,
  type Candidate,
} from "@/lib/face/api";
import { raiseSightingAlert } from "@/lib/face/raiseAlert";
import { useAuth } from "@/context/AuthContext";
import type { Camera } from "@/types";

const SCAN_INTERVAL_MS = 1500;
const ALERT_COOLDOWN_MS = 30_000; // don't spam the same person on the same camera

function CameraTile({
  camera, candidates, personnel, user, active,
}: {
  camera: Camera;
  candidates: Candidate[];
  personnel: any[];
  user: string;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const cooldownRef = useRef<Map<string, number>>(new Map());
  const [status, setStatus] = useState<"idle" | "live" | "error">("idle");
  const [lastMatch, setLastMatch] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [hitCount, setHitCount] = useState(0);

  // Continuous camera lifecycle
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("live");
      } catch {
        setStatus("error");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [active]);

  // Continuous scan loop
  useEffect(() => {
    if (!active || status !== "live" || candidates.length === 0) return;
    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState === 4) {
        try {
          const dets = await detectAllDescriptors(video);
          setScanCount((c) => c + 1);
          for (const det of dets) {
            const m = findBestMatch(det.descriptor, candidates);
            if (!m) continue;
            const key = m.candidate.personnelId;
            const last = cooldownRef.current.get(key) ?? 0;
            if (Date.now() - last < ALERT_COOLDOWN_MS) continue;
            cooldownRef.current.set(key, Date.now());
            setHitCount((h) => h + 1);
            setLastMatch(m.candidate.personnelName);
            try {
              await raiseSightingAlert(m, { sourceLabel: camera.name, camera, personnel, user });
              toast.error(`Sighting: ${m.candidate.personnelName} on ${camera.name}`, { duration: 5000 });
            } catch { /* ignore */ }
          }
        } catch { /* ignore transient frame errors */ }
      }
      if (!stopped) setTimeout(tick, SCAN_INTERVAL_MS);
    };
    const t = setTimeout(tick, SCAN_INTERVAL_MS);
    return () => { stopped = true; clearTimeout(t); };
  }, [active, status, candidates, camera, personnel, user]);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="relative aspect-video bg-black">
        <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        
        <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider">
          {status === "live"
            ? <><span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE</>
            : status === "error" ? <span className="text-red-400">FEED ERROR</span>
            : <><Loader2 className="h-3 w-3 animate-spin" /> STANDBY</>}
        </div>
        <div className="absolute top-2 right-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono">
          {scanCount}f · {hitCount}✓
        </div>
      </div>
      <div className="p-3 border-t border-border">
        <div className="text-sm font-medium truncate">{camera.name}</div>
        <div className="text-xs text-muted-foreground truncate">{camera.location} · {camera.building}</div>
        {lastMatch && (
          <div className="mt-2 flex items-center gap-1 text-xs text-red-400">
            <ShieldAlert className="h-3 w-3" /> {lastMatch}
          </div>
        )}
      </div>
    </div>
  );
}

function Page() {
  const { user } = useAuth();
  const { data: cameras = [] } = useQuery({ queryKey: ["cameras"], queryFn: cameraService.list });
  const { data: personnel = [] } = useQuery({ queryKey: ["personnel"], queryFn: personnelService.list });
  const { data: enrollments = [] } = useQuery({ queryKey: ["face-enrollments"], queryFn: faceEnrollmentService.list });
  const [modelsReady, setModelsReady] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    loadFaceModels().then(() => setModelsReady(true)).catch(() => setModelsReady(false));
  }, []);

  const candidates: Candidate[] = useMemo(
    () => enrollments.map((e) => ({ personnelId: e.personnel_id, personnelName: e.personnel_name, descriptor: e.descriptor })),
    [enrollments],
  );

  const onlineCameras = cameras.filter((c) => c.status === "Online");

  return (
    <>
      <PageHeader
        title="Live Grid"
        description="Multi-camera continuous facial recognition. Every online camera scans in parallel and pushes sightings straight to the alert feed."
      />
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-primary" />
            <span className="font-medium">{onlineCameras.length}</span>
            <span className="text-muted-foreground">/ {cameras.length} online</span>
          </div>
          <div className="flex items-center gap-2">
            <Radio className={`h-4 w-4 ${active ? "text-red-500" : "text-muted-foreground"}`} />
            <span className="text-muted-foreground">Watchlist:</span>
            <span className="font-medium">{candidates.length} subjects enrolled</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!modelsReady && <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Loading models…</span>}
            <button
              onClick={() => setActive((a) => !a)}
              disabled={!modelsReady || candidates.length === 0}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                active ? "bg-red-500 text-white hover:bg-red-600"
                       : "bg-primary text-primary-foreground hover:bg-primary/90"
              } disabled:opacity-50`}
            >
              {active ? "Stop Grid" : "Activate Grid"}
            </button>
          </div>
        </div>
        {candidates.length === 0 && (
          <p className="mt-2 text-xs text-yellow-400">Enroll subjects in Recognition &gt; Enroll before activating the grid.</p>
        )}
      </Panel>

      {onlineCameras.length === 0 ? (
        <Panel>
          <p className="text-sm text-muted-foreground">No online cameras. Bring at least one camera Online to begin surveillance.</p>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {onlineCameras.map((cam) => (
            <CameraTile
              key={cam.id}
              camera={cam}
              candidates={candidates}
              personnel={personnel}
              user={user?.name ?? "Operator"}
              active={active}
            />
          ))}
        </div>
      )}
    </>
  );
}

export const Route = createFileRoute("/_app/live-grid")({ component: Page });
