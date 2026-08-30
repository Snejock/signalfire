import { useParams, useSearchParams } from "react-router"
import { CandlestickChart } from "@/components/candlestick-chart"
import { ErrorBoundary } from "@/components/error-boundary"
import { NewsFeed } from "@/components/news-feed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCandles, useCompanyName } from "@/lib/queries"
import { TIMEFRAMES, type Timeframe } from "@/lib/types"

function isTimeframe(value: string | null): value is Timeframe {
  return TIMEFRAMES.includes(value as Timeframe)
}

export function Company() {
  const { secId } = useParams<{ secId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  // Таймфрейм — в URL (не в отдельном сторе): переключение шарибл-ссылкой и без лишнего стейта.
  const tfParam = searchParams.get("tf")
  const timeframe: Timeframe = isTimeframe(tfParam) ? tfParam : "1d"

  const companyName = useCompanyName(secId)
  const { data, isPending, isError, error } = useCandles(secId ?? "", timeframe)

  if (!secId) return null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{companyName ?? secId}</h1>
        <ToggleGroup
          value={[timeframe]}
          onValueChange={([next]) => {
            if (next) setSearchParams({ tf: next }, { replace: true })
          }}
        >
          {TIMEFRAMES.map((tf) => (
            <ToggleGroupItem key={tf} value={tf}>
              {tf}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-normal text-muted-foreground">
            {data ? `${data.sec_id} · ${data.board_id}` : "Загрузка…"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPending && <Skeleton className="h-96 w-full" />}
          {isError && (
            <p className="text-muted-foreground text-sm">
              Не удалось загрузить котировки: {error instanceof Error ? error.message : "неизвестная ошибка"}
            </p>
          )}
          {data && data.candles.length === 0 && (
            <p className="text-muted-foreground py-24 text-center text-sm">
              Нет свечей в этом диапазоне.
            </p>
          )}
          {data && data.candles.length > 0 && (
            <ErrorBoundary
              fallback={
                <p className="text-muted-foreground py-24 text-center text-sm">
                  Не удалось отрисовать график.
                </p>
              }
            >
              <CandlestickChart candles={data.candles} className="h-96 w-full" />
            </ErrorBoundary>
          )}
        </CardContent>
      </Card>

      <NewsFeed />
    </div>
  )
}
