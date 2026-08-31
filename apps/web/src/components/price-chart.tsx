import { CandlestickChart as CandlestickChartIcon, LineChart as LineChartIcon } from "lucide-react"
import { useState } from "react"
import { CandlestickChart } from "@/components/candlestick-chart"
import { Button } from "@/components/ui/button"
import { VwapChart } from "@/components/vwap-chart"
import type { Candle } from "@/lib/types"

type ChartMode = "vwap" | "candles"

interface PriceChartProps {
  candles: Candle[]
  className?: string
}

/**
 * Один блок графика с переключением вида: по умолчанию VWAP (линия+заливка), кнопка в правом
 * верхнем углу переключает на свечи+объём и обратно. Кнопка лежит поверх графика (absolute,
 * непрозрачный фон — иначе сливается с линией/свечами под собой) — отдельной строки под неё
 * больше нет, график занимает всю высоту.
 * Технически это не один и тот же chart-инстанс — VwapChart/CandlestickChart каждый создают
 * свой через createChart(), при переключении один размонтируется, другой монтируется. У них
 * слишком разная настройка (у свечей ещё и отдельная под-шкала для объёма), совмещать в одном
 * инстансе сложнее, чем оправдано.
 */
export function PriceChart({ candles, className }: PriceChartProps) {
  const [mode, setMode] = useState<ChartMode>("vwap")

  return (
    <div className={`relative ${className ?? ""}`}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setMode((m) => (m === "vwap" ? "candles" : "vwap"))}
        aria-label={mode === "vwap" ? "Показать свечной график" : "Показать VWAP"}
        title={mode === "vwap" ? "Показать свечной график" : "Показать VWAP"}
        // right-20: правее — перекрывает подписи цены на правой шкале графика (её ширина
        // зависит от длины чисел, точный отступ подобран визуально с запасом).
        className="absolute top-2 right-20 z-10 bg-background shadow-sm hover:bg-muted"
      >
        {mode === "vwap" ? <CandlestickChartIcon /> : <LineChartIcon />}
      </Button>

      {mode === "vwap" ? (
        <VwapChart candles={candles} className="h-full w-full" />
      ) : (
        <CandlestickChart candles={candles} className="h-full w-full" />
      )}
    </div>
  )
}
