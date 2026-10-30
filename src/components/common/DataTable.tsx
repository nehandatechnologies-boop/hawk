import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  accessor?: (row: T) => string | number;
  sortable?: boolean;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  data, columns, pageSize = 10, selectable = false, onSelectionChange, search = "",
}: {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  search?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const s = search.toLowerCase();
    return data.filter((row) =>
      columns.some((c) => {
        const v = c.accessor ? c.accessor(row) : (row as any)[c.key];
        return String(v ?? "").toLowerCase().includes(s);
      }),
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const get = (r: T) => (col.accessor ? col.accessor(r) : (r as any)[col.key]);
    return [...filtered].sort((a, b) => {
      const av = get(a), bv = get(b);
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageData = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
    onSelectionChange?.(Array.from(n));
  };
  const toggleAll = () => {
    const allIds = pageData.map((r) => r.id);
    const allSelected = allIds.every((i) => selected.has(i));
    const n = new Set(selected);
    allIds.forEach((i) => (allSelected ? n.delete(i) : n.add(i)));
    setSelected(n);
    onSelectionChange?.(Array.from(n));
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[color:var(--color-primary)]"
                    checked={pageData.length > 0 && pageData.every((r) => selected.has(r.id))}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((c) => (
                <th key={c.key} className={cn("px-3 py-2.5 font-medium", c.className)}>
                  {c.sortable ? (
                    <button
                      onClick={() =>
                        setSort((s) =>
                          s?.key === c.key
                            ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
                            : { key: c.key, dir: "asc" },
                        )
                      }
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {c.header}
                      {sort?.key === c.key ? (
                        sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="px-3 py-10 text-center text-muted-foreground">No records found.</td></tr>
            ) : pageData.map((row) => (
              <tr key={row.id} className="border-t border-border hover:bg-muted/20">
                {selectable && (
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[color:var(--color-primary)]"
                      checked={selected.has(row.id)}
                      onChange={() => toggle(row.id)}
                    />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-3 py-2.5", c.className)}>
                    {c.render ? c.render(row) : String((row as any)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span>{sorted.length} record{sorted.length === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
            className="rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40">Prev</button>
          <span className="font-mono">{page} / {pageCount}</span>
          <button disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}
            className="rounded border border-border px-2 py-1 hover:bg-accent disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}

export function downloadCsv<T extends Record<string, any>>(filename: string, rows: T[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  // Neutralize CSV formula injection: prefix cells starting with =, +, -, @, tab, or CR with a single quote.
  const esc = (v: any) => {
    const s = String(v ?? "");
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
