import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribe to the Lovable Cloud `alerts` table and invalidate any alert /
 * dashboard queries whenever a row changes. Optionally raise a toast for new
 * inserts so operators see detections instantly.
 */
export function useRealtimeAlerts(opts: { toastOnInsert?: boolean } = {}) {
  const qc = useQueryClient();

  useEffect(() => {
    const topic = `alerts-realtime-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["alerts"] });
          qc.invalidateQueries({ queryKey: ["dashboard"] });

          if (opts.toastOnInsert && payload.eventType === "INSERT") {
            const row = payload.new as {
              title?: string;
              priority?: string;
              location?: string;
            };
            const severity = (row.priority ?? "Medium").toUpperCase();
            const fn =
              row.priority === "Critical"
                ? toast.error
                : row.priority === "High"
                  ? toast.warning
                  : toast.info;
            fn(`[${severity}] ${row.title ?? "New sighting alert"}`, {
              description: row.location ?? undefined,
              duration: 8000,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, opts.toastOnInsert]);
}

