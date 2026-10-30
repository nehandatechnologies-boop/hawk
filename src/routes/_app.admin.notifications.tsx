import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BellRing, Slack, Smartphone, TestTube2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import {
  getPushConfig,
  getSlackWebhook,
  listMyPushDevices,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  setSlackWebhook,
  testSlackWebhook,
} from "@/lib/push.functions";
import {
  notificationPermission,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/pushClient";

export const Route = createFileRoute("/_app/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Alert Notifications · HAWKTRACE" },
      {
        name: "description",
        content:
          "Configure 24/7 HAWKTRACE alerting: desktop notifications, Web Push devices and the Slack operations channel.",
      },
      { property: "og:title", content: "Alert Notifications · HAWKTRACE" },
      {
        property: "og:description",
        content: "Desktop, Web Push and Slack delivery for critical sighting matches.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { hasRole } = useAuth();
  const qc = useQueryClient();
  const isAdmin = hasRole("Administrator");

  const config = useQuery({ queryKey: ["push", "config"], queryFn: () => getPushConfig() });
  const devices = useQuery({ queryKey: ["push", "devices"], queryFn: () => listMyPushDevices() });
  const slack = useQuery({
    queryKey: ["push", "slack"],
    queryFn: () => getSlackWebhook(),
    enabled: isAdmin,
  });

  const save = useServerFn(savePushSubscription);
  const remove = useServerFn(removePushSubscription);
  const test = useServerFn(sendTestPush);
  const saveSlack = useServerFn(setSlackWebhook);
  const pingSlack = useServerFn(testSlackWebhook);

  const [permission, setPermission] = useState<string>("default");
  const [slackUrl, setSlackUrlValue] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  const enable = useMutation({
    mutationFn: async () => {
      const key = config.data?.publicKey;
      if (!key) throw new Error("Push is not configured on this deployment.");
      const sub = await subscribeToPush(key);
      if (!sub) throw new Error("Permission denied or unsupported browser.");
      const res = await save({ data: { ...sub, userAgent: navigator.userAgent } });
      if (!res.ok) throw new Error(res.error ?? "Could not register device.");
    },
    onSuccess: () => {
      setPermission(notificationPermission());
      toast.success("This device will now receive push alerts.");
      qc.invalidateQueries({ queryKey: ["push", "devices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await remove({ data: { endpoint } });
    },
    onSuccess: () => {
      toast.success("Push disabled on this device.");
      qc.invalidateQueries({ queryKey: ["push", "devices"] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-wide">Alert notifications</h1>
        <p className="text-sm text-muted-foreground">
          Round-the-clock delivery of sighting matches — desktop notifications, Web Push to
          registered devices, and the Slack operations channel.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BellRing className="h-4 w-4 text-primary" /> This device
          </CardTitle>
          <CardDescription>
            Push works even when the HAWKTRACE tab is closed, as long as the browser is running.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={permission === "granted" ? "default" : "outline"}>
              Permission: {permission}
            </Badge>
            <Badge variant={config.data?.configured ? "default" : "destructive"}>
              Push service: {config.data?.configured ? "configured" : "unavailable"}
            </Badge>
            <Badge variant={pushSupported() ? "outline" : "destructive"}>
              Browser support: {pushSupported() ? "yes" : "no"}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => enable.mutate()}
              disabled={enable.isPending || !config.data?.configured}
            >
              <Smartphone className="mr-2 h-3.5 w-3.5" /> Enable push on this device
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                setBusy(true);
                const res = await test({ data: undefined as never }).catch(() => null);
                setBusy(false);
                if (res?.ok) toast.success(`Test push sent to ${res.sent} device(s).`);
                else toast.error("No device received the test push.");
              }}
              disabled={busy}
            >
              <TestTube2 className="mr-2 h-3.5 w-3.5" /> Send test push
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => disable.mutate()}
              disabled={disable.isPending}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Disable on this device
            </Button>
          </div>

          <div className="rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Registered</th>
                </tr>
              </thead>
              <tbody>
                {(devices.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-4 text-muted-foreground">
                      No devices registered yet.
                    </td>
                  </tr>
                )}
                {(devices.data ?? []).map((d) => (
                  <tr key={d.id} className="border-t border-border">
                    <td className="px-3 py-2">{d.user_agent || "Unknown device"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(d.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Slack className="h-4 w-4 text-primary" /> Slack operations channel
            </CardTitle>
            <CardDescription>
              Paste a Slack incoming-webhook URL. Every sighting posts a redacted summary to that
              channel for 24/7 watch coverage.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {slack.data?.configured && (
              <p className="text-xs text-muted-foreground">
                Currently configured: <span className="font-mono">{slack.data.url}</span>
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                value={slackUrl}
                onChange={(e) => setSlackUrlValue(e.target.value)}
                placeholder="https://hooks.slack.com/services/T000/B000/xxxx"
                className="max-w-xl font-mono text-xs"
              />
              <Button
                size="sm"
                onClick={async () => {
                  const res = await saveSlack({ data: { url: slackUrl.trim() } }).catch(
                    () => null,
                  );
                  if (res?.ok) {
                    toast.success(
                      res.configured ? "Slack channel saved." : "Slack channel cleared.",
                    );
                    setSlackUrlValue("");
                    qc.invalidateQueries({ queryKey: ["push", "slack"] });
                  } else {
                    toast.error("Invalid Slack webhook URL.");
                  }
                }}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const res = await pingSlack({ data: undefined as never }).catch(() => null);
                  if (res?.ok) toast.success("Test message posted to Slack.");
                  else toast.error("Slack test failed — check the webhook URL.");
                }}
              >
                <TestTube2 className="mr-2 h-3.5 w-3.5" /> Test
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
