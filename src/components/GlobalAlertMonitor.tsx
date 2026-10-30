import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  announceAlert,
  isAudioUnlocked,
  onAudioUnlockChange,
  unlockAlertAudio,
} from "@/lib/alertAudio";
import {
  notificationPermission,
  requestNotificationPermission,
  showAlertNotification,
} from "@/lib/pushClient";

type Priority = "Critical" | "High" | "Medium" | "Low";

/**
 * Mount once at the app shell. Subscribes to realtime alert INSERTs,
 * invalidates dependent queries, raises toasts, plays a priority tone
 * + spoken details, AND fires an OS-level notification so an operator
 * away from the screen still reacts.
 *
 * Renders a tiny unlock button because browsers refuse to play audio or
 * show notifications until the user gestures.
 */
export function GlobalAlertMonitor() {
  const qc = useQueryClient();
  const [unlocked, setUnlocked] = useState<boolean>(false);

  useEffect(() => {
    setUnlocked(isAudioUnlocked() && notificationPermission() !== "default");
    const off = onAudioUnlockChange((v) =>
      setUnlocked(v && notificationPermission() !== "default"),
    );
    return () => {
      off();
    };
  }, []);




  useEffect(() => {
    const topic = `hawktrace-global-alerts-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["alerts"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });

          if (payload.eventType !== "INSERT") return;

          const row = payload.new as {
            title?: string;
            priority?: Priority;
            location?: string;
            camera_name?: string;
            subject_name?: string;
          };
          const priority = (row.priority ?? "Medium") as Priority;
          const severity = priority.toUpperCase();

          const fn =
            priority === "Critical"
              ? toast.error
              : priority === "High"
                ? toast.warning
                : toast.info;
          fn(`[${severity}] ${row.title ?? "New sighting alert"}`, {
            description:
              row.subject_name && row.camera_name
                ? `${row.subject_name} · ${row.camera_name}`
                : (row.location ?? row.camera_name ?? undefined),
            duration: 9000,
          });

          announceAlert({
            priority,
            subjectName: row.subject_name,
            cameraName: row.camera_name,
            location: row.location,
            title: row.title,
          });

          showAlertNotification({
            priority,
            title: row.subject_name?.trim() || row.title || "Sighting match",
            body: `Detected at ${row.camera_name?.trim() || row.location?.trim() || "unknown location"}`,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  if (unlocked) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await unlockAlertAudio();
        const perm = await requestNotificationPermission();
        setUnlocked(ok && perm !== "default");
        if (ok) {
          toast.success("Alert audio enabled", {
            description:
              perm === "granted"
                ? "Tone, spoken details and desktop notifications are live."
                : "You'll hear a tone and spoken details on every match.",
          });
        } else {
          toast.error("Could not enable alert audio in this browser.");
        }
      }}

      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-primary/50 bg-card px-3 py-2 text-xs font-medium text-primary shadow-lg hover:bg-primary/10"
      aria-label="Enable alert audio"
      title="Enable 24/7 alert audio"
    >
      <VolumeX className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Enable alert audio</span>
      <Volume2 className="h-3.5 w-3.5" />
    </button>
  );
}
