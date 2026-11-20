import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMomentum } from "@/lib/momentum/store";
import { usePersona } from "./usePersona";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function initialsOf(name: string) {
  const parts = name.trim().split(/[\s._@-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Account menu: shows who is signed in (name, email, role) and lets them log out. */
export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { session } = useMomentum();
  const { persona } = usePersona();
  const navigate = useNavigate();
  const email = session?.user.email ?? "";
  const [name, setName] = useState<string>("");

  useEffect(() => {
    if (!session) return;
    let active = true;
    supabase.rpc("ensure_profile").then(({ data }) => {
      const row = data as { display_name?: string } | null;
      if (active && row?.display_name) setName(row.display_name);
    });
    return () => { active = false; };
  }, [session]);

  const display = name || (session?.user.user_metadata?.full_name as string | undefined) || email.split("@")[0] || "You";
  const role = persona === "professional" ? "Professional" : "Student";

  async function logOut() {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error("Couldn't log out. Please try again.");
    navigate("/login", { replace: true });
    toast.success("You've logged out. Your work is saved for next time.");
  }

  const avatar = (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-lavender text-xs font-bold text-white">{initialsOf(display)}</span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-2.5 rounded-lg text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          compact ? "p-0.5" : "mt-3 w-full p-2 hover:bg-sidebar-accent",
        )}
      >
        {avatar}
        {!compact && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{display}</span>
            <span className="block truncate text-[11px] text-sidebar-foreground">{role}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-semibold">{display}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <span className="mt-1.5 inline-block rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold">{role}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/friends")}><UserRound className="mr-2 h-4 w-4" />Edit public profile</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate("/welcome")}><Settings className="mr-2 h-4 w-4" />Edit my preferences</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logOut} className="text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
