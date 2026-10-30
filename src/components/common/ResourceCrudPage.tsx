import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Plus, Trash2, Pencil, Search, Download, X } from "lucide-react";
import { toast } from "sonner";
import { DataTable, downloadCsv, type Column } from "@/components/common/DataTable";
import { LoadingSkeleton, PageHeader } from "@/components/common/Primitives";

export interface FieldDef<T> {
  name: keyof T & string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "select" | "textarea";
  options?: string[];
  required?: boolean;
}

interface Props<T extends { id: string }> {
  title: string;
  description?: string;
  resource: string;
  columns: Column<T>[];
  fields: FieldDef<T>[];
  fetcher: () => Promise<T[]>;
  creator: (data: Omit<T, "id">) => Promise<T>;
  updater: (id: string, data: Partial<T>) => Promise<T>;
  remover: (id: string) => Promise<unknown>;
  bulkRemover?: (ids: string[]) => Promise<unknown>;
  extraActions?: ReactNode;
  defaults?: Partial<T>;
}

export function ResourceCrudPage<T extends { id: string }>({
  title, description, resource, columns, fields, fetcher, creator, updater, remover, bulkRemover, extraActions, defaults,
}: Props<T>) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: [resource], queryFn: fetcher });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});

  const invalidate = () => qc.invalidateQueries({ queryKey: [resource] });

  const create = useMutation({
    mutationFn: (d: Omit<T, "id">) => creator(d),
    onSuccess: () => { toast.success(`${title.replace(/s$/, "")} created`); invalidate(); setOpen(false); },
    onError: (e: any) => toast.error(e.message ?? "Create failed"),
  });
  const update = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<T> }) => updater(id, d),
    onSuccess: () => { toast.success("Updated"); invalidate(); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => remover(id),
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
  });
  const bulk = useMutation({
    mutationFn: (ids: string[]) => bulkRemover!(ids),
    onSuccess: () => { toast.success("Records deleted"); setSelected([]); invalidate(); },
  });

  const openNew = () => { setEditing(null); setForm({ ...(defaults ?? {}) }); setOpen(true); };
  const openEdit = (row: T) => { setEditing(row); setForm(row as any); setOpen(true); };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) update.mutate({ id: editing.id, d: form as Partial<T> });
    else create.mutate(form as Omit<T, "id">);
  };

  const tableColumns: Column<T>[] = [
    ...columns,
    {
      key: "_actions", header: "", className: "w-24 text-right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(row)} className="rounded p-1.5 hover:bg-accent" aria-label="Edit"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={() => { if (confirm("Delete this record?")) remove.mutate(row.id); }}
            className="rounded p-1.5 hover:bg-destructive/10 text-destructive" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {extraActions}
            <button onClick={() => downloadCsv(`${resource}.csv`, data as any)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
              <Download className="h-4 w-4" /> Export
            </button>
            {bulkRemover && selected.length > 0 && (
              <button onClick={() => { if (confirm(`Delete ${selected.length} records?`)) bulk.mutate(selected); }}
                className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground hover:bg-destructive/90">
                <Trash2 className="h-4 w-4" /> Delete ({selected.length})
              </button>
            )}
            <button onClick={openNew}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> New
            </button>
          </>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${resource}…`}
          className="w-full rounded-md border border-input bg-card pl-9 pr-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
      </div>

      {isLoading ? <LoadingSkeleton rows={8} /> : (
        <DataTable<T>
          data={data} columns={tableColumns} search={search}
          selectable={!!bulkRemover}
          onSelectionChange={setSelected}
          pageSize={10}
        />
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
            className="w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <h3 className="font-display text-lg">{editing ? "Edit" : "New"} {title.replace(/s$/, "")}</h3>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
              {fields.map((f) => (
                <label key={f.name} className={`text-sm block ${f.type === "textarea" ? "col-span-2" : ""}`}>
                  <span className="mb-1 block text-muted-foreground">{f.label}{f.required && <span className="text-destructive"> *</span>}</span>
                  {f.type === "select" ? (
                    <select required={f.required} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">Select…</option>
                      {f.options?.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea required={f.required} rows={3} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
                  ) : (
                    <input required={f.required} type={f.type ?? "text"} value={form[f.name] ?? ""} onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-accent">Cancel</button>
              <button type="submit" disabled={create.isPending || update.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {editing ? "Save changes" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
