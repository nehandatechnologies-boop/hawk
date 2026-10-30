import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import {
  Users, UserCheck, ScanFace, Camera as CameraIcon, BellRing, CheckCircle2,
  Activity, Cpu, PlusCircle, Upload, FileBarChart2, ShieldCheck,
} from "lucide-react";
import { dashboardService } from "@/services/resources";
import { PageHeader, Panel, StatCard, LoadingSkeleton, StatusPill } from "@/components/common/Primitives";
import { Link } from "@tanstack/react-router";

const CHART_COLORS = ["var(--color-chart-1)","var(--color-chart-2)","var(--color-chart-3)","var(--color-chart-4)","var(--color-chart-5)"];

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardService.stats });

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        description="Real-time situational awareness across persons of interest, CCTV cameras and sighting alerts."
        actions={
          <>
            <Link to="/alerts" className="rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">View alerts</Link>
            <Link to="/reports" className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90">Generate report</Link>
          </>
        }
      />

      {isLoading || !data ? (
        <LoadingSkeleton rows={6} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
            <StatCard index={0} label="Subjects on file"   value={data.totalPersonnel} icon={<Users className="h-4 w-4" />} />
            <StatCard index={1} label="Active cases"       value={data.activePersonnel} icon={<UserCheck className="h-4 w-4" />} tone="success" />
            <StatCard index={2} label="Enrolled faces"     value={data.totalAssets} icon={<ScanFace className="h-4 w-4" />} tone="info" />
            <StatCard index={3} label="Online cameras"     value={`${data.onlineCameras}/${data.totalCameras}`} icon={<CameraIcon className="h-4 w-4" />} tone="success" />
            <StatCard index={4} label="Open alerts"        value={data.openAlerts} icon={<BellRing className="h-4 w-4" />} tone="danger" />
            <StatCard index={5} label="Resolved alerts"    value={data.closedAlerts} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
            <StatCard index={6} label="Today's activity"   value={data.todayActivity} icon={<Activity className="h-4 w-4" />} />
            <StatCard index={7} label="System health"      value={`${data.systemHealth}%`} icon={<Cpu className="h-4 w-4" />} tone="success" />
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <Panel title="Monthly Alerts" className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer>
                  <AreaChart data={data.monthlyAlerts}>
                    <defs>
                      {["c1","c2","c3","c4"].map((id, i) => (
                        <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS[i]} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={CHART_COLORS[i]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area dataKey="critical" stackId="1" stroke={CHART_COLORS[3]} fill="url(#c4)" />
                    <Area dataKey="high" stackId="1" stroke={CHART_COLORS[0]} fill="url(#c1)" />
                    <Area dataKey="medium" stackId="1" stroke={CHART_COLORS[1]} fill="url(#c2)" />
                    <Area dataKey="low" stackId="1" stroke={CHART_COLORS[2]} fill="url(#c3)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Camera Status">
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.cameraStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {data.cameraStatus.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--color-card)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <Panel title="Subjects by Category" className="lg:col-span-1">
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={data.subjectCategories ?? []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={3}>
                      {(data.subjectCategories ?? []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--color-card)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Subjects by Issuing Agency" className="lg:col-span-2">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={data.personnelDistribution} layout="vertical">
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={11} />
                    <YAxis type="category" dataKey="department" stroke="var(--color-muted-foreground)" fontSize={11} width={180} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="count" fill="var(--color-chart-2)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Panel title="Recent Activity" className="lg:col-span-2">
              <ul className="divide-y divide-border">
                {data.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.action}</div>
                      <div className="text-xs text-muted-foreground">{a.user}</div>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{new Date(a.time).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            </Panel>

            <div className="space-y-4">
              <Panel title="Quick Actions">
                <div className="grid grid-cols-2 gap-2">
                  <Link to="/personnel" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
                    <PlusCircle className="h-4 w-4 text-primary" /> Add subject
                  </Link>
                  <Link to="/recognition" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
                    <ScanFace className="h-4 w-4 text-primary" /> Enroll face
                  </Link>
                  <Link to="/cameras" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
                    <CameraIcon className="h-4 w-4 text-primary" /> Register camera
                  </Link>
                  <Link to="/reports" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
                    <FileBarChart2 className="h-4 w-4 text-primary" /> Report
                  </Link>
                  <Link to="/personnel" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
                    <Upload className="h-4 w-4 text-primary" /> Import CSV
                  </Link>
                  <Link to="/settings" className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Policies
                  </Link>
                </div>
              </Panel>
              <Panel title="Watchlist alerts">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2"><StatusPill status="Critical" /><span>Armed suspect WNT-1014 sighted · Mbare Musika</span></li>
                  <li className="flex items-start gap-2"><StatusPill status="High" /><span>Missing minor MP-1027 sighted · Bulawayo CBD</span></li>
                  <li className="flex items-start gap-2"><StatusPill status="Medium" /><span>POI-1042 loitering · Engine Garage, Masvingo</span></li>
                </ul>
              </Panel>
            </div>
          </div>
        </>
      )}
    </>
  );
}

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});
