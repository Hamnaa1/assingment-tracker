import { useEffect, useState, type ReactNode } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useXp } from "@/lib/momentum/social";
import { ACHIEVEMENTS, ALL_ACHIEVEMENTS, levelFor, type AchievementId } from "@/lib/momentum/xp";
import { cn } from "@/lib/utils";

/** Reads a theme CSS variable so charts follow the student's colour theme. */
export function useCssVar(name: string, fallback: string) {
  const [v, setV] = useState(fallback);
  useEffect(() => {
    const read = () => setV(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback);
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [name, fallback]);
  return v;
}

export function ProgressRing({ value, size = 96, stroke = 10, label, children }: { value: number; size?: number; stroke?: number; label: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${Math.round(pct)}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-brand-soft-purple" />
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeLinecap="round" className="fill-none stroke-brand-lavender transition-[stroke-dashoffset] duration-700" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function XpCard({ compact }: { compact?: boolean }) {
  const { totalXp, achievements, celebrate } = useXp();
  const lv = levelFor(totalXp);
  const recent = [...achievements].sort((a, b) => b.unlocked_at.localeCompare(a.unlocked_at))[0];
  const ach = recent && ACHIEVEMENTS[recent.achievement as AchievementId];
  return (
    <Card className={cn("h-full overflow-hidden border-border/80 shadow-sm", celebrate && "animate-xp-pop ring-2 ring-brand-lavender")}>
      <CardContent className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-lavender text-lg font-extrabold text-white" aria-label={`Level ${lv.level}`}>{lv.level}</div>
            <div>
              <p className="text-sm font-extrabold">{lv.title}</p>
              <p className="text-xs text-muted-foreground">{totalXp.toLocaleString()} XP total</p>
            </div>
          </div>
          <Sparkles className="h-5 w-5 text-brand-lavender" aria-hidden />
        </div>
        <div>
          <div className="h-3 overflow-hidden rounded-full bg-brand-soft-purple" role="progressbar" aria-valuenow={lv.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to next level">
            <div className="h-full rounded-full bg-brand-lavender transition-[width] duration-1000" style={{ width: `${lv.pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{lv.toNext} XP to level {lv.level + 1}</p>
        </div>
        {!compact && (
          <p className="mt-auto truncate text-xs">
            {ach ? <><span aria-hidden>{ach.emoji}</span> Latest: <span className="font-bold">{ach.label}</span></> : <span className="text-muted-foreground">Finish a focus session to earn your first badge.</span>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function AchievementGrid() {
  const { achievements } = useXp();
  const got = new Set(achievements.map((a) => a.achievement));
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
      {ALL_ACHIEVEMENTS.map((id) => {
        const a = ACHIEVEMENTS[id], on = got.has(id);
        return (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button type="button" className={cn("flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border p-1 text-center", on ? "border-brand-lavender bg-brand-soft-purple" : "bg-muted text-muted-foreground")} aria-label={`${a.label}: ${on ? "unlocked" : "locked"}. ${a.hint}`}>
                <span className={cn("text-2xl", !on && "grayscale opacity-40")} aria-hidden>{a.emoji}</span>
                <span className="line-clamp-1 text-[10px] font-bold">{on ? a.label : <Lock className="inline h-3 w-3" />}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent><p className="font-bold">{a.label}</p><p className="text-xs">{a.hint}</p></TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
