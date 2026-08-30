# CLAUDE.md

Этот файл содержит указания для Claude Code (claude.ai/code) при работе с кодом в этом репозитории.

## Инфраструктура

Хранилище (ClickHouse, Postgres, Redpanda, MinIO, Redis, Ollama) не разворачивается в этом
репозитории — оно живёт в отдельном проекте `dwh`. **Смотри `./dwh/README.md`**: там описано,
где искать актуальный конфиг инфраструктуры (порты, сервисы, `.env`), а также что из этого
репозитория (`dwh/migrations/ch`, `dwh/migrations/rp`, `dwh/rpc`) при деплое синхронизируется
в инфраструктурный проект и как.

## Команды

Монорепозиторий на `uv` workspace (Python ≥3.14, `[tool.uv.workspace] members = ["services/*", "shared"]`).

```bash
# Установить зависимости всего workspace
uv sync --all-packages

# Установить зависимости только одного сервиса (так же делает Dockerfile)
uv sync --package moex-fetcher
uv sync --package rss-fetcher

# Запустить сервис локально (cwd важен — от него берутся относительные пути
# конфигов и лога, см. "Конфигурация" ниже)
cd services/moex-fetcher && uv run python moex-fetcher.py
cd services/rss-fetcher && uv run python rss-fetcher.py

# Тесты (сейчас есть только у rss-fetcher)
cd services/rss-fetcher && uv run pytest
cd services/rss-fetcher && uv run pytest tests/test_image_extractor.py::test_rbc_enclosure  # один тест
```

Линтер/форматтер в проекте не настроен — не выдумывать команды `ruff`/`black`/`mypy`.

Локальный запуск сервисов также требует поднятого `dwh-net` (`docker network create dwh-net || true`)
и доступной инфраструктуры (Postgres/ClickHouse/Redpanda) — см. `./dwh/README.md`.

## Архитектура

Два независимых сервиса-воркера (`services/moex-fetcher`, `services/rss-fetcher`) и общий пакет
`shared`, от которого оба зависят через `tool.uv.sources` (`shared = { workspace = true }`).

### Общий скелет сервиса

Оба сервиса построены по одному шаблону:

- `<service>.py` — точка входа: настраивает логгер (`packages/logger/logger_setup.py`), ловит
  `SIGTERM`/`KeyboardInterrupt` для graceful shutdown, создаёт `Application` и запускает её.
- `packages/Application.py` — вся бизнес-логика: инициализация провайдеров, `connect()` всех
  провайдеров через `asyncio.gather`, бесконечный цикл опроса источника с курсором (не теряет место
  между рестартами — курсор при старте вычисляется запросом `max(...)` к БД-приёмнику), публикация
  сообщений через `BrokerProvider`, `close()` всех провайдеров в `finally`.
- `schemas/` — pydantic-модели конфигурации. `schemas/base_config.py` определяет `BaseConfig`
  (`pydantic_settings.BaseSettings`), которая читает **корневой `.env`** репозитория
  (`env_nested_delimiter="__"`, поэтому `BROKER__HOST` → `config.broker.host`); `AppConfig` в
  каждом сервисе наследует `BaseConfig` и добавляет свои поля. moex-fetcher дополнительно читает
  `config/config.yml` (торговый календарь и т.п. — не инфраструктурные креды).

### `shared/providers/` — общие клиенты для инфраструктуры

Асинхронные обёртки с единым интерфейсом `connect()` / `close()`, используются обоими сервисами:

- **`BrokerProvider`** — продюсер в Redpanda (Kafka) через Avro + Schema Registry
  (`confluent_kafka`). Avro-схему для топика он читает **не из этого пакета**, а по пути
  `dwh/migrations/rp/<schema>.json` относительно корня репозитория (переопределяется
  `DWH__SCHEMA_DIR`) — то есть схемы сообщений владеет каждый сервис сам (`services/<name>/../../dwh/migrations/rp`,
  на деле `<repo>/dwh/migrations/rp/`), а не `shared`.
- **`ClickhouseProvider`**, **`PostgresProvider`** — асинхронные клиенты БД для соответствующих сервисов.
- **`HttpProvider`** — HTTP-клиент (`httpx`) с поддержкой SOCKS-прокси.
- **`MoexProvider`** — клиент MOEX ISS API (использует moex-fetcher).

### `moex-fetcher`

Опрашивает MOEX ISS API по расписанию торгов (`packages/utils/MoexCalendar.py`), курсор —
`max(trade_no)` из `ods.moex_trades` в ClickHouse, публикует сделки в топик `SGN_MOEX_TRADES_RAW`.

### `rss-fetcher`

Список RSS-лент читает не из файла, а из Postgres (`dds.r_rss_feeds`); на каждую активную ленту —
отдельная asyncio-задача с собственным курсором (`max(published_dttm)` из `ods.rss_news`).
`packages/parsers/RSSFeedParser.py` + `ImageExtractor.py` разбирают фид и достают картинку записи
(приоритет `media:content` над `enclosure`, см. тесты в `tests/test_image_extractor.py` — там же
примеры реальных лент RBC/Kommersant/NYT/Haaretz с их особенностями разметки).

### Docker / деплой

У каждого сервиса свой `Dockerfile` и `docker-compose.yaml` в `services/<name>/compose/`, собираются
из корня репозитория (`context: ../../../`), т.к. образу нужен весь workspace (`shared/`, корневые
`pyproject.toml`/`uv.lock`) плюс `dwh/migrations/rp` (Avro-схемы, см. `BrokerProvider` выше).
Корневой `docker-compose.yaml` подключает оба сервиса через `include`.