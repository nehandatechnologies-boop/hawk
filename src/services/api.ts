import axios from "axios";
import { supabase } from "@/integrations/supabase/client";

/**
 * HAWKTRACE API client — production.
 *
 * VITE_API_BASE_URL MUST point at the deployed HAWKTRACE backend
 * (Replit-hosted FastAPI). There is no bundled demo backend: this app
 * is the operator console for a real tracking system.
 *
 * Auth: every request carries the Supabase access token as a Bearer JWT.
 * The backend validates it against the Supabase JWKS
 * (issuer = `${VITE_SUPABASE_URL}/auth/v1`).
 */
const envBase =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) || "";

export const API_BASE_URL: string = String(envBase).replace(/\/+$/, "");
export const isBackendConfigured = API_BASE_URL.length > 0;

if (!isBackendConfigured && typeof window !== "undefined") {
  // Loud, single-shot dev-console warning.
  // eslint-disable-next-line no-console
  console.warn(
    "[HAWKTRACE] VITE_API_BASE_URL is not set. The frontend cannot reach the tracking backend. " +
      "Set it in your environment (see .env.example) and reload.",
  );
}

export const api = axios.create({
  baseURL: API_BASE_URL || "/__backend_not_configured__",
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  if (!isBackendConfigured) {
    // Fail fast — do not fire requests into the void.
    return Promise.reject({ message: "Backend not configured (VITE_API_BASE_URL missing).", status: 0 });
  }
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      if (data.session?.user?.email) config.headers["X-User"] = data.session.user.email;
      if (data.session?.user?.id) config.headers["X-User-Id"] = data.session.user.id;
    }
  } catch {
    /* unauthenticated — backend will 401 */
  }
  return config;
});

export interface ApiError {
  message: string;
  status?: number;
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err && typeof err === "object" && "status" in err && !(err as any).response) {
      return Promise.reject(err as ApiError);
    }
    const status = err?.response?.status;
    if (status === 401) {
      try { await supabase.auth.signOut(); } catch {}
    }
    const message =
      err?.response?.data?.message ||
      err?.response?.data?.detail ||
      err?.message ||
      "Request failed";
    return Promise.reject({ message, status } as ApiError);
  },
);
