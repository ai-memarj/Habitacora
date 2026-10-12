import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Routine } from "@/types";

export function useRoutines() {
  const { data, error, isLoading, mutate } = useSWR<Routine[]>("/api/routines", fetcher);

  return {
    routines: data ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}

export function useRoutine(id: number | null) {
  const key = id !== null ? `/api/routines/${id}` : null;
  const { data, error, isLoading, mutate } = useSWR<Routine>(key, fetcher);

  return {
    routine: data,
    isLoading,
    isError: !!error,
    mutate,
  };
}
