import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNews } from "@/lib/queries"
import type { NewsItem } from "@/lib/types"

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return "только что"
  if (diffMin < 60) return `${diffMin} мин назад`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH} ч назад`
  const diffD = Math.round(diffH / 24)
  return `${diffD} дн назад`
}

function NewsRow({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noreferrer"
      className="group flex gap-3 rounded-md p-2 -mx-2 transition-colors hover:bg-accent"
    >
      {item.image_url ? (
        <img
          src={item.image_url}
          alt=""
          className="size-14 shrink-0 rounded-md object-cover"
          loading="lazy"
        />
      ) : (
        <div className="bg-muted flex size-14 shrink-0 items-center justify-center rounded-md">
          <ExternalLink className="text-muted-foreground size-4" />
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="line-clamp-2 text-sm leading-snug font-medium group-hover:underline">
          {item.title}
        </p>
        <p className="text-muted-foreground text-xs">
          {item.feed_name} · {formatRelativeTime(item.published_at)}
        </p>
      </div>
    </a>
  )
}

/**
 * Глобальная лента новостей — ods.rss_news не связана с конкретным тикером в текущей
 * схеме DWH, поэтому на странице компании она показывает общий рыночный поток, а не
 * новости именно по этой бумаге.
 */
export function NewsFeed() {
  const { data, isPending, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useNews()
  const items = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новости рынка</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {isPending &&
          Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint: статичный список skeleton-заглушек
            <div key={i} className="flex gap-3 p-2">
              <Skeleton className="size-14 shrink-0 rounded-md" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}

        {isError && <p className="text-muted-foreground text-sm">Не удалось загрузить новости.</p>}

        {items.map((item) => (
          <NewsRow key={`${item.feed_id}-${item.link}`} item={item} />
        ))}

        {hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Загрузка…" : "Показать ещё"}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
