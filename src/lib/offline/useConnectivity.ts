import { useEffect, useState } from "react";

export type LinkState = "live" | "offline" | "checking";

/** Reachability probe — `navigator.onLine` only proves a local link exists. */
async function probe(): Promise<boolean> {
  try {
    const res = await fetch(`/favicon.ico?ping=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
    });
    return res.ok || res.status === 304;
  } catch {
    return false;
  }
}

const listeners = new Set<(s: LinkState) => void>();
let current: LinkState = "checking";
let timer: ReturnType<typeof setInterval> | undefined;

function emit(next: LinkState) {
  if (next === current) return;
  current = next;
  listeners.forEach((l) => l(next));
}

async function refresh() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    emit("offline");
    return;
  }
  emit((await probe()) ? "live" : "offline");
}

export function getLinkState(): LinkState {
  return current;
}

/** Live connectivity state, shared by every subscriber (one probe loop). */
export function useConnectivity(): LinkState {
  const [state, setState] = useState<LinkState>(current);

  useEffect(() => {
    listeners.add(setState);
    if (!timer) {
      void refresh();
      timer = setInterval(() => void refresh(), 20_000);
      window.addEventListener("online", () => void refresh());
      window.addEventListener("offline", () => emit("offline"));
    }
    return () => {
      listeners.delete(setState);
    };
  }, []);

  return state;
}

/** Run `fn` once connectivity returns (or immediately when already live). */
export function onReconnect(fn: () => void): () => void {
  const listener = (s: LinkState) => {
    if (s === "live") fn();
  };
  listeners.add(listener);
  if (current === "live") fn();
  return () => listeners.delete(listener);
}
