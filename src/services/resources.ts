/**
 * HAWKTRACE data services — talk directly to Lovable Cloud (Supabase).
 *
 * The frontend IS the full system. Row-Level Security policies enforce RBAC
 * server-side; the client just calls .from("<table>") and gets back rows
 * the current operator is allowed to see.
 */
import { supabase } from "@/integrations/supabase/client";
import { writeAuditLog } from "@/lib/audit.functions";
import type {
  Asset, AuditEntry, Camera, DashboardStats, Department, Personnel, SecurityAlert,
} from "@/types";

// -------------------- helpers --------------------
// Audit logs are inserted server-side (service role) so clients cannot forge
// actor identity. Failures are swallowed to avoid blocking the primary op.
async function logAudit(action: string, module: string, recordId = "") {
  try {
    await writeAuditLog({ data: { action, module, recordId } });
  } catch {
    /* audit best-effort */
  }
}

// -------------------- mappers --------------------
const subjectFromRow = (r: any): Personnel => ({
  id: r.id,
  employeeNumber: r.employee_number,
  nationalId: r.national_id ?? "",
  firstName: r.first_name,
  lastName: r.last_name,
  department: r.department ?? "",
  position: r.position ?? "",
  phone: r.phone ?? "",
  email: r.email ?? "",
  status: r.status,
  photoUrl: r.photo_url ?? undefined,
  createdAt: r.created_at,
  category: r.category ?? undefined,
  dangerLevel: r.danger_level ?? undefined,
  aliases: r.aliases ?? undefined,
  dateOfBirth: r.date_of_birth ?? undefined,
  gender: r.gender ?? undefined,
  lastSeenLocation: r.last_seen_location ?? undefined,
  lastSeenAt: r.last_seen_at ?? undefined,
  notes: r.notes ?? undefined,
});
const subjectToRow = (p: Partial<Personnel>) => ({
  employee_number: p.employeeNumber,
  national_id: p.nationalId,
  first_name: p.firstName,
  last_name: p.lastName,
  department: p.department,
  position: p.position,
  phone: p.phone,
  email: p.email,
  status: p.status,
  photo_url: p.photoUrl,
  category: p.category,
  danger_level: p.dangerLevel,
  aliases: p.aliases,
  date_of_birth: p.dateOfBirth || null,
  gender: p.gender,
  last_seen_location: p.lastSeenLocation,
  last_seen_at: p.lastSeenAt || null,
  notes: p.notes,
});

const cameraFromRow = (r: any): Camera => ({
  id: r.id, name: r.name, location: r.location, building: r.building, floor: r.floor,
  rtspUrl: r.rtsp_url, status: r.status, resolution: r.resolution,
  lastHeartbeat: r.last_heartbeat, notes: r.notes ?? undefined,
  latitude: r.latitude ?? null, longitude: r.longitude ?? null,
});
const cameraToRow = (c: Partial<Camera>) => ({
  name: c.name, location: c.location, building: c.building, floor: c.floor,
  rtsp_url: c.rtspUrl, status: c.status, resolution: c.resolution,
  last_heartbeat: c.lastHeartbeat, notes: c.notes,
  latitude: c.latitude === undefined || c.latitude === null || (c.latitude as any) === "" ? null : Number(c.latitude),
  longitude: c.longitude === undefined || c.longitude === null || (c.longitude as any) === "" ? null : Number(c.longitude),
});


const assetFromRow = (r: any): Asset => ({
  id: r.id, assetId: r.asset_id, name: r.name, serialNumber: r.serial_number,
  manufacturer: r.manufacturer, model: r.model, category: r.category,
  department: r.department, assignedUser: r.assigned_user ?? undefined,
  purchaseDate: r.purchase_date ?? "", warrantyUntil: r.warranty_until ?? "",
  status: r.status, imageUrl: r.image_url ?? undefined, barcode: r.barcode,
});
const assetToRow = (a: Partial<Asset>) => ({
  asset_id: a.assetId, name: a.name, serial_number: a.serialNumber,
  manufacturer: a.manufacturer, model: a.model, category: a.category,
  department: a.department, assigned_user: a.assignedUser,
  purchase_date: a.purchaseDate || null, warranty_until: a.warrantyUntil || null,
  status: a.status, image_url: a.imageUrl, barcode: a.barcode,
});

