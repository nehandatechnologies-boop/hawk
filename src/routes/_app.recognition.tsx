import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ScanFace, Upload, Video, UserCheck, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { PageHeader, Panel, LoadingSkeleton } from "@/components/common/Primitives";
import { personnelService, alertService, cameraService } from "@/services/resources";
import type { Camera } from "@/types";
import { faceEnrollmentService, type FaceEnrollment } from "@/services/faceEnrollments";
import {
  loadFaceModels,
  detectSingleDescriptor,
  detectAllDescriptors,
  findBestMatch,
  captureCanvas,
  loadImageFromFile,
  MATCH_THRESHOLD,
  type Candidate,
  type Match,
} from "@/lib/face/api";
import type { Personnel } from "@/types";
import { useAuth } from "@/context/AuthContext";

type Tab = "live" | "upload" | "enroll" | "enrollments";

function useFaceModels() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    loadFaceModels()
      .then(() => mounted && setReady(true))
      .catch((e) => mounted && setError(e?.message ?? "Failed to load models"));
    return () => { mounted = false; };
  }, []);
  return { ready, error };
}

function useCandidates(enrollments: FaceEnrollment[]): Candidate[] {
  return enrollments.map((e) => ({
    personnelId: e.personnel_id,
    personnelName: e.personnel_name,
    descriptor: e.descriptor,
  }));
}

function formatCameraLocation(camera: Camera | null): string {
  if (!camera) return "Unknown location";
  const parts = [camera.location, camera.building].filter(Boolean);
  return parts.join(", ") || "Unknown location";
}

function priorityFor(person: Personnel | undefined): "Critical" | "High" | "Medium" | "Low" {
  const cat = person?.category;
  if (cat === "Wanted") {
    return person?.dangerLevel === "Armed & Dangerous" ? "Critical" : "High";
  }
  if (cat === "Missing") return "High";
  if (cat === "Cleared") return "Low";
  return "Medium"; // Person of Interest / unknown
}

async function raiseAlert(
  match: Match,
  opts: { sourceLabel: string; camera: Camera | null; personnel: Personnel[]; user: string },
) {
  const person = opts.personnel.find((p) => p.id === match.candidate.personnelId);
  const displayName = person ? `${person.firstName} ${person.lastName}` : match.candidate.personnelName;
  const idLabel = person?.employeeNumber ?? match.candidate.personnelId;
  const cameraLabel = opts.camera ? opts.camera.name : opts.sourceLabel;
  const location = formatCameraLocation(opts.camera);
  const confidencePct = (match.confidence * 100).toFixed(1);
  const categoryTag = person?.category ? `[${person.category.toUpperCase()}] ` : "";
  const dangerNote = person?.dangerLevel && person.dangerLevel !== "Unknown"
    ? ` Threat: ${person.dangerLevel}.` : "";

  const title = `${categoryTag}${displayName} (Case ${idLabel}) detected on ${cameraLabel} at ${location}`;
  const priority = priorityFor(person);

  const created = await alertService.create({
    title,
    priority,
    status: "Open",
    source: opts.camera ? `${cameraLabel} — ${location}` : opts.sourceLabel,
    timestamp: new Date().toISOString(),
    description:
      `Facial recognition match: ${displayName} (Case ${idLabel})` +
      `${person?.department ? `, issued by ${person.department}` : ""} ` +
      `detected on ${cameraLabel} at ${location}. ` +
      `Confidence ${confidencePct}% (distance ${match.distance.toFixed(3)}).${dangerNote} ` +
      `Captured by ${opts.user}.` +
      (person?.notes ? ` Intel notes: ${person.notes}` : ""),
    assignedOfficer: opts.user,
    subjectId: person?.id,
    subjectCategory: person?.category,
    cameraId: opts.camera?.id,
    confidence: match.confidence,
    latitude: opts.camera?.latitude ?? null,
    longitude: opts.camera?.longitude ?? null,
  } as any);

  // Mirror to Lovable Cloud `alerts` table so every connected operator
  // receives the detection over Realtime instantly.
  try {
    const { mirrorAlertToCloud } = await import("@/services/alertsRealtime");
    await mirrorAlertToCloud({
      alert: { ...(created as any), id: (created as any)?.id ?? crypto.randomUUID(), title, priority, status: "Open",
        source: opts.camera ? `${cameraLabel} — ${location}` : opts.sourceLabel,
        timestamp: new Date().toISOString(),
        description: title,
        cameraId: opts.camera?.id, subjectId: person?.id, subjectCategory: person?.category,
        confidence: match.confidence },
      cameraName: cameraLabel,
      location,
      subjectName: displayName,
      metadata: { idLabel, confidencePct, dangerLevel: person?.dangerLevel ?? null },
    });
  } catch { /* non-fatal */ }
}

