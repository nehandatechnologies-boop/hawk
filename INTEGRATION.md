# HAWKTRACE — Integration Guide

HAWKTRACE is split into two cleanly separable layers so it can plug into the
rest of the NEHANDA Systems estate without code changes to the UI.

```
┌──────────────────────────┐    Bearer JWT     ┌──────────────────────────┐
│  HAWKTRACE web app       │ ───────────────▶ │  Your REST backend        │
│  React + TanStack Start  │  /personnel       │  (FastAPI / Express / …)  │
│  Axios → services/*      │  /assets ...      │  validates Supabase JWT   │
└──────────────────────────┘                   └──────────────────────────┘
            │                                              │
            └───── Auth (Lovable Cloud / Supabase) ────────┘
                   Email + password, Google OAuth
                   RBAC via public.user_roles + has_role()
```

## 1. Switching to your backend

Set one environment variable:

```
VITE_API_BASE_URL=https://api.nehanda.systems/v1
```

Every call in `src/services/resources.ts` (personnel, assets, cameras, alerts,
audit, dashboard) now goes to your backend. No app code needs to change.

When `VITE_API_BASE_URL` is empty, requests fall back to the bundled
in-memory store at `src/routes/api.$.ts` (useful for demos and offline dev).

## 2. Auth contract

- The user authenticates in HAWKTRACE via Lovable Cloud (email/password or
  Google).
- `src/services/api.ts` attaches the Supabase access token to every request:
  ```
  Authorization: Bearer <jwt>
  X-User: user@example.com
  X-User-Id: <uuid>
  ```
- Your backend validates the JWT against the Supabase JWKS:
  - `iss = ${VITE_SUPABASE_URL}/auth/v1`
  - `jwks_uri = ${VITE_SUPABASE_URL}/auth/v1/.well-known/jwks.json`
  - `sub` is the user id (matches `auth.users.id` / `public.profiles.id`)
- On `401`, the client signs the user out and the route guard redirects to
  `/login`.

## 3. RBAC

Roles are stored in `public.user_roles` (never on profiles) with the
`public.app_role` enum:

```
Administrator | Supervisor | Security Officer | Operator | Auditor | Viewer
```

- New signups get the `Viewer` role automatically (via the
  `handle_new_user` trigger).
- Only Administrators can manage roles (RLS-enforced).
- Client-side checks use `useAuth().hasRole("Administrator", "Supervisor")`.
- Server-side, your FastAPI can either re-read the role from the JWT claims
  (if you add a custom claim) or hit the Supabase REST endpoint:
  `GET /rest/v1/rpc/get_user_primary_role` with the user JWT.

## 4. REST contract expected by the UI

Base URL: `${VITE_API_BASE_URL}` (or `/api` during dev).

| Method | Path                                  | Purpose                          |
|--------|---------------------------------------|----------------------------------|
| GET    | `/dashboard/stats`                    | Aggregated dashboard metrics     |
| GET    | `/personnel`                          | List personnel                   |
| POST   | `/personnel`                          | Create personnel                 |
| GET    | `/personnel/:id`                      | Read personnel                   |
| PUT    | `/personnel/:id`                      | Update personnel                 |
| DELETE | `/personnel/:id`                      | Delete personnel                 |
| POST   | `/personnel/bulk-delete`              | `{ ids: string[] }`              |
| ...    | same shape for `/assets`, `/cameras`, `/departments`, `/alerts` |
| POST   | `/alerts/:id/acknowledge`             | Mark alert acknowledged          |
| POST   | `/alerts/:id/resolve`                 | Mark alert resolved              |
| GET    | `/audit`                              | Immutable audit trail            |

Response shapes are defined in `src/types/index.ts` — share or generate
matching Pydantic / TypeScript models from there.

## 5. Local development checklist

1. `cp .env.example .env.local` and set `VITE_API_BASE_URL` if pointing at a
   real backend.
2. Make sure your backend allows requests from the HAWKTRACE origin and
   accepts the `Authorization`, `X-User`, `X-User-Id` headers (CORS).
3. Run the app — sign in with email/password or Google.
4. To grant yourself an elevated role for the first time, run in the backend
   SQL editor (one-off):
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('<your-auth-uid>', 'Administrator');
   ```
