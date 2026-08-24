from pathlib import Path
from typing import Annotated

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from .broker import BrokerConfig
from .clickhouse import ClickhouseConfig

BASE_DIR = Path(__file__).resolve().parents[3]
ENV_PATH = BASE_DIR / ".env"


class BaseConfig(BaseSettings):
    """Конфиг из корневого .env — креды инфраструктуры, общей для всех сервисов"""
    broker: Annotated[BrokerConfig | None, Field(default=None, description="Конфиг подключения к брокеру")]
    clickhouse: Annotated[ClickhouseConfig | None, Field(default=None, description="Конфиг подключения к Clickhouse")]

    model_config = SettingsConfigDict(
        env_file=ENV_PATH,
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore"
    )