/* ============ ENROLL TAB ============ */

function EnrollPanel({ personnel, onDone }: { personnel: Personnel[]; onDone: () => void }) {
  const { ready, error } = useFaceModels();
  const [personnelId, setPersonnelId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const upsert = useMutation({
    mutationFn: faceEnrollmentService.upsert,
    onSuccess: () => { toast.success("Face enrolled"); onDone(); setFile(null); setPreview(""); setPersonnelId(""); },
    onError: (e: any) => toast.error(e?.message ?? "Enrollment failed"),
  });

  const handleFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };

  const enroll = async () => {
    if (!personnelId || !file) return;
    const person = personnel.find((p) => p.id === personnelId);
    if (!person) return toast.error("Select a person");
    setBusy(true);
    try {
      const img = await loadImageFromFile(file);
      const detected = await detectSingleDescriptor(img);
      if (!detected) { toast.error("No face detected in image"); return; }
      const thumb = captureCanvas(img, 160);
      await upsert.mutateAsync({
        personnelId: person.id,
        personnelName: `${person.firstName} ${person.lastName}`,
        descriptor: detected.descriptor,
        thumbnail: thumb,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="space-y-4">
      {error && <div className="text-sm text-destructive">Models failed to load: {error}</div>}
      {!ready && !error && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading face recognition models…
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm block">
          <span className="mb-1 block text-muted-foreground">Personnel</span>
          <select value={personnelId} onChange={(e) => setPersonnelId(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2">
            <option value="">Select a person to enroll…</option>
            {personnel.map((p) => (
              <option key={p.id} value={p.id}>
                {p.employeeNumber} — {p.firstName} {p.lastName} ({p.department})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm block">
          <span className="mb-1 block text-muted-foreground">Face photo</span>
          <input type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1 file:text-primary-foreground" />
        </label>
      </div>
      {preview && (
        <div className="flex items-center gap-4">
          <img src={preview} alt="preview" className="h-32 w-32 rounded-md object-cover border border-border" />
          <div className="text-xs text-muted-foreground">
            Use a clear, front-facing photo with even lighting.<br />
            Only one descriptor per person is stored; re-enrolling overwrites it.
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={enroll} disabled={!ready || !personnelId || !file || busy || upsert.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {busy || upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          Enroll face
        </button>
      </div>
    </Panel>
  );
}

/* ============ CAMERA PICKER ============ */

function CameraPicker({
  cameras, value, onChange,
}: { cameras: Camera[]; value: string; onChange: (id: string) => void }) {
  const selected = cameras.find((c) => c.id === value) ?? null;
  return (
    <div className="space-y-1">
      <label className="text-sm flex items-center gap-2">
        <span className="text-muted-foreground">Camera</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm min-w-[220px]">
          <option value="">Select capture camera…</option>
          {cameras.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.location}{c.building ? `, ${c.building}` : ""}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="text-[11px] text-muted-foreground pl-1">
          Location: {formatCameraLocation(selected)} · Status: {selected.status}
        </div>
      )}
    </div>
  );
}

/* ============ UPLOAD SCAN TAB ============ */

function UploadScanPanel({
  candidates, user, cameras, personnel,
}: { candidates: Candidate[]; user: string; cameras: Camera[]; personnel: Personnel[] }) {
  const { ready, error } = useFaceModels();
  const [preview, setPreview] = useState<string>("");
  const [results, setResults] = useState<{ match: Match | null; box: { x: number; y: number; width: number; height: number } }[]>([]);
  const [busy, setBusy] = useState(false);
  const [cameraId, setCameraId] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);

  const scan = async (file: File) => {
    setPreview(URL.createObjectURL(file));
    setResults([]);
    setBusy(true);
    try {
      const img = await loadImageFromFile(file);
      const detected = await detectAllDescriptors(img);
      if (detected.length === 0) { toast.message("No faces detected"); return; }
      const out = detected.map((d) => ({ match: findBestMatch(d.descriptor, candidates), box: d.box }));
      setResults(out);
      const matches = out.filter((r) => r.match).map((r) => r.match!);
      const camera = cameras.find((c) => c.id === cameraId) ?? null;
      for (const m of matches) {
        await raiseAlert(m, { sourceLabel: "Upload scan", camera, personnel, user });
      }
      if (matches.length > 0) toast.success(`${matches.length} match(es) — alert(s) raised`);
      else toast.message("No enrolled personnel matched");
    } catch (e: any) {
      toast.error(e?.message ?? "Scan failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="space-y-4">
      {error && <div className="text-sm text-destructive">Models failed to load: {error}</div>}
      <div className="flex flex-wrap items-center gap-4">
        <CameraPicker cameras={cameras} value={cameraId} onChange={setCameraId} />
        <input type="file" accept="image/*" disabled={!ready || busy}
          onChange={(e) => e.target.files?.[0] && scan(e.target.files[0])}
          className="text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground" />
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <span className="text-xs text-muted-foreground ml-auto">{candidates.length} enrolled in database</span>
      </div>
      {preview && (
        <div className="relative inline-block max-w-full">
          <img ref={imgRef} src={preview} alt="scan" className="max-h-[480px] rounded-md border border-border" />
          {imgRef.current && results.map((r, i) => {
            const scale = imgRef.current!.clientWidth / imgRef.current!.naturalWidth;
            const box = r.box;
            return (
              <div key={i} style={{
                position: "absolute",
                left: box.x * scale, top: box.y * scale,
                width: box.width * scale, height: box.height * scale,
                outline: `2px solid ${r.match ? "hsl(var(--primary))" : "hsl(var(--destructive))"}`,
              }}>
                <span className="absolute -top-6 left-0 whitespace-nowrap rounded bg-background/90 border border-border px-1.5 py-0.5 text-[10px]">
                  {r.match ? `${r.match.candidate.personnelName} (${(r.match.confidence * 100).toFixed(0)}%)` : "Unknown"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ============ LIVE SCAN TAB ============ */

function LiveScanPanel({
  candidates, user, cameras, personnel,
}: { candidates: Candidate[]; user: string; cameras: Camera[]; personnel: Personnel[] }) {
  const [cameraId, setCameraId] = useState("");
  const { ready, error } = useFaceModels();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [running, setRunning] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [intervalSec, setIntervalSec] = useState(3);
  const [log, setLog] = useState<{ at: string; text: string; matched: boolean }[]>([]);
  const recentRef = useRef<Map<string, number>>(new Map()); // personnelId -> ms timestamp (dedupe)
  const COOLDOWN_MS = 60_000;

  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      // Auto-restart if any track ends unexpectedly (device sleep, cable pull, browser throttling)
      s.getTracks().forEach((t) => {
        t.addEventListener("ended", () => {
          setRunning(false);
          setStream(null);
          setTimeout(() => { start().catch(() => undefined); }, 1500);
        });
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => undefined);
      }
      setRunning(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Camera access denied — retrying…");
      setTimeout(() => { start().catch(() => undefined); }, 5000);
    }
  };

  // Auto-start the CCTV feed as soon as models are ready and keep it running.
  useEffect(() => {
    if (ready && !running && !stream) {
      start().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keep the video element bound to the active stream across re-renders.
  useEffect(() => {
    if (videoRef.current && stream && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => undefined);
    }
  }, [stream]);

  // Resume playback if the browser pauses the video (tab backgrounded, focus loss).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const resume = () => { v.play().catch(() => undefined); };
    v.addEventListener("pause", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      v.removeEventListener("pause", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [stream]);

  // 24/7 watchdog: keeps the screen awake and force-restarts a dead/frozen feed.
  useEffect(() => {
    let cancelled = false;
    let sentinel: any = null;

    const acquireWakeLock = async () => {
      try {
        const nav: any = navigator;
        if (nav.wakeLock?.request) {
          sentinel = await nav.wakeLock.request("screen");
          sentinel.addEventListener?.("release", () => {
            if (!cancelled && document.visibilityState === "visible") acquireWakeLock();
          });
        }
      } catch {/* wake lock unsupported — watchdog still runs */}
    };
    acquireWakeLock();
    const onVisible = () => { if (document.visibilityState === "visible") acquireWakeLock(); };
    document.addEventListener("visibilitychange", onVisible);

    let lastFrameTime = 0;
    let stalls = 0;
    const watchdog = window.setInterval(() => {
      if (cancelled) return;
      const v = videoRef.current;
      const live = stream?.getVideoTracks().some((t) => t.readyState === "live" && t.enabled);

      if (!stream || !live) {
        setRunning(false);
        setStream(null);
        start().catch(() => undefined);
        return;
      }
      if (v) {
        if (v.paused || v.ended) v.play().catch(() => undefined);
        const t = v.currentTime;
        if (t === lastFrameTime) {
          stalls += 1;
          if (stalls >= 3) { // ~15s frozen → hard restart
            stalls = 0;
            stream.getTracks().forEach((tr) => tr.stop());
            setRunning(false);
            setStream(null);
            start().catch(() => undefined);
          }
        } else {
          stalls = 0;
          lastFrameTime = t;
        }
      }
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
      try { sentinel?.release?.(); } catch {/* noop */}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  useEffect(() => {
    if (!running || !ready) return;
    let active = true;
    const tick = async () => {
      if (!active || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const detected = await detectAllDescriptors(videoRef.current);
        for (const d of detected) {
          const m = findBestMatch(d.descriptor, candidates);
          if (m) {
            const last = recentRef.current.get(m.candidate.personnelId) ?? 0;
            const now = Date.now();
            if (now - last > COOLDOWN_MS) {
              recentRef.current.set(m.candidate.personnelId, now);
              setLog((l) => [{ at: new Date().toLocaleTimeString(), text: `Match: ${m.candidate.personnelName} (${(m.confidence * 100).toFixed(0)}%)`, matched: true }, ...l].slice(0, 20));
              const camera = cameras.find((c) => c.id === cameraId) ?? null;
              raiseAlert(m, { sourceLabel: "Live webcam", camera, personnel, user }).catch(() => undefined);
            }
          } else if (detected.length > 0) {
            setLog((l) => [{ at: new Date().toLocaleTimeString(), text: `Unknown face detected`, matched: false }, ...l].slice(0, 20));
          }
        }
      } catch {/* swallow per-frame errors */}
    };
    const id = window.setInterval(tick, Math.max(1, intervalSec) * 1000);
    tick();
    return () => { active = false; window.clearInterval(id); };
  }, [running, ready, candidates, intervalSec, user]);

  return (
    <Panel className="space-y-4">
      {error && <div className="text-sm text-destructive">Models failed to load: {error}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <span className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${running ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground border border-border"}`}>
          <Video className="h-4 w-4" />
          {running ? "CCTV live · continuous" : ready ? "Starting feed…" : "Loading models…"}
          {running && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />}
        </span>
        <label className="text-sm flex items-center gap-2">
          <span className="text-muted-foreground">Scan every</span>
          <input type="number" min={1} max={30} value={intervalSec} onChange={(e) => setIntervalSec(Number(e.target.value))}
            className="w-16 rounded-md border border-input bg-background px-2 py-1" />
          <span className="text-muted-foreground">sec</span>
        </label>
        <CameraPicker cameras={cameras} value={cameraId} onChange={setCameraId} />
        <span className="ml-auto text-xs text-muted-foreground">{candidates.length} enrolled · threshold {MATCH_THRESHOLD}</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="relative bg-black/40 rounded-md overflow-hidden border border-border aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          {!running && (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              Initialising CCTV feed…
            </div>
          )}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Activity</div>
          <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
            {log.length === 0 && <div className="text-xs text-muted-foreground">No detections yet.</div>}
            {log.map((l, i) => (
              <div key={i} className={`text-xs rounded border px-2 py-1.5 ${l.matched ? "border-primary/40 bg-primary/5" : "border-border bg-card"}`}>
                <span className="font-mono text-muted-foreground mr-2">{l.at}</span>
                {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

/* ============ ENROLLMENTS LIST TAB ============ */

function EnrollmentsList({ enrollments, isLoading, onDelete, canManage }: {
  enrollments: FaceEnrollment[]; isLoading: boolean; onDelete: (id: string) => void; canManage: boolean;
}) {
  if (isLoading) return <LoadingSkeleton rows={4} />;
  if (enrollments.length === 0) {
    return <Panel><div className="text-sm text-muted-foreground text-center py-8">No personnel have been enrolled yet.</div></Panel>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {enrollments.map((e) => (
        <div key={e.id} className="rounded-lg border border-border bg-card p-3 flex gap-3">
          {e.thumbnail
            ? <img src={e.thumbnail} alt={e.personnel_name} className="h-16 w-16 rounded-md object-cover border border-border" />
            : <div className="h-16 w-16 rounded-md bg-primary/10 text-primary grid place-items-center"><ScanFace className="h-6 w-6" /></div>}
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{e.personnel_name}</div>
            <div className="text-xs text-muted-foreground font-mono truncate">ID {e.personnel_id}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Enrolled {new Date(e.created_at).toLocaleDateString()}</div>
          </div>
          {canManage && (
            <button onClick={() => { if (confirm(`Remove enrollment for ${e.personnel_name}?`)) onDelete(e.id); }}
              className="self-start rounded p-1.5 text-destructive hover:bg-destructive/10" aria-label="Remove">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ============ PAGE ============ */

function Page() {
  const qc = useQueryClient();
  const { user, hasRole } = useAuth();
  const canManage = hasRole("Administrator", "Supervisor");
  const [tab, setTab] = useState<Tab>("live");

  const personnelQ = useQuery({ queryKey: ["personnel"], queryFn: personnelService.list });
  const camerasQ = useQuery({ queryKey: ["cameras"], queryFn: cameraService.list });
  const enrollQ = useQuery({ queryKey: ["face_enrollments"], queryFn: faceEnrollmentService.list });
  const candidates = useCandidates(enrollQ.data ?? []);

  const remove = useMutation({
    mutationFn: faceEnrollmentService.remove,
    onSuccess: () => { toast.success("Enrollment removed"); qc.invalidateQueries({ queryKey: ["face_enrollments"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const TABS: { id: Tab; label: string; icon: any; show?: boolean }[] = [
    { id: "live", label: "Live recognition", icon: Video },
    { id: "upload", label: "Scan image", icon: Upload },
    { id: "enroll", label: "Enroll face", icon: UserCheck, show: canManage },
    { id: "enrollments", label: `Enrollments (${enrollQ.data?.length ?? 0})`, icon: ScanFace },
  ];

  return (
    <>
      <PageHeader
        title="CCTV Facial Recognition"
        description="Detect wanted suspects, missing persons and surveillance subjects from CCTV feeds or uploaded stills. Alert priority is derived from each subject's category and threat level."
      />
      {candidates.length === 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          No subjects enrolled yet. {canManage ? "Use the Enroll tab to add reference faces from the Persons of Interest registry." : "Ask a Supervisor to enroll subjects."}
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.filter((t) => t.show !== false).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "live" && <LiveScanPanel candidates={candidates} user={user?.name ?? "operator"} cameras={camerasQ.data ?? []} personnel={personnelQ.data ?? []} />}
      {tab === "upload" && <UploadScanPanel candidates={candidates} user={user?.name ?? "operator"} cameras={camerasQ.data ?? []} personnel={personnelQ.data ?? []} />}
      {tab === "enroll" && canManage && (
        <EnrollPanel personnel={personnelQ.data ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["face_enrollments"] })} />
      )}
      {tab === "enrollments" && (
        <EnrollmentsList
          enrollments={enrollQ.data ?? []}
          isLoading={enrollQ.isLoading}
          onDelete={(id) => remove.mutate(id)}
          canManage={canManage}
        />
      )}
      {!canManage && tab === "enroll" && (
        <Panel><div className="text-sm text-muted-foreground">Only Administrators and Supervisors can enroll personnel.</div></Panel>
      )}

      <div className="mt-6 text-xs text-muted-foreground">
        Recognition runs entirely in your browser using face-api.js. Reference descriptors are stored in the secure backend, never raw photos beyond a small thumbnail.
      </div>
    </>
  );
}

export const Route = createFileRoute("/_app/recognition")({ component: Page });