const alertFromRow = (r: any): SecurityAlert => ({
  id: r.external_id ?? r.id,
  title: r.title,
  priority: r.priority,
  status: r.status,
  assignedOfficer: r.assigned_officer ?? undefined,
  source: r.source ?? "system",
  timestamp: r.created_at,
  description: r.description ?? "",
  subjectId: r.subject_id ?? undefined,
  subjectCategory: r.subject_category ?? undefined,
  cameraId: r.camera_id ?? undefined,
  confidence: r.match_confidence ?? undefined,
  latitude: r.latitude ?? null,
  longitude: r.longitude ?? null,
});

// -------------------- Subjects (Personnel) --------------------
export const personnelService = {
  list: async (): Promise<Personnel[]> => {
    const { data, error } = await supabase.from("subjects").select("*").order("created_at", { ascending: false });
    if (error) throw error; return (data ?? []).map(subjectFromRow);
  },
  get: async (id: string): Promise<Personnel> => {
    const { data, error } = await supabase.from("subjects").select("*").eq("id", id).single();
    if (error) throw error; return subjectFromRow(data);
  },
  create: async (p: Omit<Personnel, "id" | "createdAt">): Promise<Personnel> => {
    const { data: sess } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("subjects").insert({ ...subjectToRow(p), created_by: sess.user?.id ?? null } as any).select("*").single();
    if (error) throw error;
    const row = subjectFromRow(data); await logAudit("CREATE", "subjects", row.id); return row;
  },
  update: async (id: string, p: Partial<Personnel>): Promise<Personnel> => {
    const { data, error } = await supabase.from("subjects").update(subjectToRow(p) as any).eq("id", id).select("*").single();
    if (error) throw error;
    const row = subjectFromRow(data); await logAudit("UPDATE", "subjects", id); return row;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) throw error; await logAudit("DELETE", "subjects", id); return { ok: true as const };
  },
  bulkRemove: async (ids: string[]) => {
    if (!ids.length) return { ok: true as const, count: 0 };
    const { error } = await supabase.from("subjects").delete().in("id", ids);
    if (error) throw error;
    for (const id of ids) await logAudit("DELETE", "subjects", id);
    return { ok: true as const, count: ids.length };
  },
};

// -------------------- Cameras --------------------
export const cameraService = {
  list: async (): Promise<Camera[]> => {
    const { data, error } = await supabase.from("cameras").select("*").order("name");
    if (error) throw error; return (data ?? []).map(cameraFromRow);
  },
  get: async (id: string): Promise<Camera> => {
    const { data, error } = await supabase.from("cameras").select("*").eq("id", id).single();
    if (error) throw error; return cameraFromRow(data);
  },
  create: async (c: Omit<Camera, "id">): Promise<Camera> => {
    const { data, error } = await supabase.from("cameras").insert(cameraToRow(c) as any).select("*").single();
    if (error) throw error;
    const row = cameraFromRow(data); await logAudit("CREATE", "cameras", row.id); return row;
  },
  update: async (id: string, c: Partial<Camera>): Promise<Camera> => {
    const { data, error } = await supabase.from("cameras").update(cameraToRow(c) as any).eq("id", id).select("*").single();
    if (error) throw error;
    const row = cameraFromRow(data); await logAudit("UPDATE", "cameras", id); return row;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("cameras").delete().eq("id", id);
    if (error) throw error; await logAudit("DELETE", "cameras", id); return { ok: true as const };
  },
  bulkRemove: async (ids: string[]) => {
    if (!ids.length) return { ok: true as const, count: 0 };
    const { error } = await supabase.from("cameras").delete().in("id", ids);
    if (error) throw error; return { ok: true as const, count: ids.length };
  },
};

