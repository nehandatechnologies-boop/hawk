import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, CheckCheck, Filter } from "lucide-react";
import { alertService } from "@/services/resources";
import { PageHeader, StatusPill, LoadingSkeleton, Panel } from "@/components/common/Primitives";
import type { AlertPriority, AlertStatus } from "@/types";

const PRIORITIES: AlertPriority[] = ["Critical","High","Medium","Low"];
const STATUSES: AlertStatus[] = ["Open","Acknowledged","Resolved","Closed"];

function Page() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["alerts"], queryFn: alertService.list });
  const [priority, setPriority] = useState<AlertPriority | "All">("All");
  const [status, setStatus] = useState<AlertStatus | "All">("All");

  const ack = useMutation({
    mutationFn: (id: string) => alertService.acknowledge(id),
    onSuccess: () => { toast.success("Alert acknowledged"); qc.invalidateQueries({ queryKey: ["alerts"] }); },
  });
  const res = useMutation({
    mutationFn: (id: string) => alertService.resolve(id),
    onSuccess: () => { toast.success("Alert resolved"); qc.invalidateQueries({ queryKey: ["alerts"] }); },
  });

  const filtered = data.filter((a) =>
    (priority === "All" || a.priority === priority) &&
    (status === "All" || a.status === status),
  );

  return (
    <>
      <PageHeader title="Sighting Alerts" description="Triage CCTV facial-recognition sightings of wanted, missing and surveillance subjects." />
      <Panel className="mb-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Priority</span>
            <select value={priority} onChange={(e) => setPriority(e.target.value as any)}
              className="rounded-md border border-input bg-card px-2 py-1 text-sm">
              <option>All</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)}
              className="rounded-md border border-input bg-card px-2 py-1 text-sm">
              <option>All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} alerts</span>
        </div>
      </Panel>

      {isLoading ? <LoadingSkeleton rows={8} /> : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium">{a.title}</h3>
                    <StatusPill status={a.priority} />
                    <StatusPill status={a.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{a.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground font-mono">
                    <span>Source: {a.source}</span>
                    <span>{new Date(a.timestamp).toLocaleString()}</span>
                    {a.assignedOfficer && <span>Assigned: {a.assignedOfficer}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {a.status === "Open" && (
                    <button onClick={() => ack.mutate(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent">
                      <Check className="h-3.5 w-3.5" /> Acknowledge
                    </button>
                  )}
                  {(a.status === "Open" || a.status === "Acknowledged") && (
                    <button onClick={() => res.mutate(a.id)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
                      <CheckCheck className="h-3.5 w-3.5" /> Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="text-sm text-muted-foreground text-center py-12">No alerts match the current filters.</div>}
        </div>
      )}
    </>
  );
}

export const Route = createFileRoute("/_app/alerts")({ component: Page });
