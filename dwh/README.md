### DWH

Инфраструктура хранилища — ClickHouse, Redpanda и всё, что вокруг них (docker-compose,
конфиги серверов) — развёрнута и поддерживается в отдельном проекте `dwh`. Локально он
склонирован рядом с этим репозиторием (`../dwh`), на сервере — по пути
`/media/data/projects/dwh`. Актуальный состав сервисов, порты, версии образов и
переменные окружения смотреть непосредственно там, в `dwh/docker-compose.yaml` и
`dwh/compose/*/docker-compose.yaml` — здесь не дублируется, чтобы не расходилось
с реальностью.

В `signalfire` хранится только то, что относится к схемам данных этого репозитория:

- **`migrations/ch/`** — SQL-миграции ClickHouse (базы, таблицы, `MATERIALIZED VIEW` и т.п.)
  для сервисов этого проекта. Файлы пронумерованы и применяются по порядку:
  `NNN_action_schema.object.sql`, где `action` ∈ `create_database`, `create_table`,
  `alter_table` и т.п.
- **`migrations/pg/`** — SQL-миграции Postgres (та же нумерация и конвенция имён, что у
  `migrations/ch/`) для собственной базы `signalfire` на `dwh-pg-1` (см. `connect-servers` и
  `query-postgres`). В отличие от ClickHouse, у signalfire здесь своя выделенная база, а не
  общая с другими проектами — `rss-fetcher` хранит в ней `dds.r_rss_feeds` (справочник лент,
  сидируется вручную из `services/rss-fetcher/config/rss_feeds.yaml`) и `ods.rss_news`.
- **`migrations/rp/`** — Avro-схемы для топиков Redpanda, в которые пишут сервисы этого
  проекта (используются продюсером через Schema Registry и ClickHouse `Kafka`-движком при
  консюминге). Имя файла `<schema>.json` совпадает с именем топика и `record.name` внутри
  схемы.
- **`rpc/`** — конфиги стримов Redpanda Connect для сервисов этого проекта: пайплайны,
  которые забирают данные из Redpanda отдельно от ClickHouse `Kafka`-движка (например, для
  доставки во внешние системы). Их подхватывает собственный контейнер `sgn-rp-connect`
  (`dwh/compose/redpanda/docker-compose.yaml`, подключён в корневой `docker-compose.yaml`) —
  он монтирует `dwh/rpc` напрямую из чекаута этого репозитория на сервере, без синхронизации
  в инфраструктурный проект `dwh`.
