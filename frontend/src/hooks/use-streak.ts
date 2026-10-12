import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Streak } from "@/types";

export function useStreak() {
  const { data, isLoading, mutate } = useSWR<Streak>("/api/stats/streak", fetcher);

  return {
    streak: data?.streak ?? 0,
    todayLogged: data?.today_logged ?? false,
    isLoading,
    mutate,
  };
}
