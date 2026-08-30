import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { useEffect, useRef } from "react"
import type { Candle } from "@/lib/types"

/**
 * Читает CSS custom property и резолвит её в rgba() через растеризацию в canvas.
 *
 * Наши design-токены (index.css, из shadcn init) заданы в oklch() — современном CSS
 * color-функции, который умеет парсить браузер, но не встроенный лёгкий цветовой парсер
 * lightweight-charts (падает с "Failed to parse color: oklch(...)" и рушит весь React-поддерево,
 * т.к. это происходит в эффекте без error boundary). getComputedStyle() здесь не помогает —
 * в актуальных браузерах computed value для color сохраняет исходную color-функцию как есть
 * (проверено вживую), а не даунгрейдит в rgb(). Единственный надёжный способ получить настоящий
 * sRGB — отрисовать 1×1 пиксель в canvas и прочитать его через getImageData: canvas обязан
 * растеризовать в реальные байты независимо от того, как строка сериализуется обратно.
 */
function resolveCssColor(varName: string, fallback: string): string {
  if (typeof window === "undefined") return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!raw) return fallback

  try {
    const canvas = document.createElement("canvas")
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return fallback

    ctx.fillStyle = raw
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
  } catch {
    return fallback
  }
}

function toChartData(candles: Candle[]) {
  return candles.map((c) => ({
    // ClickHouse-DateTime -> unix-секунды: lightweight-charts работает с UTCTimestamp,
    // а не ISO-строками (см. план: конвертация — забота фронтенда, не формы API).
    time: Math.floor(new Date(c.ts).getTime() / 1000) as UTCTimestamp,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }))
}

interface CandlestickChartProps {
  candles: Candle[]
  className?: string
}

export function CandlestickChart({ candles, className }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)

  // Создаём инстанс графика один раз на монтирование контейнера.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const upColor = resolveCssColor("--candle-up", "#22c55e")
    const downColor = resolveCssColor("--candle-down", "#ef4444")
    const textColor = resolveCssColor("--muted-foreground", "#71717a")
    const gridColor = resolveCssColor("--border", "#e4e4e7")

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      timeScale: { timeVisible: true, secondsVisible: false },
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
    })

    chartRef.current = chart
    seriesRef.current = series

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Данные обновляются отдельно (при рефетче react-query) — без пересоздания графика.
  useEffect(() => {
    if (!seriesRef.current) return
    seriesRef.current.setData(toChartData(candles))
    chartRef.current?.timeScale().fitContent()
  }, [candles])

  return <div ref={containerRef} className={className} />
}
