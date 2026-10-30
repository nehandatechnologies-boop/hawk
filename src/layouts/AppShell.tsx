import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, Camera, Bell, FileBarChart2,
  ScrollText, Settings, UserCircle, HelpCircle, LogOut, Search, ShieldAlert,
  ChevronsLeft, ChevronsRight, ScanFace, UserCog, Building2, Map,
  TerminalSquare, BellRing, HeartPulse,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { GlobalAlertMonitor } from "@/components/GlobalAlertMonitor";
import { CommandPalette } from "@/components/CommandPalette";
import { AlertBell } from "@/components/AlertBell";
import { ConnectivityBadge } from "@/components/ConnectivityBadge";

import type { Role } from "@/types";
import { cn } from "@/lib/utils";





interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles?: Role[];
}

const NAV: NavItem[] = [
  { to: "/dashboard",       label: "Dashboard",            icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/personnel",       label: "Persons of Interest",  icon: <Users className="h-4 w-4" /> },
  { to: "/cameras",         label: "CCTV cameras",         icon: <Camera className="h-4 w-4" /> },
  { to: "/recognition",     label: "Recognition",          icon: <ScanFace className="h-4 w-4" /> },
  { to: "/live-grid",       label: "Live Grid",            icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/geo-map",         label: "Geo-Map Tracking",     icon: <Map className="h-4 w-4" /> },
  { to: "/alerts",          label: "Sighting alerts",      icon: <Bell className="h-4 w-4" /> },
  { to: "/health",          label: "System Health",        icon: <HeartPulse className="h-4 w-4" /> },
  { to: "/reports",         label: "Reports",              icon: <FileBarChart2 className="h-4 w-4" /> },

  { to: "/audit",           label: "Audit log",            icon: <ScrollText className="h-4 w-4" />, roles: ["Administrator", "Auditor", "Supervisor"] },
  { to: "/departments",     label: "Agencies & Units",     icon: <Building2 className="h-4 w-4" />,  roles: ["Administrator", "Supervisor"] },
  { to: "/admin/operators", label: "Operators",            icon: <UserCog className="h-4 w-4" />,    roles: ["Administrator"] },
  { to: "/admin/terminal",  label: "Dev Terminal",         icon: <TerminalSquare className="h-4 w-4" />, roles: ["Administrator"] },
  { to: "/admin/notifications", label: "Notifications",  icon: <BellRing className="h-4 w-4" />, roles: ["Administrator", "Supervisor", "Security Officer", "Operator"] },
  { to: "/settings",        label: "Settings",             icon: <Settings className="h-4 w-4" />,   roles: ["Administrator"] },
];

const BOTTOM_NAV: NavItem[] = [
  { to: "/profile", label: "Profile", icon: <UserCircle className="h-4 w-4" /> },
  { to: "/help",    label: "Help",    icon: <HelpCircle className="h-4 w-4" /> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { user, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Ctrl/Cmd+K opens the command deck from anywhere in the console.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);






  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login", replace: true });
  };

  const visible = (items: NavItem[]) =>
    items.filter((i) => !i.roles || hasRole(...i.roles));

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-16 items-center gap-2 px-4 border-b border-sidebar-border">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldAlert className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display font-semibold text-sm tracking-wide">HAWKTRACE</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">NEHANDA Systems</div>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-3">
          {visible(NAV).map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2 my-0.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="active-pill"
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary"
                  />
                )}
                {item.icon}
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-2 py-3">
          {visible(BOTTOM_NAV).map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent/60"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="relative flex flex-1 max-w-xl items-center gap-2 rounded-md border border-input bg-card px-3 py-2 text-left text-sm text-muted-foreground hover:border-ring"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 truncate">Search subjects, case numbers, cameras, sightings…</span>
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] sm:block">
              ⌘K
            </kbd>
          </button>
          <ConnectivityBadge />
          <AlertBell />


          <div className="flex items-center gap-3 pl-2 border-l border-border">
            <div className="text-right hidden md:block">
              <div className="text-sm font-medium leading-tight">{user?.name}</div>
              <div className="text-xs text-muted-foreground leading-tight">{user?.role}</div>
            </div>
            <div className="h-9 w-9 rounded-full bg-primary/20 text-primary grid place-items-center font-semibold">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>


        <footer className="border-t border-border px-6 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>HAWKTRACE © {new Date().getFullYear()} NEHANDA Systems · Brian Levy Madhobhi</span>
          <span className="font-mono">v1.0.0</span>
        </footer>
      </div>
      <GlobalAlertMonitor />
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

    </div>
  );
}

