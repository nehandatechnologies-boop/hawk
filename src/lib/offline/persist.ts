import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import type { QueryClient } from "@tanstack/react-query";

const KEY = "hawktrace-query-cache";
const MAX_AGE = 1000 * 60 * 60 * 24 * 7; // 7 days of field-usable intel

/**
 * Persist the React Query cache so subjects, cameras, alerts and dossiers stay
 * readable while the console is off-network. Browser-only; no-op during SSR.
 */
export function startCachePersistence(queryClient: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: KEY,
      throttleTime: 1500,
    });
    void persistQueryClient({ queryClient, persister, maxAge: MAX_AGE });
  } catch (err) {
    console.warn("[offline] cache persistence unavailable", err);
  }
}

export function clearPersistedCache(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage disabled */
  }
}
