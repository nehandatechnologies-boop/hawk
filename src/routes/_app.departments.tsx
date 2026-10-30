import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { ResourceCrudPage } from "@/components/common/ResourceCrudPage";
import { Panel } from "@/components/common/Primitives";
import { departmentService } from "@/services/resources";
import type { Department } from "@/types";

function Page() {
  return (
    <>
      <Panel className="mb-4 flex items-start gap-3 border-primary/30 bg-primary/5">
        <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <div className="font-medium text-foreground mb-0.5">Issuing Agencies & Law Enforcement Units</div>
          Register every partner agency, investigative unit or field detachment that files subjects
          into HAWKTRACE. New agencies appear immediately as options when creating a Person of Interest.
        </div>
      </Panel>
      <ResourceCrudPage<Department>
        title="Issuing Agencies & Units"
        description="Police units, intelligence desks, NGOs and partner agencies authorised to file subjects."
        resource="departments"
        fetcher={departmentService.list}
        creator={departmentService.create as any}
        updater={departmentService.update as any}
        remover={departmentService.remove}
        columns={[
          { key: "code", header: "Code", sortable: true, className: "font-mono text-xs" },
          { key: "name", header: "Agency / Unit", sortable: true, render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "head", header: "Commanding Officer", sortable: true },
          { key: "headcount", header: "Personnel", sortable: true, className: "text-right" },
        ]}
        fields={[
          { name: "code", label: "Short code (e.g. ZRP-CID-HRE)", required: true },
          { name: "name", label: "Full agency / unit name", required: true },
          { name: "head", label: "Commanding officer / liaison", required: true },
          { name: "headcount", label: "Assigned personnel count", required: true },
        ]}
      />
    </>
  );
}

export const Route = createFileRoute("/_app/departments")({ component: Page });
