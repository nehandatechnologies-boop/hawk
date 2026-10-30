import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import type { AlertPriority, SecurityAlert } from "@/types";

const PRIORITY_COLOR: Record<AlertPriority, string> = {
  Critical: "#ef4444",
  High: "#f59e0b",
  Medium: "#3b82f6",
  Low: "#64748b",
};
const PRIORITY_RADIUS: Record<AlertPriority, number> = {
  Critical: 16,
  High: 14,
  Medium: 12,
  Low: 10,
};

type GeoAlert = SecurityAlert & { latitude: number; longitude: number };

interface Props {
  alerts: GeoAlert[];
  pulseId?: string | null;
}

/**
 * Renders detection markers into a leaflet.markercluster group so nearby
 * hits collapse into a numeric cluster badge and expand on zoom/click.
 * Cluster color is driven by the highest-priority alert inside it, so a
 * cluster containing a Critical hit stays red at any zoom level.
 */
export function DetectionClusterLayer({ alerts, pulseId }: Props) {
  const map = useMap();

  useEffect(() => {
    const priorityRank: Record<AlertPriority, number> = {
      Critical: 4, High: 3, Medium: 2, Low: 1,
    };

    const cluster = (L as any).markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c: any) => {
        const markers = c.getAllChildMarkers() as Array<L.Marker & { _priority?: AlertPriority }>;
        let top: AlertPriority = "Low";
        for (const m of markers) {
          const p = m._priority ?? "Low";
          if (priorityRank[p] > priorityRank[top]) top = p;
        }
        const color = PRIORITY_COLOR[top];
        const count = c.getChildCount();
        const size = count >= 100 ? 52 : count >= 10 ? 44 : 36;
        return L.divIcon({
          html: `<div style="
              display:flex;align-items:center;justify-content:center;
              width:${size}px;height:${size}px;border-radius:9999px;
              background:${color};color:#fff;font-weight:700;font-size:12px;
              border:3px solid rgba(255,255,255,.85);
              box-shadow:0 0 0 4px ${color}33, 0 2px 8px rgba(0,0,0,.5);
            ">${count}</div>`,
          className: "ht-cluster",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      },
    });

    for (const a of alerts) {
      const color = PRIORITY_COLOR[a.priority];
      const r = PRIORITY_RADIUS[a.priority];
      const isPulse = a.id === pulseId;
      const ring = isPulse
        ? `<span style="position:absolute;inset:-8px;border-radius:9999px;border:2px solid ${color};
             animation:ht-pulse 1.6s ease-out infinite;"></span>`
        : "";
      const icon = L.divIcon({
        html: `<div style="position:relative;width:${r}px;height:${r}px;">
                 ${ring}
                 <span style="position:absolute;inset:0;border-radius:9999px;background:${color};
                              border:2px solid rgba(255,255,255,.9);
                              box-shadow:0 2px 6px rgba(0,0,0,.4);"></span>
               </div>`,
        className: "ht-detection",
        iconSize: [r, r],
        iconAnchor: [r / 2, r / 2],
      });
      const marker = L.marker([a.latitude, a.longitude], { icon }) as L.Marker & {
        _priority?: AlertPriority;
      };
      marker._priority = a.priority;
      marker.bindTooltip(
        `<span style="font-weight:600">${a.priority} · ${escapeHtml(a.title)}</span>`,
        { direction: "top", offset: [0, -4], opacity: 1 },
      );
      const confLine = typeof a.confidence === "number"
        ? `<div>Confidence: ${Math.round(a.confidence * 100)}%</div>` : "";
      marker.bindPopup(`
        <div style="font-size:12px;min-width:200px;line-height:1.4">
          <div style="font-weight:600">${escapeHtml(a.title)}</div>
          <div style="color:#94a3b8">${escapeHtml(a.source ?? "")}</div>
          <div>Priority: <b style="color:${color}">${a.priority}</b></div>
          <div>Status: ${escapeHtml(a.status)}</div>
          ${confLine}
          <div style="color:#94a3b8">${new Date(a.timestamp).toLocaleString()}</div>
        </div>`);
      cluster.addLayer(marker);
    }

    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map, alerts, pulseId]);

  return null;
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
