import { createFileRoute } from "@tanstack/react-router";
import { ResourceCrudPage } from "@/components/common/ResourceCrudPage";
import { StatusPill } from "@/components/common/Primitives";
import { assetService } from "@/services/resources";
import type { Asset } from "@/types";

const CATEGORIES = ["Workstation","Laptop","Server","Network","Radio","Vehicle","Surveillance","Mobile"];
const DEPARTMENTS = ["Security Operations","IT & Infrastructure","Facilities","Human Resources","Finance","Field Response"];
const STATUSES = ["In Use","Available","Maintenance","Retired"];

function Page() {
  return (
    <ResourceCrudPage<Asset>
      title="Assets"
      description="Inventory of physical and digital assets across the organization."
      resource="assets"
      fetcher={assetService.list}
      creator={assetService.create as any}
      updater={assetService.update as any}
      remover={assetService.remove}
      bulkRemover={assetService.bulkRemove}
      columns={[
        { key: "assetId", header: "Asset ID", sortable: true, className: "font-mono text-xs" },
        { key: "name", header: "Name", sortable: true,
          render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{r.manufacturer} · {r.model}</div></div> },
        { key: "category", header: "Category", sortable: true },
        { key: "department", header: "Department", sortable: true },
        { key: "assignedUser", header: "Assigned", render: (r) => r.assignedUser ?? <span className="text-muted-foreground">—</span> },
        { key: "barcode", header: "Barcode", className: "font-mono text-xs" },
        { key: "status", header: "Status", sortable: true, render: (r) => <StatusPill status={r.status} /> },
      ]}
      fields={[
        { name: "assetId", label: "Asset ID", required: true },
        { name: "name", label: "Asset Name", required: true },
        { name: "serialNumber", label: "Serial Number", required: true },
        { name: "manufacturer", label: "Manufacturer", required: true },
        { name: "model", label: "Model", required: true },
        { name: "category", label: "Category", type: "select", options: CATEGORIES, required: true },
        { name: "department", label: "Department", type: "select", options: DEPARTMENTS, required: true },
        { name: "assignedUser", label: "Assigned User (Employee #)" },
        { name: "purchaseDate", label: "Purchase Date", type: "date" },
        { name: "warrantyUntil", label: "Warranty Until", type: "date" },
        { name: "status", label: "Status", type: "select", options: STATUSES, required: true },
        { name: "barcode", label: "Barcode / QR", required: true },
        { name: "imageUrl", label: "Image URL" },
      ]}
      defaults={{ status: "Available" }}
    />
  );
}

export const Route = createFileRoute("/_app/assets")({ component: Page });
