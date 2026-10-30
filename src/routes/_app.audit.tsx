import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { auditService } from "@/services/resources";
import { DataTable } from "@/components/common/DataTable";
import { PageHeader, LoadingSkeleton } from "@/components/common/Primitives";
import { Search } from "lucide-react";

function Page() {
  const { data = [], isLoading } = useQuery({ queryKey: ["audit"], queryFn: auditService.list });
  const [search, setSearch] = useState("");

  return (
    <>
      <PageHeader title="Audit Log" description="Immutable trail of user activity across HAWKTRACE." />
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search audit entries…"
          className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>
      {isLoading ? <LoadingSkeleton rows={10} /> : (
        <DataTable data={data} search={search} pageSize={15} columns={[
          { key: "timestamp", header: "Time", sortable: true, render: (r) => <span className="font-mono text-xs">{new Date(r.timestamp).toLocaleString()}</span> },
          { key: "user", header: "User", sortable: true },
          { key: "action", header: "Action", sortable: true, render: (r) => <span className="font-mono text-xs">{r.action}</span> },
          { key: "module", header: "Module", sortable: true },
          { key: "recordId", header: "Record ID", className: "font-mono text-xs" },
          { key: "ipAddress", header: "IP Address", className: "font-mono text-xs" },
        ]} />
      )}
    </>
  );
}

export const Route = createFileRoute("/_app/audit")({ component: Page });
