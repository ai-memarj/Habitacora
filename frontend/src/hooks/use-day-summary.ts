import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { DaySummary } from "@/types";

/**
 * Hook de ejemplo: trae el resumen agregado de un día (GET /api/summary/{fecha}).
 * Patrón a replicar para el resto de recursos (categorías, racha, etc.):
 * un hook pequeño por recurso, con la key de SWR igual a la ruta de la API
 * para que la invalidación (mutate) sea trivial.
 */
export function useDaySummary(date: string) {
  const { data, error, isLoading, mutate } = useSWR<DaySummary>(
    `/api/summary/${date}`,
    fetcher
  );

  return {
    summary: data,
    isLoading,
    isError: !!error,
    mutate, // llamar tras un POST/PUT/DELETE para revalidar este día
  };
}
