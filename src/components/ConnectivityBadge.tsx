import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudOff, RefreshCw, Wifi } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConnectivity } from "@/lib/offline/useConnectivity";
import { flushOutbox, outboxSize } from "@/lib/offline/outbox";

/**
 * Link-state badge for the console header: Live · Offline · Syncing.
 * On reconnect it replays any sightings captured while off-network.
 */
export function ConnectivityBadge() {
  const link = useConnectivity();
  const qc = useQueryClient();
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const sync = () => setQueued(outboxSize());
    sync();
    window.addEventListener("hawktrace-outbox-change", sync);
    return () => window.removeEventListener("hawktrace-outbox-change", sync);
  }, []);

  useEffect(() => {
    if (link !== "live") return;
    if (outboxSize() === 0) return;
    setSyncing(true);
    void flushOutbox()
      .then((sent) => {
        setQueued(outboxSize());
        if (sent > 0) {
          toast.success(`Synced ${sent} offline sighting${sent === 1 ? "" : "s"}`);
          qc.invalidateQueries({ queryKey: ["alerts"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });
        }
      })
      .finally(() => setSyncing(false));
  }, [link, qc]);

  const state = syncing ? "syncing" : link;
  const label =
    state === "syncing"
      ? `Syncing${queued ? ` · ${queued}` : ""}`
      : state === "offline"
        ? `Offline${queued ? ` · ${queued} queued` : ""}`
        : state === "checking"
          ? "Linking…"
          : "Live";

  return (
    <div
      className={cn(
        "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium sm:flex",
        state === "offline"
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : state === "syncing"
            ? "border-warning/50 bg-warning/10 text-warning"
            : "border-primary/40 bg-primary/10 text-primary",
      )}
      title={
        state === "offline"
          ? "Off-network — cached intel is readable and new sightings are queued locally."
          : "Connected to the HAWKTRACE cloud."
      }
    >
      {state === "offline" ? (
        <CloudOff className="h-3.5 w-3.5" />
      ) : state === "syncing" ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Wifi className="h-3.5 w-3.5" />
      )}
      <span>{label}</span>
    </div>
  );
}
