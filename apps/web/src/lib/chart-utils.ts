import type { IChartApi, UTCTimestamp } from "lightweight-charts"
import type { Candle } from "./types"

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
export function resolveCssColor(varName: string, fallback: string): string {
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

/** Тот же цвет (ожидает результат resolveCssColor — уже "rgba(r, g, b, a)"), но с другой альфой. */
export function withAlpha(rgba: string, alpha: number): string {
  const match = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!match) return rgba
  const [, r, g, b] = match
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// Сколько баров показывать по умолчанию при первой загрузке/смене серии. fitContent()
// впихивает ВЕСЬ полученный диапазон (а /candles по умолчанию отдаёт немало — например,
// 14 дней для 15m) в ширину контейнера: на мобильном экране (~350-400px) это превращает
// свечи в нечитаемое месиво толщиной в пиксель. Вместо этого показываем последние N баров,
// а дальше пользователь сам отматывает назад свайпом/скроллом при желании.
export const DEFAULT_VISIBLE_BARS = 50

// MOEX торгует по Europe/Moscow (UTC+3, без перехода на летнее время в РФ) — график должен
// показывать биржевое время сессии, а не то, что получится от часового пояса браузера.
const MSK_OFFSET_SECONDS = 3 * 60 * 60

// ClickHouse-DateTime -> unix-секунды: lightweight-charts работает с UTCTimestamp, а не
// ISO-строками (конвертация — забота фронтенда, не формы API). candle_dttm хранится и
// приходит от API в UTC, но БЕЗ суффикса "Z"/офсета в строке ("2026-08-31T07:11:00") — а
// такую ISO-строку без явной зоны new Date() трактует как ЛОКАЛЬНОЕ время браузера
// пользователя (спецификация ES2015+), не UTC. Из-за этого график "плыл" на случайный сдвиг
// в зависимости от часового пояса браузера. Явно парсим как UTC (добавляя "Z"), а затем
// сдвигаем на MSK_OFFSET_SECONDS: lightweight-charts не знает часовых поясов и форматирует
// переданный UTCTimestamp как есть, поэтому единственный способ показать именно
// биржевое MSK-время — заранее сдвинуть сам timestamp.
export function toUnixTime(ts: string): UTCTimestamp {
  const utcSeconds = Math.floor(Date.parse(ts.endsWith("Z") ? ts : `${ts}Z`) / 1000)
  return (utcSeconds + MSK_OFFSET_SECONDS) as UTCTimestamp
}

// Объём — общая логика для VWAP- и candlestick-графика: нейтральным одним цветом (не
// up/down), без привязки к направлению свечи. Единый источник правды на оба компонента —
// чтобы при переключении между ними бары объёма не "прыгали" из-за случайного расхождения.
export interface VolumeBar {
  time: UTCTimestamp
  value: number
}

export function toVolumeBar(c: Candle): VolumeBar {
  return { time: toUnixTime(c.ts), value: c.volume }
}

export function toVolumeData(candles: Candle[]): VolumeBar[] {
  return candles.map(toVolumeBar)
}

export function applyDefaultVisibleRange(chart: IChartApi, barCount: number) {
  if (barCount <= DEFAULT_VISIBLE_BARS) {
    // Данных и так меньше, чем окно по умолчанию — показываем всё как есть.
    chart.timeScale().fitContent()
    return
  }

  // +2 справа — небольшой отступ после последнего бара, чтобы он не упирался в край.
  chart.timeScale().setVisibleLogicalRange({
    from: barCount - DEFAULT_VISIBLE_BARS,
    to: barCount - 1 + 2,
  })
}
