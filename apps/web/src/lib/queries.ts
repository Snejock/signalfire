import { useInfiniteQuery, useQuery, type UseQueryResult } from "@tanstack/react-query"
import { fetchCandles, fetchCompanies, fetchNews } from "./api"
import type { Company, Timeframe } from "./types"

export function useCompanies(): UseQueryResult<Company[]> {
  return useQuery({
    queryKey: ["companies"],
    queryFn: fetchCompanies,
    staleTime: 60_000,
  })
}

/** Резолвит имя компании из уже загруженного кэша ['companies'], без отдельного запроса. */
export function useCompanyName(secId: string | undefined): string | undefined {
  const { data } = useCompanies()
  return data?.find((c) => c.sec_id === secId)?.name ?? undefined
}

export function useCandles(secId: string, timeframe: Timeframe) {
  return useQuery({
    queryKey: ["candles", secId, timeframe],
    queryFn: () => fetchCandles(secId, timeframe),
    enabled: Boolean(secId),
    // Свечи меняются часто (moex-fetcher публикует сделки почти в реальном времени) —
    // фоновый рефетч раз в 15с, пока график открыт.
    refetchInterval: 15_000,
    staleTime: 10_000,
  })
}

export function useNews(limit = 20) {
  return useInfiniteQuery({
    queryKey: ["news", limit],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => fetchNews(pageParam, limit),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 30_000,
  })
}
