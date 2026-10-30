# HAWKTRACE — Backend Contract (for the Replit-hosted API)

This document is the source of truth for the **REST API** that the HAWKTRACE
frontend will call. Hand this file to the engineer (or to Replit AI) building
the backend — if the API matches this contract, the UI will work end-to-end
without any frontend changes.

> Mission: HAWKTRACE is a Security Operations Centre (SOC) console for
> tracking **wanted persons, missing persons and persons of interest** using
> on-prem **CCTV facial recognition**. Recognition is computed in the
> browser (face-api.js); the backend persists subjects, cameras, alerts,
> face descriptors and audit trail.

---

## 1. Base URL & wiring

Set in the frontend `.env.local`:

```
VITE_API_BASE_URL=https://your-replit-app.replit.app/v1
```

All requests are JSON. All routes are same-origin from the user's POV but
cross-origin to your Replit host — enable **CORS** for the HAWKTRACE origin
and allow the headers `Authorization`, `Content-Type`, `X-User`, `X-User-Id`.

## 2. Authentication

The user signs in to HAWKTRACE via Lovable Cloud (Supabase Auth — email/
password or Google). The frontend attaches a Supabase access token to every
request:

```
Authorization: Bearer <supabase-jwt>
X-User:        <user.email>           # convenience, do not trust for authz
X-User-Id:     <user.id, uuid>        # convenience, do not trust for authz
```

The backend MUST validate the JWT against the Supabase JWKS:

```
issuer   = ${SUPABASE_URL}/auth/v1
jwks_uri = ${SUPABASE_URL}/auth/v1/.well-known/jwks.json
sub      = the user's UUID (matches public.profiles.id)
```

On a `401`, the frontend signs out and redirects to `/login`. Return
`403` for authenticated-but-forbidden, `404` for missing resources, `422`
for validation errors with a JSON body `{ "message": "...", "errors": {...} }`.

## 3. Roles & RBAC

Roles live in Lovable Cloud (`public.user_roles`, enum `public.app_role`):

```
Administrator | Supervisor | Security Officer | Operator | Auditor | Viewer
```

Read the caller's role either from a custom JWT claim or by calling
`POST {SUPABASE_URL}/rest/v1/rpc/get_user_primary_role` with the user JWT.

Recommended authorisation matrix:

| Capability                       | Roles                                             |
|----------------------------------|---------------------------------------------------|
| Read everything                  | all signed-in users                               |
| Create/update Subjects, Cameras  | Administrator, Supervisor, Security Officer       |
| Delete / bulk-delete             | Administrator, Supervisor                         |
| Acknowledge / resolve alerts     | Administrator, Supervisor, Security Officer, Operator |
| Enroll / delete face descriptors | Administrator, Supervisor (already enforced via RLS on `face_enrollments`) |
| Read audit log                   | Administrator, Auditor, Supervisor                |
| Settings                         | Administrator                                     |

## 4. Resource shapes

All response bodies are JSON. Timestamps are ISO 8601 UTC strings. IDs are
opaque strings (UUIDs recommended).

### 4.1 Subject (URL path: `/personnel`)

The wire path is `/personnel` for backward compatibility. Semantically these
are **Subjects of Interest** (Wanted / Missing / POI / Cleared).

```ts
interface Subject {
  id: string;
  employeeNumber: string;     // Case / file number, e.g. "WNT-1014", "MP-1027"
  nationalId: string;         // where available
  firstName: string;
  lastName: string;
  department: string;         // Issuing agency, e.g. "ZRP CID — Harare"
  position: string;           // One-line headline / charges
  phone: string;
  email: string;
  status: "Active" | "Inactive" | "Located" | "Apprehended" | "Archived";
  photoUrl?: string;          // Reference mugshot (public URL)
  createdAt: string;

  // Subject-specific fields:
  category?: "Wanted" | "Missing" | "Person of Interest" | "Cleared";
  dangerLevel?: "Armed & Dangerous" | "Caution" | "Non-violent" | "Unknown";
  aliases?: string;           // free-form, comma separated
  dateOfBirth?: string;       // YYYY-MM-DD
  gender?: "Male" | "Female" | "Other" | "Unknown";
  lastSeenLocation?: string;
  lastSeenAt?: string;        // ISO timestamp
  notes?: string;             // long-form intel
}
```

### 4.2 Camera (`/cameras`)

```ts
interface Camera {
  id: string;
  name: string;               // "CAM-104"
  location: string;           // "Long-distance rank"
  building: string;           // "Mbare Musika"
  floor: string;
  rtspUrl: string;            // "rtsp://..."
  status: "Online" | "Offline" | "Degraded";
  resolution: string;         // "1080p" | "4K"
  lastHeartbeat: string;
  notes?: string;
}
```

### 4.3 SecurityAlert (`/alerts`)

```ts
interface SecurityAlert {
  id: string;
  title: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "Acknowledged" | "Resolved" | "Closed";
  assignedOfficer?: string;
  source: string;             // "CAM-104 — Long-distance rank, Mbare Musika"
  timestamp: string;
  description: string;
  // Optional linkage written by the recognition pipeline:
  subjectId?: string;
  subjectCategory?: "Wanted" | "Missing" | "Person of Interest" | "Cleared";
  cameraId?: string;
  confidence?: number;        // 0..1
}
```

