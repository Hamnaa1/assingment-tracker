import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useXp } from "./social";
import { periodRange, rankBoard, type BoardMetric, type BoardPeriod, type BoardRow } from "./xp";

/** Friends leaderboard from real XP history; includes rank change vs the previous period. */
export function useLeaderboard(period: BoardPeriod = "week", metric: BoardMetric = "xp") {
  const { totalXp } = useXp();
  const [rows, setRows] = useState<(ReturnType<typeof rankBoard>[number] & { change: number | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const cur = periodRange(period), prev = periodRange(period, new Date(), 1);
    const [{ data: a }, { data: b }] = await Promise.all([
      supabase.rpc("friend_leaderboard", { p_from: cur.from.toISOString(), p_to: cur.to.toISOString() }),
      period === "all" ? Promise.resolve({ data: null }) : supabase.rpc("friend_leaderboard", { p_from: prev.from.toISOString(), p_to: prev.to.toISOString() }),
    ]);
    const now = rankBoard((a ?? []) as BoardRow[], metric, cur.days);
    const before = b ? rankBoard(b as BoardRow[], metric, prev.days) : [];
    setRows(now.map((r) => { const p = before.find((x) => x.user_id === r.user_id); return { ...r, change: p ? p.rank - r.rank : null }; }));
    setLoading(false);
  }, [period, metric]);

  useEffect(() => { load(); }, [load, totalXp]);
  return { rows, loading, reload: load };
}
