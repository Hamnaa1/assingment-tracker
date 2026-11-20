import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMomentum } from "./store";
import { dashboardOf } from "./dashboard";
import { ACHIEVEMENTS, DEFAULT_REWARDS, levelFor, type AchievementId, type RewardReason } from "./xp";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"student_profiles">;
export type XpTx = Pick<Tables<"xp_transactions">, "amount" | "reason" | "ref" | "activity_at">;

interface XpCtx {
  profile: Profile | null;
  txs: XpTx[];
  achievements: { achievement: string; unlocked_at: string }[];
  rewards: Record<RewardReason, number>;
  totalXp: number;
  celebrate: boolean;
  refresh: () => Promise<void>;
  setProfile: (p: Profile) => void;
}

const Ctx = createContext<XpCtx | null>(null);

export function XpProvider({ children }: { children: ReactNode }) {
  const { session, state } = useMomentum();
  const userId = session?.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [txs, setTxs] = useState<XpTx[]>([]);
  const [achievements, setAchievements] = useState<XpCtx["achievements"]>([]);
  const [rewards] = useState(Object.fromEntries(Object.entries(DEFAULT_REWARDS).map(([k, v]) => [k, v.amount])) as Record<RewardReason, number>);
  const [celebrate, setCelebrate] = useState(false);
  const notif = dashboardOf(state.dashboard).notifications!;
  const notifRef = useRef(notif);
  notifRef.current = notif;
  const levelRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [{ data: p }, { data: t }, { data: a }] = await Promise.all([
      supabase.rpc("ensure_profile"),
      supabase.from("xp_transactions").select("amount, reason, ref, activity_at").eq("user_id", userId).order("activity_at"),
      supabase.from("student_achievements").select("achievement, unlocked_at").eq("user_id", userId),
    ]);
    if (p) setProfile(p as Profile);
    setTxs(t ?? []);
    setAchievements(a ?? []);
  }, [userId]);

  useEffect(() => {
    levelRef.current = null;
    if (userId) supabase.rpc("sync_xp", { p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" }).then(() => refresh());
  }, [userId, refresh]);

  useEffect(() => {
    const onXp = (e: Event) => {
      const d = (e as CustomEvent).detail as { awarded?: { amount: number; reason: RewardReason }[]; achievements?: AchievementId[] } | null;
      const gained = (d?.awarded ?? []).reduce((s, x) => s + x.amount, 0);
      if (gained > 0 && notifRef.current.xp) toast.success(`+${gained} XP`, { description: "Nice work — keep your momentum going." });
      if (notifRef.current.achievements) (d?.achievements ?? []).forEach((id) => ACHIEVEMENTS[id] && toast(`${ACHIEVEMENTS[id].emoji} Achievement unlocked: ${ACHIEVEMENTS[id].label}`));
      if (gained > 0 || d?.achievements?.length) refresh();
    };
    window.addEventListener("momentum:xp", onXp);
    return () => window.removeEventListener("momentum:xp", onXp);
  }, [refresh]);

  const totalXp = useMemo(() => txs.reduce((s, t) => s + t.amount, 0), [txs]);
  useEffect(() => {
    const lvl = levelFor(totalXp).level;
    if (levelRef.current !== null && lvl > levelRef.current) {
      setCelebrate(true);
      toast.success(`Level ${lvl}! You're now a ${levelFor(totalXp).title}.`);
      setTimeout(() => setCelebrate(false), 2500);
    }
    if (txs.length || levelRef.current === null) levelRef.current = lvl;
  }, [totalXp, txs.length]);

  const value = useMemo(() => ({ profile, txs, achievements, rewards, totalXp, celebrate, refresh, setProfile }), [profile, txs, achievements, rewards, totalXp, celebrate, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useXp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useXp must be used inside XpProvider");
  return c;
}
