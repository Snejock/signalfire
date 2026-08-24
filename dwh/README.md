### DWH

Инфраструктура хранилища — ClickHouse, Redpanda и всё, что вокруг них (docker-compose,
конфиги серверов) — развёрнута и поддерживается в отдельном проекте `dwh`. В `signalfire`
хранится только то, что относится к схемам данных этого репозитория:

- **`migrations/ch/`** — SQL-миграции ClickHouse (базы, таблицы, `MATERIALIZED VIEW` и т.п.)
  для сервисов этого проекта. Файлы пронумерованы и применяются по порядку:
  `NNN_action_schema.object.sql`, где `action` ∈ `create_database`, `create_table`,
  `alter_table` и т.п.
- **`migrations/rp/`** — Avro-схемы для топиков Redpanda, в которые пишут сервисы этого
  проекта (используются продюсером через Schema Registry и ClickHouse `Kafka`-движком при
  консюминге). Имя файла `<schema>.json` совпадает с именем топика и `record.name` внутри
  схемы.
- **конфиги стримов Redpanda Connect** — появятся позже, когда понадобится забирать данные
  из Redpanda не только через ClickHouse `Kafka`-движок, но и отдельными pipeline'ами.
