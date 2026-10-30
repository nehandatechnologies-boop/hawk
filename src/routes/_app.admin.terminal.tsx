import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { TerminalSquare, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/common/Primitives";
import { useAuth } from "@/context/AuthContext";
import {
  pingCamera,
  replayAlerts,
  runDevSql,
  tailLogs,
  workerControl,
} from "@/lib/devTerminal.functions";

type Line = { kind: "cmd" | "out" | "err" | "sys"; text: string; at: string };

const HELP = `HawkTrace Developer Terminal
  Commands (admin-only, every call is audited):
    help                              show this message
    clear                             clear the buffer
    sql <read-only query>             run SELECT / WITH / SHOW / EXPLAIN / TABLE
    ping <camera_id>                  check a camera stream url
    replay [n=5]                      re-broadcast the last N alerts
    logs [n=40]                       tail audit + escalation rows
    worker restart|reload-model|resync-cameras
                                      dispatch a worker control signal
    eval <js>                         evaluate JS in this browser tab (client-only)
`;

const fmt = (v: unknown) =>
  typeof v === "string" ? v : JSON.stringify(v, null, 2);

function Page() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("Administrator");

  const runSql = useServerFn(runDevSql);
  const runPing = useServerFn(pingCamera);
  const runReplay = useServerFn(replayAlerts);
  const runLogs = useServerFn(tailLogs);
  const runWorker = useServerFn(workerControl);

  const [lines, setLines] = useState<Line[]>(() => [
    { kind: "sys", text: HELP, at: new Date().toISOString() },
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bufRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bufRef.current?.scrollTo({ top: bufRef.current.scrollHeight });
  }, [lines]);

  const prompt = useMemo(() => {
    const who = user?.email?.split("@")[0] ?? "admin";
    return `${who}@hawktrace:~$`;
  }, [user?.email]);

  function push(kind: Line["kind"], text: string) {
    setLines((L) => [...L, { kind, text, at: new Date().toISOString() }]);
  }

  async function dispatch(raw: string) {
    const line = raw.trim();
    if (!line) return;
    push("cmd", `${prompt} ${line}`);
    setHistory((h) => [line, ...h].slice(0, 100));
    setCursor(-1);

    const [head, ...rest] = line.split(" ");
    const argstr = rest.join(" ");

    try {
      setBusy(true);
      switch (head) {
        case "help":
          push("sys", HELP);
          break;
        case "clear":
          setLines([]);
          break;
        case "sql": {
          if (!argstr) throw new Error("usage: sql <query>");
          const res = (await runSql({ data: { sql: argstr } })) as { rows: unknown[] };
          push("out", fmt(res.rows));
          break;
        }
        case "ping": {
          if (!argstr) throw new Error("usage: ping <camera_id>");
          const res = await runPing({ data: { cameraId: argstr } });
          push("out", fmt(res));
          break;
        }
        case "replay": {
          const n = argstr ? Number(argstr) : 5;
          const res = (await runReplay({ data: { count: n } })) as { replayed: number };
          push("out", `replayed ${res.replayed} alerts`);
          break;
        }
        case "logs": {
          const n = argstr ? Number(argstr) : 40;
          const res = (await runLogs({ data: { limit: n } })) as { audits: unknown[]; escalations: unknown[] };
          push(
            "out",
            `--- audit (${res.audits.length}) ---\n${fmt(res.audits)}\n--- escalations (${res.escalations.length}) ---\n${fmt(res.escalations)}`,
          );
          break;
        }

        case "worker": {
          const cmd = rest[0] as "restart" | "reload-model" | "resync-cameras";
          if (!cmd) throw new Error("usage: worker restart|reload-model|resync-cameras");
          const res = await runWorker({ data: { command: cmd } });
          push("out", fmt(res));
          break;
        }
        case "eval": {
          if (!argstr) throw new Error("usage: eval <js>");
          // eslint-disable-next-line no-new-func
          const result = await Promise.resolve(new Function(`return (${argstr})`)());
          push("out", fmt(result));
          break;
        }
        default:
          throw new Error(`unknown command: ${head}. type 'help'.`);
      }
    } catch (e) {
      push("err", e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Developer Terminal" description="Administrator role required." />
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          You need the Administrator role to access this terminal.
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Developer Terminal"
        description="Admin-only, audited console: read-only SQL, camera checks, log tail, worker control."
      />
      <div className="rounded-lg border border-border bg-black/90 text-emerald-300 font-mono text-[12.5px] shadow-inner flex flex-col overflow-hidden" style={{ height: "72vh" }}>
        <div className="flex items-center justify-between border-b border-emerald-500/20 px-3 py-2 text-emerald-400">
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-4 w-4" />
            <span className="text-xs uppercase tracking-widest">hawktrace / dev</span>
          </div>
          <button
            onClick={() => setLines([])}
            className="flex items-center gap-1 text-[11px] text-emerald-400/70 hover:text-emerald-300"
            title="Clear buffer"
          >
            <Trash2 className="h-3 w-3" /> clear
          </button>
        </div>

        <div ref={bufRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1 whitespace-pre-wrap">
          {lines.map((l, i) => (
            <div
              key={i}
              className={
                l.kind === "cmd"
                  ? "text-emerald-200"
                  : l.kind === "err"
                    ? "text-red-400"
                    : l.kind === "sys"
                      ? "text-cyan-300/80"
                      : "text-emerald-300/90"
              }
            >
              {l.text}
            </div>
          ))}
          {busy && <div className="text-emerald-500/70 animate-pulse">…running</div>}
        </div>

        <form
          className="flex items-center gap-2 border-t border-emerald-500/20 px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            const v = input;
            setInput("");
            void dispatch(v);
          }}
        >
          <span className="text-emerald-400 shrink-0">{prompt}</span>
          <input
            className="flex-1 bg-transparent outline-none text-emerald-100 placeholder:text-emerald-700"
            placeholder="type 'help' and press enter"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                const next = Math.min(cursor + 1, history.length - 1);
                if (history[next] !== undefined) {
                  setCursor(next);
                  setInput(history[next]);
                }
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                const next = cursor - 1;
                if (next < 0) {
                  setCursor(-1);
                  setInput("");
                } else {
                  setCursor(next);
                  setInput(history[next] ?? "");
                }
              }
            }}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </form>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_app/admin/terminal")({
  beforeLoad: () => {
    // Route-level admin gate is a hint; the real check runs on every server fn.
    return {};
  },
  component: Page,
  onError: () => {
    throw redirect({ to: "/dashboard" });
  },
});
