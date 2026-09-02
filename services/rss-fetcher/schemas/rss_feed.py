from datetime import datetime
from enum import StrEnum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator

from .location import Location


class RSSFeedType(StrEnum):
    """Перечисление типов RSS-лент (государственный, независимый)"""
    GOVERNMENT = "government"
    INDEPENDENT = "independent"


class RSSFeed(BaseModel):
    """Модель данных отдельной RSS-ленты."""
    id: Annotated[int, Field(description="Уникальный ID ленты")]
    name: Annotated[str, Field(description="Отображаемое имя источника")]
    link: Annotated[HttpUrl, Field(description="URL-адрес RSS-ленты")]

    # Географическое положение и язык
    location: Location
    language_code: Annotated[str, Field(description="Код языка ISO 639-1 (ru, en, zh)")]

    # Тип ленты
    type: Annotated[RSSFeedType, Field(default=RSSFeedType.INDEPENDENT, description="Тип источника")]

    # Технические параметры
    interval: Annotated[int, Field(60, gt=0, description="Интервал опроса в секундах")]

    # Состояние
    cursor: Annotated[datetime | None, Field(default=None)]
    is_active: Annotated[bool, Field(default=True, description="Флаг активности источника")]

    model_config = ConfigDict(str_strip_whitespace=True)

    @field_validator("language_code")
    @classmethod
    def language_lowercase(cls, v: str) -> str:
        return v.lower()
