import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
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

function toChartBar(c: Candle) {
  return {
    time: toUnixTime(c.ts),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }
}

function toChartData(candles: Candle[]) {
  return candles.map(toChartBar)
}

// Декоративная заливка под свечами — та же цена закрытия, что и у последней свечи в каждом
// баре, просто как area вместо самой линии (line скрыт, viden только градиент).
function toPriceAreaBar(c: Candle) {
  return {
    time: toUnixTime(c.ts),
    value: c.close,
  }
}

function toPriceAreaData(candles: Candle[]) {
  return candles.map(toPriceAreaBar)
}

interface CandlestickChartProps {
  candles: Candle[]
  className?: string
}

export function CandlestickChart({ candles, className }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const priceAreaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  // Свечи с предыдущего рендера — чтобы на новых данных понять, изменился ли только
  // "хвост" (обычный рефетч раз в 15с) или весь набор целиком (первая загрузка, смена
  // sec_id/timeframe, сдвиг окна по умолчанию) и нужен полный сброс.
  const previousCandlesRef = useRef<Candle[]>([])

  // Создаём инстанс графика один раз на монтирование контейнера.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const upColor = resolveCssColor("--candle-up", "#22c55e")
    const downColor = resolveCssColor("--candle-down", "#ef4444")
    const textColor = resolveCssColor("--muted-foreground", "#71717a")
    const volumeColor = withAlpha(textColor, 0.5)

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor,
        // Лицензия (Apache 2.0) требует либо этот логотип, либо attribution-ссылку
        // на tradingview.com где-то ещё в приложении — она есть в футере AppShell.
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

    // Декоративная заливка под свечами (по цене закрытия) — добавлена ДО candlestick-серии,
    // чтобы рисоваться позади неё (порядок addSeries = порядок отрисовки). Сама линия скрыта
    // (lineVisible: false) — виден только градиент, сами свечи поверх остаются читаемыми.
    // Отдельного priceScaleId не задаём — сидит на той же шкале, что и свечи, иначе заливка
    // не совпадала бы по масштабу с ценой на графике.
    const priceAreaSeries = chart.addSeries(AreaSeries, {
      lineVisible: false,
      topColor: withAlpha(textColor, 0.2),
      bottomColor: withAlpha(textColor, 0),
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
    })

    const series = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor: upColor,
      wickDownColor: downColor,
    })
    // Цена занимает верхние ~60% высоты — снизу оставлено место под объём.
    series.priceScale().applyOptions({
      scaleMargins: { top: 0.1, bottom: 0.4 },
    })

    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: volumeColor,
      priceFormat: { type: "volume" },
      // Пустой priceScaleId — у объёма своя, отдельная от цены шкала (overlay),
      // а не общая с candlestick-серией: иначе бары объёма растянулись бы на всю высоту
      // графика и перекрыли свечи.
      priceScaleId: "",
    })
    volumeSeries.priceScale().applyOptions({
      // Нижние 30% высоты, от 70% и до низа графика.
      scaleMargins: { top: 0.7, bottom: 0 },
      borderVisible: false,
    })

    chartRef.current = chart
    seriesRef.current = series
    volumeSeriesRef.current = volumeSeries
    priceAreaSeriesRef.current = priceAreaSeries
    // На новых инстансах серий ничего ещё не отрисовано — обнуляем "предыдущие" свечи,
    // иначе эффект ниже решит, что это просто хвост уже нарисованных данных, и вызовет
    // update() вместо setData() на пустом графике. Особенно важно в дев-режиме: React
    // StrictMode намеренно пересоздаёт эффекты дважды при монтировании (создать → cleanup →
    // создать заново) именно чтобы ловить такие рассинхроны между разными ref'ами.
    previousCandlesRef.current = []

    return () => {
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
      volumeSeriesRef.current = null
      priceAreaSeriesRef.current = null
    }
  }, [])

  // Данные обновляются отдельно (при рефетче react-query, раз в 15с) — без пересоздания
  // графика. Раньше на каждый рефетч звали setData() на весь массив — дорого и сбрасывает
  // зум/скролл пользователя при каждом обновлении. Теперь: если начало диапазона не
  // сдвинулось (candles[0] тот же самый, что и в прошлый раз), значит новые данные — это
  // тот же ряд плюс изменённый/новый хвост, и его можно точечно обновить через
  // series.update() — lightweight-charts сам решает, обновить последний бар (совпадает time)
  // или добавить новый (время больше). Полный setData() + сброс масштаба (см.
  // applyDefaultVisibleRange) — только на первую загрузку, смену sec_id/timeframe или
  // если сдвинулось окно по умолчанию.
  useEffect(() => {
    const series = seriesRef.current
    const volumeSeries = volumeSeriesRef.current
    const priceAreaSeries = priceAreaSeriesRef.current
    if (!series || !volumeSeries || !priceAreaSeries) return

    const previous = previousCandlesRef.current
    const isSameSeriesExtendedAtTail =
      previous.length > 0 &&
      candles.length >= previous.length &&
      candles[0]?.ts === previous[0]?.ts

    if (isSameSeriesExtendedAtTail) {
      // Начиная с индекса последнего уже отрисованного бара (он мог измениться) и до конца —
      // на практике это обычно один бар, реже два-три, если рефетч случился реже, чем
      // менялись данные.
      for (let i = previous.length - 1; i < candles.length; i++) {
        series.update(toChartBar(candles[i]))
        volumeSeries.update(toVolumeBar(candles[i]))
        priceAreaSeries.update(toPriceAreaBar(candles[i]))
      }
    } else {
      series.setData(toChartData(candles))
      volumeSeries.setData(toVolumeData(candles))
      priceAreaSeries.setData(toPriceAreaData(candles))
      if (chartRef.current) applyDefaultVisibleRange(chartRef.current, candles.length)
    }

    previousCandlesRef.current = candles
  }, [candles])

  return <div ref={containerRef} className={className} />
}
