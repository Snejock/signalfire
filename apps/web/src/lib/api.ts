// Тонкая обёртка над fetch(). Базовый путь всегда относительный ("/api") — в dev это
// Vite-прокси (см. server.proxy в vite.config.ts), в prod — location /api/ в nginx.conf,
// оба ведут на services/api. Компонент никогда не собирает абсолютный URL сам.
import type { CandlesResponse, Company, NewsPage, Timeframe } from "./types"

const API_BASE = "/api"

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)

  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new ApiError(detail?.detail ?? response.statusText, response.status)
  }

  return response.json() as Promise<T>
}

export function fetchCompanies(): Promise<Company[]> {
  return request<Company[]>("/companies")
}

export function fetchCandles(
  secId: string,
  timeframe: Timeframe,
  range?: { startDttm?: Date; endDttm?: Date },
): Promise<CandlesResponse> {
  const params = new URLSearchParams({ timeframe })
  if (range?.startDttm) params.set("start_dttm", range.startDttm.toISOString())
  if (range?.endDttm) params.set("end_dttm", range.endDttm.toISOString())
  return request<CandlesResponse>(`/candles/${encodeURIComponent(secId)}?${params}`)
}

export function fetchNews(cursor?: string, limit = 20): Promise<NewsPage> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set("cursor", cursor)
  return request<NewsPage>(`/news?${params}`)
}
