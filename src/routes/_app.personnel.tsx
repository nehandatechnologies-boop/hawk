import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ResourceCrudPage } from "@/components/common/ResourceCrudPage";
import { StatusPill } from "@/components/common/Primitives";
import { personnelService, departmentService } from "@/services/resources";
import type { Personnel } from "@/types";

const FALLBACK_AGENCIES = [
  "ZRP CID — Harare",
  "ZRP CID — Bulawayo",
  "Interpol NCB Harare",
  "Missing Persons Unit",
  "Counter-Terror Desk",
  "Field Response",
];
const CATEGORIES = ["Wanted", "Missing", "Person of Interest", "Cleared"];
const DANGER_LEVELS = ["Armed & Dangerous", "Caution", "Non-violent", "Unknown"];
const STATUSES = ["Active", "Inactive", "Located", "Apprehended", "Archived"];
const GENDERS = ["Male", "Female", "Other", "Unknown"];

function CategoryPill({ category }: { category?: string }) {
  const colour =
    category === "Wanted"  ? "bg-destructive/15 text-destructive border-destructive/30"
    : category === "Missing" ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : category === "Cleared" ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
    : "bg-primary/10 text-primary border-primary/30";
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${colour}`}>
      {category ?? "POI"}
    </span>
  );
}

function Page() {
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: departmentService.list,
  });
  const agencyOptions = departments.length > 0
    ? departments.map((d) => d.name)
    : FALLBACK_AGENCIES;

  return (
    <ResourceCrudPage<Personnel>
      title="Persons of Interest"
      description="Master registry of wanted suspects, missing persons and surveillance subjects."
      resource="personnel"
      fetcher={personnelService.list}
      creator={personnelService.create as any}
      updater={personnelService.update as any}
      remover={personnelService.remove}
      bulkRemover={personnelService.bulkRemove}
      columns={[
        { key: "employeeNumber", header: "Case #", sortable: true, className: "font-mono text-xs" },
        {
          key: "name",
          header: "Subject",
          sortable: true,
          accessor: (r) => `${r.firstName} ${r.lastName}`,
          render: (r) => (
            <div className="flex items-center gap-2">
              {r.photoUrl
                ? <img src={r.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover border border-border" />
                : <div className="h-8 w-8 rounded-full bg-primary/15 text-primary grid place-items-center text-[11px] font-semibold">{r.firstName[0]}{r.lastName[0]}</div>}
              <div className="min-w-0">
                <div className="font-medium truncate">{r.firstName} {r.lastName}</div>
                <div className="text-[11px] text-muted-foreground truncate">{r.position}</div>
              </div>
            </div>
          ),
        },
        { key: "category", header: "Category", sortable: true, render: (r) => <CategoryPill category={r.category} /> },
        { key: "dangerLevel", header: "Threat", sortable: true, render: (r) => (
          <span className={r.dangerLevel === "Armed & Dangerous" ? "text-destructive font-medium" : "text-muted-foreground"}>
            {r.dangerLevel ?? "Unknown"}
          </span>
        ) },
        { key: "lastSeenLocation", header: "Last seen", render: (r) => (
          <div className="text-xs">
            <div>{r.lastSeenLocation ?? "—"}</div>
            <div className="text-muted-foreground">{r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleDateString() : ""}</div>
          </div>
        ) },
        { key: "department", header: "Issuing agency", sortable: true, className: "text-xs" },
        { key: "status", header: "Status", sortable: true, render: (r) => <StatusPill status={r.status} /> },
      ]}
      fields={[
        { name: "employeeNumber", label: "Case / File #", required: true },
        { name: "category", label: "Category", type: "select", options: CATEGORIES, required: true },
        { name: "firstName", label: "First name", required: true },
        { name: "lastName", label: "Last name", required: true },
        { name: "aliases", label: "Known aliases" },
        { name: "nationalId", label: "National ID" },
        { name: "dateOfBirth", label: "Date of birth", type: "date" as any },
        { name: "gender", label: "Gender", type: "select", options: GENDERS },
        { name: "dangerLevel", label: "Threat level", type: "select", options: DANGER_LEVELS, required: true },
        { name: "department", label: "Issuing agency", type: "select", options: agencyOptions, required: true },
        { name: "position", label: "Summary / charges", required: true },
        { name: "lastSeenLocation", label: "Last seen at" },
        { name: "lastSeenAt", label: "Last seen on", type: "date" as any },
        { name: "phone", label: "Contact phone", type: "tel" },
        { name: "email", label: "Contact email", type: "email" },
        { name: "photoUrl", label: "Reference photo URL" },
        { name: "notes", label: "Intelligence notes", type: "textarea" as any },
        { name: "status", label: "Case status", type: "select", options: STATUSES, required: true },
      ]}
      defaults={{ status: "Active", category: "Person of Interest", dangerLevel: "Unknown" }}
    />
  );
}

export const Route = createFileRoute("/_app/personnel")({ component: Page });
