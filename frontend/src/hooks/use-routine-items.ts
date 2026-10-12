import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { RoutineItem } from "@/types";

/**
 * Items de una rutina en un rango de fechas [start, end] inclusive —
 * pensado para pintar un mes entero del calendario de una vez.
 */
export function useRoutineItems(routineId: number | null, start: string, end: string) {
  const key = routineId !== null ? `/api/routines/${routineId}/items?start=${start}&end=${end}` : null;
  const { data, error, isLoading, mutate } = useSWR<RoutineItem[]>(key, fetcher);

  return {
    items: data ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}
