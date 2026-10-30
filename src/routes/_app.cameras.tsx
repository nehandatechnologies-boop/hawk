import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ResourceCrudPage } from "@/components/common/ResourceCrudPage";
import { StatusPill, StatCard } from "@/components/common/Primitives";
import { cameraService } from "@/services/resources";
import type { Camera } from "@/types";
import { Camera as CameraIcon, Wifi, WifiOff, Activity } from "lucide-react";

const STATUSES = ["Online","Offline","Degraded"];

function Page() {
  const { data = [] } = useQuery({ queryKey: ["cameras"], queryFn: cameraService.list });
  const online = data.filter((c) => c.status === "Online").length;
  const offline = data.filter((c) => c.status === "Offline").length;
  const degraded = data.filter((c) => c.status === "Degraded").length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Cameras" value={data.length} icon={<CameraIcon className="h-4 w-4" />} />
        <StatCard label="Online" value={online} icon={<Wifi className="h-4 w-4" />} tone="success" />
        <StatCard label="Degraded" value={degraded} icon={<Activity className="h-4 w-4" />} tone="warning" />
        <StatCard label="Offline" value={offline} icon={<WifiOff className="h-4 w-4" />} tone="danger" />
      </div>
      <ResourceCrudPage<Camera>
        title="Cameras"
        description="Camera inventory, health and live-stream configuration."
        resource="cameras"
        fetcher={cameraService.list}
        creator={cameraService.create as any}
        updater={cameraService.update as any}
        remover={cameraService.remove}
        bulkRemover={cameraService.bulkRemove}
        columns={[
          { key: "name", header: "Camera", sortable: true, className: "font-mono text-xs", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "building", header: "Building", sortable: true },
          { key: "floor", header: "Floor" },
          { key: "location", header: "Location", sortable: true },
          { key: "resolution", header: "Resolution" },
          { key: "lastHeartbeat", header: "Heartbeat",
            render: (r) => <span className="text-xs text-muted-foreground font-mono">{new Date(r.lastHeartbeat).toLocaleTimeString()}</span> },
          { key: "status", header: "Status", sortable: true, render: (r) => <StatusPill status={r.status} /> },
        ]}
        fields={[
          { name: "name", label: "Camera Name", required: true },
          { name: "location", label: "Location", required: true },
          { name: "building", label: "Building", required: true },
          { name: "floor", label: "Floor", required: true },
          { name: "rtspUrl", label: "RTSP Stream URL", required: true },
          { name: "resolution", label: "Resolution", required: true },
          { name: "latitude", label: "Latitude (map, e.g. -20.0637)", type: "text" },
          { name: "longitude", label: "Longitude (map, e.g. 30.8277)", type: "text" },
          { name: "status", label: "Status", type: "select", options: STATUSES, required: true },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        defaults={{ status: "Online", lastHeartbeat: new Date().toISOString() }}
      />
    </>
  );
}

export const Route = createFileRoute("/_app/cameras")({ component: Page });
