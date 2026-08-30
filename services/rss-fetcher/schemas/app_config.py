from typing import Annotated

from pydantic import Field

from .base_config import BaseConfig
from .rss_fetcher import RSSFetcherConfig


class AppConfig(BaseConfig):
    """Конфиг приложения. Список RSS-лент в config.yml не хранится —
    он читается из Postgres (dds.r_rss_feeds), см. Application._load_feeds_from_db"""
    rss_fetcher: Annotated[RSSFetcherConfig, Field(default_factory=RSSFetcherConfig)]
