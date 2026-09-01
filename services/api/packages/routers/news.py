import logging

from fastapi import APIRouter, Depends, Query
from packages.dependencies import get_pg_provider
from schemas import NewsItemOut, NewsPageOut

from shared.providers import PostgresProvider

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/news", response_model=NewsPageOut)
async def list_news(
    limit: int = Query(20, gt=0, le=100),
    cursor: str | None = Query(None, description="published_at последней отданной записи (ISO8601)"),
    pg_provider: PostgresProvider = Depends(get_pg_provider),
) -> NewsPageOut:
    """Глобальная лента новостей (без привязки к тикеру — ods.rss_news не связана с
    конкретной компанией на имеющихся данных), курсорная пагинация по published_dttm."""
    rows = await pg_provider.fetch(
        """
        SELECT feed_id, feed_nm, title, summary, link, image_url, published_dttm
        FROM ods.rss_news
        WHERE $1::timestamptz IS NULL OR published_dttm < $1
        ORDER BY published_dttm DESC
        LIMIT $2
        """,
        cursor,
        limit,
    )

    items = [
        NewsItemOut(
            feed_id=row["feed_id"],
            feed_name=row["feed_nm"],
            title=row["title"],
            summary=row["summary"],
            link=row["link"],
            image_url=row["image_url"],
            published_at=row["published_dttm"],
        )
        for row in rows
    ]

    next_cursor = items[-1].published_at.isoformat() if len(items) == limit else None

    return NewsPageOut(items=items, next_cursor=next_cursor)
