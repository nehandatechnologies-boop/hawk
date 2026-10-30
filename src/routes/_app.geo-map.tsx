import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Popup, LayersControl, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { alertService, cameraService } from "@/services/resources";
import { useRealtimeAlerts } from "@/hooks/useRealtimeAlerts";
import { PageHeader, StatCard, StatusPill } from "@/components/common/Primitives";
import { DetectionClusterLayer } from "@/components/map/DetectionClusterLayer";
import { Radar, MapPin, Camera as CameraIcon, AlertTriangle } from "lucide-react";
import type { AlertPriority, SecurityAlert } from "@/types";

// Fix default marker asset paths for bundlers
const cameraIcon = L.divIcon({
  html: `<div style="background:hsl(var(--card));border:2px solid hsl(var(--primary));border-radius:4px;padding:2px 4px;font-size:10px;color:hsl(var(--foreground));white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.4)">CAM</div>`,
  className: "",
  iconSize: [30, 18],
  iconAnchor: [15, 9],
});

const PRIORITY_COLOR: Record<AlertPriority, string> = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#3b82f6",
  Low: "#64748b",
};
const PRIORITY_RADIUS: Record<AlertPriority, number> = {
  Critical: 14,
  High: 11,
  Medium: 8,
  Low: 6,
};

function hasCoords<T extends { latitude?: number | null; longitude?: number | null }>(
  r: T,
): r is T & { latitude: number; longitude: number } {
  return typeof r.latitude === "number" && typeof r.longitude === "number" &&
    !Number.isNaN(r.latitude) && !Number.isNaN(r.longitude);
}

function Page() {
  // Live push: any new alert row invalidates the query below.
  useRealtimeAlerts({ toastOnInsert: true });

  const { data: alerts = [] } = useQuery({ queryKey: ["alerts"], queryFn: alertService.list });
  const { data: cameras = [] } = useQuery({ queryKey: ["cameras"], queryFn: cameraService.list });

  const [priorityFilter, setPriorityFilter] = useState<AlertPriority | "All">("All");
  const [windowHours, setWindowHours] = useState<number>(24);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const cutoff = useMemo(() => Date.now() - windowHours * 3600_000, [windowHours]);

  const geoAlerts = useMemo(
    () =>
      alerts
        .filter(hasCoords)
        .filter((a) => (priorityFilter === "All" ? true : a.priority === priorityFilter))
        .filter((a) => new Date(a.timestamp).getTime() >= cutoff),
    [alerts, priorityFilter, cutoff],
  );

  const geoCameras = useMemo(() => cameras.filter(hasCoords), [cameras]);

  // Pulse the newest alert for a moment when it arrives.
  useEffect(() => {
    if (!geoAlerts.length) return;
    const newest = [...geoAlerts].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];
    setPulseId(newest.id);
    const t = setTimeout(() => setPulseId(null), 4000);
    return () => clearTimeout(t);
  }, [geoAlerts.length]);

  // Center: newest alert → first camera → Harare fallback.
  const center: [number, number] = useMemo(() => {
    if (geoAlerts.length) return [geoAlerts[0].latitude, geoAlerts[0].longitude];
    if (geoCameras.length) return [geoCameras[0].latitude, geoCameras[0].longitude];
    return [-17.8252, 31.0335];
  }, [geoAlerts, geoCameras]);

  const critical = geoAlerts.filter((a) => a.priority === "Critical").length;
  const high = geoAlerts.filter((a) => a.priority === "High").length;

  return (
    <>
      <PageHeader
        title="Geo-Map Tracking"
        description="Real-time spatial view of every detection. Alerts pulse the moment a match hits the network."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Plotted detections" value={geoAlerts.length} icon={<Radar className="h-4 w-4" />} />
        <StatCard label="Critical" value={critical} icon={<AlertTriangle className="h-4 w-4" />} tone="danger" />
        <StatCard label="High" value={high} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
        <StatCard label="Geolocated cameras" value={geoCameras.length} icon={<CameraIcon className="h-4 w-4" />} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">Priority</span>
        {(["All", "Critical", "High", "Medium", "Low"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
              priorityFilter === p
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
        <span className="text-xs uppercase tracking-wider text-muted-foreground ml-4 mr-1">Window</span>
        {[1, 6, 24, 72, 168].map((h) => (
          <button
            key={h}
            onClick={() => setWindowHours(h)}
            className={`rounded-md border px-2.5 py-1 text-xs transition ${
              windowHours === h
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {h < 24 ? `${h}h` : `${h / 24}d`}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg overflow-hidden border border-border bg-card" style={{ height: "70vh" }}>
          <MapContainer
            center={center}
            zoom={12}
            scrollWheelZoom
            className="h-full w-full"
            style={{ background: "hsl(var(--muted))" }}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Dark">
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite">
                <TileLayer
                  attribution="Tiles &copy; Esri"
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Streets">
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
            </LayersControl>

            {geoCameras.map((c) => (
              <Marker key={c.id} position={[c.latitude, c.longitude]} icon={cameraIcon}>
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-muted-foreground">{c.location} · {c.building}</div>
                    <div className="mt-1">Status: {c.status}</div>
                  </div>
                </Popup>
              </Marker>
            ))}

            <DetectionClusterLayer alerts={geoAlerts} pulseId={pulseId} />
          </MapContainer>
        </div>

        <aside className="rounded-lg border border-border bg-card p-3 flex flex-col" style={{ height: "70vh" }}>
          <div className="mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Live detections</span>
            <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
              {geoAlerts.length} shown
            </span>
          </div>
          <div className="overflow-y-auto scrollbar-thin flex-1 space-y-2 pr-1">
            {geoAlerts.length === 0 && (
              <div className="text-xs text-muted-foreground p-3">
                No geolocated detections in the selected window. Add latitude / longitude to cameras
                so their sightings appear on the map.
              </div>
            )}
            {[...geoAlerts]
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
              .slice(0, 40)
              .map((a: SecurityAlert & { latitude: number; longitude: number }) => (
                <div
                  key={a.id}
                  className={`rounded-md border p-2 text-xs transition ${
                    a.id === pulseId ? "border-primary/70 bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: PRIORITY_COLOR[a.priority] }}
                    />
                    <span className="font-medium truncate flex-1">{a.title}</span>
                    <StatusPill status={a.priority} />
                  </div>
                  <div className="text-muted-foreground mt-1 font-mono">
                    {a.latitude.toFixed(4)}, {a.longitude.toFixed(4)}
                  </div>
                  <div className="text-muted-foreground">
                    {new Date(a.timestamp).toLocaleTimeString()} · {a.source}
                  </div>
                </div>
              ))}
          </div>
        </aside>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_app/geo-map")({ component: Page });
