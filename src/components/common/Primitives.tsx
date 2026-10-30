import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label, value, hint, icon, tone = "default", index = 0,
}: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  index?: number;
}) {
  const toneClass = {
    default: "text-primary bg-primary/10",
    success: "text-[color:var(--color-success)] bg-[color:var(--color-success)]/10",
    warning: "text-[color:var(--color-warning)] bg-[color:var(--color-warning)]/10",
    danger: "text-destructive bg-destructive/10",
    info: "text-[color:var(--color-info)] bg-[color:var(--color-info)]/10",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {icon && <div className={cn("rounded-md p-2", toneClass)}>{icon}</div>}
      </div>
    </motion.div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-card", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    Online: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    Available: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
    "In Use": "bg-primary/15 text-primary",
    Inactive: "bg-muted text-muted-foreground",
    "On Leave": "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    Suspended: "bg-destructive/15 text-destructive",
    Offline: "bg-destructive/15 text-destructive",
    Degraded: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    Maintenance: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    Retired: "bg-muted text-muted-foreground",
    Open: "bg-destructive/15 text-destructive",
    Acknowledged: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    Resolved: "bg-[color:var(--color-success)]/15 text-[color:var(--color-success)]",
    Closed: "bg-muted text-muted-foreground",
    Critical: "bg-destructive/15 text-destructive",
    High: "bg-[color:var(--color-warning)]/15 text-[color:var(--color-warning)]",
    Medium: "bg-[color:var(--color-info)]/15 text-[color:var(--color-info)]",
    Low: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", map[status] ?? "bg-muted text-muted-foreground")}>
      <span className="status-dot" />
      {status}
    </span>
  );
}

export function LoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-md bg-muted/40 animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <div className="font-medium">{title}</div>
      {hint && <div className="mt-1 text-sm text-muted-foreground">{hint}</div>}
    </div>
  );
}