// -------------------- Assets --------------------
export const assetService = {
  list: async (): Promise<Asset[]> => {
    const { data, error } = await supabase.from("assets").select("*").order("asset_id");
    if (error) throw error; return (data ?? []).map(assetFromRow);
  },
  get: async (id: string): Promise<Asset> => {
    const { data, error } = await supabase.from("assets").select("*").eq("id", id).single();
    if (error) throw error; return assetFromRow(data);
  },
  create: async (a: Omit<Asset, "id">): Promise<Asset> => {
    const { data, error } = await supabase.from("assets").insert(assetToRow(a) as any).select("*").single();
    if (error) throw error;
    const row = assetFromRow(data); await logAudit("CREATE", "assets", row.id); return row;
  },
  update: async (id: string, a: Partial<Asset>): Promise<Asset> => {
    const { data, error } = await supabase.from("assets").update(assetToRow(a) as any).eq("id", id).select("*").single();
    if (error) throw error;
    const row = assetFromRow(data); await logAudit("UPDATE", "assets", id); return row;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("assets").delete().eq("id", id);
    if (error) throw error; await logAudit("DELETE", "assets", id); return { ok: true as const };
  },
  bulkRemove: async (ids: string[]) => {
    if (!ids.length) return { ok: true as const, count: 0 };
    const { error } = await supabase.from("assets").delete().in("id", ids);
    if (error) throw error; return { ok: true as const, count: ids.length };
  },
};

// -------------------- Departments --------------------
export const departmentService = {
  list: async (): Promise<Department[]> => {
    const { data, error } = await supabase.from("departments").select("*").order("name");
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, code: r.code, head: r.head, headcount: r.headcount }));
  },
  get: async (id: string): Promise<Department> => {
    const { data, error } = await supabase.from("departments").select("*").eq("id", id).single();
    if (error) throw error;
    return { id: data.id, name: data.name, code: data.code, head: data.head, headcount: data.headcount };
  },
  create: async (d: Omit<Department, "id">): Promise<Department> => {
    const { data, error } = await supabase.from("departments").insert(d as any).select("*").single();
    if (error) throw error; await logAudit("CREATE", "departments", data.id);
    return { id: data.id, name: data.name, code: data.code, head: data.head, headcount: data.headcount };
  },
  update: async (id: string, d: Partial<Department>) => {
    const { data, error } = await supabase.from("departments").update(d as any).eq("id", id).select("*").single();
    if (error) throw error; await logAudit("UPDATE", "departments", id);
    return { id: data.id, name: data.name, code: data.code, head: data.head, headcount: data.headcount };
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) throw error; await logAudit("DELETE", "departments", id); return { ok: true as const };
  },
  bulkRemove: async (ids: string[]) => {
    if (!ids.length) return { ok: true as const, count: 0 };
    const { error } = await supabase.from("departments").delete().in("id", ids);
    if (error) throw error; return { ok: true as const, count: ids.length };
  },
};

// -------------------- Alerts --------------------
export const alertService = {
  list: async (): Promise<SecurityAlert[]> => {
    const { data, error } = await supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error; return (data ?? []).map(alertFromRow);
  },
  get: async (id: string): Promise<SecurityAlert> => {
    const { data, error } = await supabase.from("alerts").select("*").eq("id", id).single();
    if (error) throw error; return alertFromRow(data);
  },
  create: async (a: Omit<SecurityAlert, "id" | "timestamp">): Promise<SecurityAlert> => {
    const { data: sess } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("alerts").insert({
      title: a.title, description: a.description, priority: a.priority, status: a.status ?? "Open",
      source: a.source, camera_id: a.cameraId ?? null, subject_id: a.subjectId ?? null,
      subject_category: a.subjectCategory ?? null, match_confidence: a.confidence ?? null,
      latitude: a.latitude ?? null, longitude: a.longitude ?? null,
      raised_by: sess.user?.id ?? null,
    } as any).select("*").single();
    if (error) throw error;
    const row = alertFromRow(data); await logAudit("CREATE", "alerts", row.id);
    // Fire-and-forget push/Slack fan-out on every sighting.
    import("@/lib/push.functions").then(({ dispatchAlertNotifications }) => {
      dispatchAlertNotifications({ data: { alertId: row.id } }).catch(() => {});
    }).catch(() => {});
    // Fire-and-forget auto-escalation for Critical/High priority sightings.
    if (row.priority === "Critical" || row.priority === "High") {
      import("@/lib/escalation.functions").then(({ dispatchEscalation }) => {
        dispatchEscalation({ data: { alertId: row.id } }).catch(() => {});
      }).catch(() => {});
    }
    return row;
  },
  update: async (id: string, patch: Partial<SecurityAlert>): Promise<SecurityAlert> => {
    const { data, error } = await supabase.from("alerts").update({
      status: patch.status, assigned_officer: patch.assignedOfficer, title: patch.title, description: patch.description,
    } as any).eq("id", id).select("*").single();
    if (error) throw error;
    const row = alertFromRow(data); await logAudit("UPDATE", "alerts", id); return row;
  },
  remove: async (id: string) => {
    const { error } = await supabase.from("alerts").delete().eq("id", id);
    if (error) throw error; await logAudit("DELETE", "alerts", id); return { ok: true as const };
  },
  bulkRemove: async (ids: string[]) => {
    if (!ids.length) return { ok: true as const, count: 0 };
    const { error } = await supabase.from("alerts").delete().in("id", ids);
    if (error) throw error; return { ok: true as const, count: ids.length };
  },
  acknowledge: async (id: string) => {
    const { data, error } = await supabase.from("alerts").update({ status: "Acknowledged" }).eq("id", id).select("*").single();
    if (error) throw error; await logAudit("ACK", "alerts", id); return alertFromRow(data);
  },
  resolve: async (id: string) => {
    const { data, error } = await supabase.from("alerts").update({ status: "Resolved" }).eq("id", id).select("*").single();
    if (error) throw error; await logAudit("RESOLVE", "alerts", id); return alertFromRow(data);
  },
};

