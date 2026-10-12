import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { Category } from "@/types";

export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR<Category[]>("/api/categories", fetcher);

  return {
    categories: data ?? [],
    isLoading,
    isError: !!error,
    mutate,
  };
}
