import {
  AreaSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { useEffect, useRef } from "react"
import {
  applyDefaultVisibleRange,
  resolveCssColor,
  toUnixTime,
  toVolumeBar,
  toVolumeData,
  withAlpha,
} from "@/lib/chart-utils"
import type { Candle } from "@/lib/types"

interface AreaBar {
  time: UTCTimestamp
  value: number
}

function toAreaBar(c: Candle): AreaBar | null {
  // vwap может быть null (в баре 0 сделок — на практике редкость, раз бар вообще есть в
  // выдаче, но теоретически возможно) — AreaSeries ожидает числовое value, такие точки
  // просто выкидываем при построении данных.
  if (c.vwap == null) return null
  return { time: toUnixTime(c.ts), value: c.vwap }
}

function toAreaData(candles: Candle[]): AreaBar[] {
  return candles.map(toAreaBar).filter((bar) => bar !== null)
}

interface VwapChartProps {
  candles: Candle[]
  className?: string
}

export function VwapChart({ candles, className }: VwapChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  // Данные с предыдущего рендера — та же логика, что в CandlestickChart: отличить
  // "изменился только хвост" (точечный update()) от "вся серия целиком" (полный setData()).
  const previousDataRef = useRef<AreaBar[]>([])
  const previousCandlesRef = useRef<Candle[]>([])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const lineColor = resolveCssColor("--candle-down", "#ef4444")
    const textColor = resolveCssColor("--muted-foreground", "#71717a")
    const volumeColor = withAlpha(textColor, 0.5)

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      // borderVisible по умолчанию true с тёмным цветом (#2B2B43) — отдельная от сетки
      // сплошная линия на границе шкалы, которую мы не задавали и не хотели.
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      lineWidth: 2,
      // Градиент: непрозрачный цвет линии сверху, плавно сходящий на нет снизу.
      topColor: withAlpha(lineColor, 0.35),
      bottomColor: withAlpha(lineColor, 0),
    })
    // Те же margins, что у ценовой шкалы в CandlestickChart (верхние ~60% высоты, снизу
    // место под объём) — чтобы при переключении между VWAP и свечами график не "прыгал":
    // цена занимает одну и ту же область на обоих режимах.
    series.priceScale().applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.4 },
    })

    // Бары объёма — тот же HistogramSeries с теми же цветом/margins, что в CandlestickChart
    // (см. toVolumeData в chart-utils.ts — общая логика на оба графика).
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: volumeColor,
      priceFormat: { type: "volume" },
      priceScaleId: "",
    })
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
      borderVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series
    volumeSeriesRef.current = volumeSeries
    previousDataRef.current = []
    previousCandlesRef.current = []

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
    }
  }, [])

  useEffect(() => {
    const series = seriesRef.current
    const volumeSeries = volumeSeriesRef.current
    if (!series || !volumeSeries) return

    const nextData = toAreaData(candles)
    const previous = previousDataRef.current
    const previousCandles = previousCandlesRef.current
    const isSameSeriesExtendedAtTail =
      previous.length > 0 &&
      nextData.length >= previous.length &&
      nextData[0]?.time === previous[0]?.time

    if (isSameSeriesExtendedAtTail) {
      for (let i = previous.length - 1; i < nextData.length; i++) {
        series.update(nextData[i])
      }
      for (let i = previousCandles.length - 1; i < candles.length; i++) {
        volumeSeries.update(toVolumeBar(candles[i]))
      }
    } else {
      series.setData(nextData)
      volumeSeries.setData(toVolumeData(candles))
      if (chartRef.current) applyDefaultVisibleRange(chartRef.current, nextData.length)
    }

    previousDataRef.current = nextData
    previousCandlesRef.current = candles
  }, [candles])

  return <div ref={containerRef} className={className} />
}
