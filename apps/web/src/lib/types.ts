// Формы ответов зеркалят pydantic-модели services/api/packages/models/*.py

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d"

export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "1d"]

export interface Company {
  sec_id: string
  board_id: string
  name: string | null
  last_seen_at: string
}

export interface Candle {
  ts: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  vwap: number | null
}

export interface CandlesResponse {
  sec_id: string
  board_id: string
  timeframe: Timeframe
  candles: Candle[]
}

export interface NewsItem {
  feed_id: number
  feed_name: string
  title: string
  summary: string | null
  link: string
  image_url: string | null
  published_at: string
}

export interface NewsPage {
  items: NewsItem[]
  next_cursor: string | null
}
