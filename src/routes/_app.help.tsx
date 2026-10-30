import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel } from "@/components/common/Primitives";
import { BookOpen, LifeBuoy, KeyRound, ShieldAlert } from "lucide-react";

function Page() {
  return (
    <>
      <PageHeader title="Help & Support" description="Documentation and contact channels for HAWKTRACE operators." />
      <div className="grid md:grid-cols-2 gap-4">
        <Panel>
          <div className="flex items-start gap-3">
            <BookOpen className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-medium">Operator Handbook</h3>
              <p className="text-sm text-muted-foreground mt-1">Standard operating procedures for personnel, asset, camera and alert workflows.</p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-start gap-3">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-medium">Role & Permission Matrix</h3>
              <p className="text-sm text-muted-foreground mt-1">Administrator · Security Officer · Operator · Supervisor · Auditor · Viewer.</p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-medium">Incident Escalation</h3>
              <p className="text-sm text-muted-foreground mt-1">Critical alerts must be acknowledged within 5 minutes and resolved or escalated within 30.</p>
            </div>
          </div>
        </Panel>
        <Panel>
          <div className="flex items-start gap-3">
            <LifeBuoy className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-medium">Contact NEHANDA Support</h3>
              <p className="text-sm text-muted-foreground mt-1">operations@nehanda.systems · 24/7 SOC desk</p>
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_app/help")({ component: Page });