// -------------------- Audit --------------------
export const auditService = {
  list: async (): Promise<AuditEntry[]> => {
    const { data, error } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id, user: r.actor_email, action: r.action, module: r.module,
      recordId: r.record_id, ipAddress: r.ip_address, timestamp: r.created_at,
    }));
  },
};

// -------------------- Dashboard aggregate --------------------
export const dashboardService = {
  stats: async (): Promise<DashboardStats> => {
    const [subjects, cameras, assets, alerts] = await Promise.all([
      personnelService.list(), cameraService.list(), assetService.list(), alertService.list(),
    ]);
    const onlineCameras = cameras.filter((c) => c.status === "Online").length;
    const openAlerts = alerts.filter((a) => a.status === "Open" || a.status === "Acknowledged").length;
    const closedAlerts = alerts.filter((a) => a.status === "Resolved" || a.status === "Closed").length;

    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const byMonth: Record<string, { critical: number; high: number; medium: number; low: number }> = {};
    for (const a of alerts) {
      const m = months[new Date(a.timestamp).getMonth()];
      byMonth[m] ??= { critical: 0, high: 0, medium: 0, low: 0 };
      const k = a.priority.toLowerCase() as keyof typeof byMonth[string];
      if (k in byMonth[m]) byMonth[m][k]++;
    }
    const monthlyAlerts = months.map((m) => ({ month: m, ...(byMonth[m] ?? { critical: 0, high: 0, medium: 0, low: 0 }) }));

    const catCount = new Map<string, number>();
    for (const s of subjects) { const k = s.category ?? "Unclassified"; catCount.set(k, (catCount.get(k) ?? 0) + 1); }
    const subjectCategories = [...catCount.entries()].map(([name, value]) => ({ name, value }));

    const assetDist = new Map<string, number>();
    for (const a of assets) assetDist.set(a.category || "Other", (assetDist.get(a.category || "Other") ?? 0) + 1);

    const perDept = new Map<string, number>();
    for (const s of subjects) perDept.set(s.department || "Unassigned", (perDept.get(s.department || "Unassigned") ?? 0) + 1);

    const camStatus = new Map<string, number>();
    for (const c of cameras) camStatus.set(c.status, (camStatus.get(c.status) ?? 0) + 1);

    const recentActivity = alerts.slice(0, 8).map((a) => ({
      id: a.id, user: a.assignedOfficer ?? "system",
      action: a.title, time: new Date(a.timestamp).toLocaleString(),
    }));

    return {
      totalPersonnel: subjects.length,
      activePersonnel: subjects.filter((s) => s.status === "Active").length,
      totalAssets: assets.length,
      onlineCameras, totalCameras: cameras.length,
      openAlerts, closedAlerts,
      todayActivity: alerts.filter((a) => new Date(a.timestamp).toDateString() === new Date().toDateString()).length,
      systemHealth: cameras.length ? Math.round((onlineCameras / cameras.length) * 100) : 100,
      monthlyAlerts,
      assetDistribution: [...assetDist.entries()].map(([name, value]) => ({ name, value })),
      personnelDistribution: [...perDept.entries()].map(([department, count]) => ({ department, count })),
      cameraStatus: [...camStatus.entries()].map(([name, value]) => ({ name, value })),
      subjectCategories,
      recentActivity,
    };
  },
};
