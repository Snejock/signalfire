import { useParams, useSearchParams } from "react-router"
import { ErrorBoundary } from "@/components/error-boundary"
import { NewsFeed } from "@/components/news-feed"
import { PriceChart } from "@/components/price-chart"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useCandles, useCompanyName } from "@/lib/queries"
import { TIMEFRAMES, type Timeframe } from "@/lib/types"
import { useSlidingIndicator } from "@/lib/use-sliding-indicator"

function isTimeframe(value: string | null): value is Timeframe {
  return TIMEFRAMES.includes(value as Timeframe)
}

export function Company() {
  const { secId } = useParams<{ secId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  // Таймфрейм — в URL (не в отдельном сторе): переключение шарибл-ссылкой и без лишнего стейта.
  const tfParam = searchParams.get("tf")
  const timeframe: Timeframe = isTimeframe(tfParam) ? tfParam : "15m"

  const companyName = useCompanyName(secId)
  const { data, isPending, isError, error } = useCandles(secId ?? "", timeframe)
  const { containerRef: timeframeRef, style: indicatorStyle } = useSlidingIndicator(timeframe)

  if (!secId) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{companyName ?? secId}</h1>
        <div ref={timeframeRef} className="relative">
          {/* Подложка под активным таймфреймом — "переезжает" через CSS-transition
              (left/width считает useSlidingIndicator), вместо мгновенного
              появления/исчезания фона на каждой кнопке по отдельности. */}
          {indicatorStyle && (
            <div
              className="bg-muted absolute top-1 bottom-1 z-0 rounded-md transition-[left,width] duration-200 ease-out"
              style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
            />
          )}
          <ToggleGroup
            value={[timeframe]}
            onValueChange={([next]) => {
              if (next) setSearchParams({ tf: next }, { replace: true })
            }}
          >
            {TIMEFRAMES.map((tf) => (
              <ToggleGroupItem
                key={tf}
                value={tf}
                className="relative z-10 aria-pressed:bg-transparent"
              >
                {tf}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>

      {/* Без Card: ни рамки (ring/shadow), ни лишних отступов по бокам — график занимает
          всю доступную ширину, в духе tradingview.com/symbols/.../ (блоки разделены
          только отступами/типографикой, а не рамками). */}
      <section className="space-y-2">
        {isPending && (
          <>
            <p className="text-sm text-muted-foreground">Загрузка…</p>
            <Skeleton className="h-96 w-full" />
          </>
        )}
        {isError && (
          <p className="text-muted-foreground text-sm">
            Не удалось загрузить котировки: {error instanceof Error ? error.message : "неизвестная ошибка"}
          </p>
        )}
        {data && data.candles.length === 0 && (
          <p className="text-muted-foreground py-24 text-center text-sm">
            Нет данных в этом диапазоне.
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
            <PriceChart candles={data.candles} className="h-96 w-full" />
          </ErrorBoundary>
        )}
      </section>

      <NewsFeed />
    </div>
  )
}
