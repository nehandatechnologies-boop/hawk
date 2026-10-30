import { supabase } from "@/integrations/supabase/client";

/**
 * Offline sighting outbox.
 *
 * A match made while the console is off-network is still evidence. The alert
 * row is queued locally (durably, in localStorage) and replayed in order once
 * connectivity returns, preserving the original detection timestamp.
 */

const KEY = "hawktrace-alert-outbox";

export interface QueuedAlert {
  queuedAt: string;
  row: Record<string, unknown>;
}

function read(): QueuedAlert[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedAlert[]) : [];
  } catch {
    return [];
  }
}

function write(items: QueuedAlert[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    /* storage full or disabled */
  }
}

export function outboxSize(): number {
  if (typeof window === "undefined") return 0;
  return read().length;
}

export function queueAlert(row: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const items = read();
  items.push({ queuedAt: new Date().toISOString(), row });
  write(items.slice(-500));
  window.dispatchEvent(new Event("hawktrace-outbox-change"));
}

let flushing = false;

/** Replay queued sightings oldest-first. Returns how many landed. */
export async function flushOutbox(): Promise<number> {
  if (typeof window === "undefined" || flushing) return 0;
  const items = read();
  if (items.length === 0) return 0;

  flushing = true;
  let sent = 0;
  try {
    for (const item of items) {
      const { error } = await supabase.from("alerts").insert(item.row as never);
      if (error) break; // stop on first failure; keep causal order
      sent += 1;
    }
    write(items.slice(sent));
    if (sent > 0) window.dispatchEvent(new Event("hawktrace-outbox-change"));
  } finally {
    flushing = false;
  }
  return sent;
}
