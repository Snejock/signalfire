from datetime import datetime

from pydantic import BaseModel


class NewsItemOut(BaseModel):
    feed_id: int
    feed_name: str
    title: str
    summary: str | None = None
    link: str
    image_url: str | None = None
    published_at: datetime


class NewsPageOut(BaseModel):
    items: list[NewsItemOut]
    # published_at (ISO8601) последней отданной записи — передать обратно как ?cursor=
    # для следующей страницы; None означает, что лента закончилась.
    next_cursor: str | None = None
