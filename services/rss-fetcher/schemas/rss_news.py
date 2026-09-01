from datetime import UTC, datetime
from typing import Annotated

import xxhash
from dateutil import parser
from pydantic import BaseModel, Field


class RSSNews(BaseModel):
    source_system: Annotated[str, Field(default="RSS", description="Код системы источника")]
    published_loc: Annotated[str, Field(description="Дата и время публикации в исходном формате и таймзоне")]
    feed_id: Annotated[int | None, Field(default=None)]
    feed_nm: Annotated[str | None, Field(default=None)]
    title: Annotated[str, Field(..., min_length=1, description="Заголовок сообщения")]
    link: Annotated[str, Field(..., description="Ссылка на сообщение")]
    summary: Annotated[str | None, Field(description="Краткое содержание")]
    image_url: Annotated[str | None, Field(default=None, description="Ссылка на изображение")]

    @property
    def published_utc(self) -> datetime:
        return parser.parse(self.published_loc).astimezone(UTC)

    @property
    def news_id(self) -> str:
        return xxhash.xxh64(self.link.encode("utf-8"), seed=0).hexdigest()
