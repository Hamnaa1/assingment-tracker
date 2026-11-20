import { dashboardOf, themeOf } from "@/lib/momentum/dashboard";
import { XpProvider } from "@/lib/momentum/social";
import { needsOnboarding } from "@/lib/momentum/onboarding";
import { useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMomentum } from "@/lib/momentum/store";
import { supabase } from "@/integrations/supabase/client";
import { AgentTools } from "./AgentTools";
import { LayoutDashboard, FolderOpen, Sparkles, Timer, ClipboardCheck, Settings, Menu, CalendarDays, ListChecks, Zap, Plus, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePersona } from "./usePersona";

const nav = (v: ReturnType<typeof usePersona>["v"]) => [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/assignments", label: v.myItems, icon: FolderOpen },
  { to: "/planner", label: v.planner, icon: Sparkles },
  { to: "/plan", label: v.plan, icon: ListChecks },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/focus", label: "Focus Mode", icon: Timer },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/review", label: v.review, icon: ClipboardCheck },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Logo() {
  const { v } = usePersona();
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-lavender">
        <Zap className="h-5 w-5 text-white" fill="currentColor" />
      </div>
      <div>
        <p className="text-base font-extrabold tracking-tight text-white">MOMENTUM</p>
        <p className="text-[11px] leading-tight text-sidebar-foreground">{v.tagline}</p>
      </div>
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { v } = usePersona();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {nav(v).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              isActive
                ? "bg-brand-lavender text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white",
            )
          }
        >
          <Icon className="h-4.5 w-4.5 shrink-0" size={18} />
          {label}
        </NavLink>
      ))}
      <div className="mt-auto px-1 pb-2 pt-6">
        <Button
          className="w-full bg-brand-lavender text-white hover:bg-brand-lavender/90"
          onClick={() => {
            onNavigate?.();
            navigate("/planner");
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> New {v.item}
        </Button>
        <button className="mt-3 w-full text-xs text-sidebar-foreground hover:text-white" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

export default function MomentumLayout() {
  const [open, setOpen] = useState(false);
  const { session, authReady, dataReady, state } = useMomentum();
  const theme = themeOf(state.dashboard);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [theme]);
  const a11y = dashboardOf(state.dashboard).accessibility!;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.text = a11y.textSize;
    if (a11y.reducedMotion) root.dataset.motion = "reduce"; else delete root.dataset.motion;
    return () => { delete root.dataset.text; delete root.dataset.motion; };
  }, [a11y.textSize, a11y.reducedMotion]);
  const location = useLocation();
  if (!authReady) return null;
  if (!session) return <Navigate to={"/login?next=" + encodeURIComponent(location.pathname + location.search)} replace />;
  if (!dataReady) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading your workspace…</div>;
  if (needsOnboarding(state)) {
    if (location.pathname !== "/welcome") return <Navigate to="/welcome" replace />;
    // First run after sign-up: onboarding is full screen, before the app itself.
    return (
      <XpProvider>
        <div className="min-h-screen bg-background px-4 py-8 md:py-12">
          <div className="mx-auto mb-8 flex w-full max-w-3xl items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-lavender">
              <Zap className="h-5 w-5 text-white" fill="currentColor" />
            </div>
            <span className="text-base font-extrabold tracking-tight">MOMENTUM</span>
          </div>
          <Outlet />
        </div>
      </XpProvider>
    );
  }

  return (
    <XpProvider>
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-sidebar-border bg-sidebar py-6 md:flex">
        <Logo />
        <NavItems />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col gap-6 border-sidebar-border bg-sidebar p-0 py-6">
              <Logo />
              <NavItems onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-lavender">
              <Zap className="h-4 w-4 text-white" fill="currentColor" />
            </div>
            <span className="text-sm font-extrabold tracking-tight">MOMENTUM</span>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-6xl">
            <AgentTools />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
    </XpProvider>
  );
}