### 4.4 AuditEntry (`/audit`)

```ts
interface AuditEntry {
  id: string;
  user: string;        // email
  action: string;      // "CREATE" | "UPDATE" | "DELETE" | "SCAN_MATCH" | ...
  module: string;      // "Subjects" | "Cameras" | "Alerts" | ...
  recordId: string;
  ipAddress: string;
  timestamp: string;
}
```

### 4.5 Dashboard stats (`/dashboard/stats`)

```ts
interface DashboardStats {
  totalPersonnel: number;          // total subjects on file
  activePersonnel: number;         // status === "Active"
  totalAssets: number;             // re-purposed as "enrolled faces" in the UI; set to face-enrollment count
  onlineCameras: number;
  totalCameras: number;
  openAlerts: number;              // status in (Open, Acknowledged)
  closedAlerts: number;            // status in (Resolved, Closed)
  todayActivity: number;           // audit entries in last 24h
  systemHealth: number;            // 0..100
  monthlyAlerts: { month: string; critical: number; high: number; medium: number; low: number }[];
  personnelDistribution: { department: string; count: number }[];   // subjects per issuing agency
  cameraStatus: { name: string; value: number }[];
  subjectCategories?: { name: string; value: number }[];            // Wanted/Missing/POI/Cleared counts
  assetDistribution: { name: string; value: number }[];             // can be []
  recentActivity: { id: string; user: string; action: string; time: string }[];
}
```

## 5. Endpoints

Standard CRUD over each collection. Replace `{coll}` with one of:
`personnel`, `cameras`, `alerts`, `departments`.

```
GET    /{coll}                       → T[]
POST   /{coll}                       → T          body: Omit<T, "id">
GET    /{coll}/{id}                  → T
PUT    /{coll}/{id}                  → T          body: Partial<T>
DELETE /{coll}/{id}                  → { ok: true }
POST   /{coll}/bulk-delete           → { ok: true, count: number }   body: { ids: string[] }

POST   /alerts/{id}/acknowledge      → SecurityAlert
POST   /alerts/{id}/resolve          → SecurityAlert

GET    /audit                        → AuditEntry[]
GET    /dashboard/stats              → DashboardStats
```

### 5.1 Filtering, sorting, pagination

The UI currently pages and searches client-side, so the simplest contract is
**return the full collection on `GET /{coll}`**. If you want server-side
paging later, accept `?page=&pageSize=&q=&sort=field:asc` and return:

```json
{ "items": [...], "total": 1234, "page": 1, "pageSize": 50 }
```

The frontend can be upgraded to consume that shape without disrupting the UI.

## 6. Face recognition pipeline

Face recognition runs **in the operator's browser** using `face-api.js`.
Reference descriptors (128-d Float32 arrays) and tiny thumbnails are stored
in Lovable Cloud directly (table `public.face_enrollments`, see
`src/services/faceEnrollments.ts`). The Replit backend does **not** need to
implement face matching — it only needs to:

1. Accept `POST /alerts` payloads from the recognition pipeline. The body
   matches `SecurityAlert` above and includes `subjectId`, `subjectCategory`,
   `cameraId`, `confidence`. Persist it and return the created row.
2. Optionally fan out alerts to other channels (SMS, radio dispatch, push).
3. Acknowledge / resolve alerts via the dedicated endpoints.

Alert priority is set by the frontend from the subject's category and
threat level:

| Subject category      | Threat               | Priority   |
|-----------------------|----------------------|------------|
| Wanted                | Armed & Dangerous    | Critical   |
| Wanted                | other                | High       |
| Missing               | any                  | High       |
| Person of Interest    | any                  | Medium     |
| Cleared               | any                  | Low        |

If you want the backend to override / re-classify, do so in the `POST /alerts`
handler and return the canonical priority in the response.

## 7. Common errors to return

```json
// 401 Unauthorized   – bad / missing / expired JWT
{ "message": "Invalid token" }

// 403 Forbidden       – authenticated but role-gated
{ "message": "Supervisor role required" }

// 404 Not found
{ "message": "Subject not found" }

// 422 Validation
{ "message": "Validation failed", "errors": { "category": "is required" } }
```

## 8. Local dev without a backend

Leave `VITE_API_BASE_URL` unset (or empty). Requests fall back to the bundled
TanStack server route at `src/routes/api.$.ts`, which serves a seeded
in-memory store from `src/server/store.ts`. Useful for screen recordings,
demos and UI work while the real backend is being built on Replit.

## 9. Type generation (recommended)

The canonical TypeScript shapes live in `src/types/index.ts`. Easiest path
for keeping Pydantic models in sync:

```bash
# from your Replit backend:
pip install datamodel-code-generator
datamodel-codegen \
  --input-file-type jsonschema \
  --input ./schemas/hawktrace.json \
  --output ./app/schemas/hawktrace.py
```

Or hand-translate — the surface is small (~6 entities).
