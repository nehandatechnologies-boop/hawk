import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/common/Primitives";
import { downloadCsv } from "@/components/common/DataTable";
import { alertService, assetService, auditService, cameraService, personnelService } from "@/services/resources";

const REPORTS = [
  { key: "personnel", title: "Personnel Report", desc: "Full personnel directory with status and department breakdown.", fetcher: personnelService.list },
  { key: "assets", title: "Assets Report", desc: "Inventory snapshot with assignments and warranty windows.", fetcher: assetService.list },
  { key: "alerts", title: "Alerts Report", desc: "Security alerts by priority and status over the period.", fetcher: alertService.list },
  { key: "audit", title: "Audit Log Report", desc: "Chronological audit trail across all modules.", fetcher: auditService.list },
  { key: "cameras", title: "Camera Inventory", desc: "Camera health, location and last heartbeat.", fetcher: cameraService.list },
];

function Page() {
  return (
    <>
      <PageHeader title="Reports" description="Generate PDF and Excel exports for compliance and review." />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {REPORTS.map((r) => <ReportCard key={r.key} reportKey={r.key} title={r.title} desc={r.desc} fetcher={r.fetcher} />)}
      </div>
    </>
  );
}

function ReportCard({ title, desc, fetcher, reportKey: k }: { title: string; desc: string; fetcher: () => Promise<any[]>; reportKey: string }) {
  const { data, refetch, isFetching } = useQuery({ queryKey: ["report", k], queryFn: fetcher, enabled: false });

  const run = async (kind: "csv" | "pdf") => {
    const res = data ?? (await refetch()).data ?? [];
    if (kind === "csv") {
      downloadCsv(`${k}-report.csv`, res);
      toast.success(`${title} exported (CSV/Excel-compatible)`);
    } else {
      // Lightweight PDF placeholder — open print dialog with a styled view
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) return;
      const rows = (res as any[]).slice(0, 100);
      const keys = rows[0] ? Object.keys(rows[0]) : [];
      const escHtml = (s: unknown) =>
        String(s ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      w.document.write(`<html><head><title>${escHtml(title)}</title><style>
        body{font-family:Inter,system-ui;margin:24px;color:#111}
        h1{font-family:'Space Grotesk',sans-serif} table{border-collapse:collapse;width:100%;font-size:11px}
        th,td{border:1px solid #ddd;padding:6px;text-align:left} th{background:#f5f5f5}
      </style></head><body><h1>HAWKTRACE — ${escHtml(title)}</h1>
      <p>Generated ${escHtml(new Date().toLocaleString())} · NEHANDA Systems</p>
      <table><thead><tr>${keys.map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${keys.map((k) => `<td>${escHtml(r[k])}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <script>window.print()</script></body></html>`);
      w.document.close();
      toast.success(`${title} prepared for PDF print`);
    }
  };

  return (
    <Panel>
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-primary/15 text-primary p-2"><FileText className="h-5 w-5" /></div>
        <div className="flex-1">
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{desc}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => run("csv")} disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-60">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
            <button onClick={() => run("pdf")} disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
              <Download className="h-3.5 w-3.5" /> PDF
            </button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export const Route = createFileRoute("/_app/reports")({ component: Page });
