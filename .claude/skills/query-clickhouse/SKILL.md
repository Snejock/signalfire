---
name: query-clickhouse
description: Запросы к кластеру ClickHouse (данные moex_trades) на odin/loki для данных signalfire. Использовать, когда просят прочитать/посмотреть данные о сделках MOEX или схему, либо убедиться, что пайплайн Kafka → ClickHouse загрузил строки. Только чтение.
---

Этими данными signalfire владеет от начала до конца: `moex-fetcher` публикует сделки в Redpanda,
а пайплайн, который доводит их до ClickHouse, описан миграциями этого же репозитория
(`dwh/migrations/ch/`, см. «Данные signalfire» ниже) — в отличие от таблиц Postgres из
`query-postgres`, которые принадлежат `chronica`.

ClickHouse — кластер из 2 шардов (`sharded`) с одной нодой на каждый сервер: `dwh-ch-1` на
`odin`, `dwh-ch-2` на `loki` (см. `connect-servers` и `./dwh/README.md`). Локально недоступен;
весь доступ идёт через SSH + `docker exec`. Кластерные запросы можно выполнять с любой ноды через
`Distributed`-таблицу, но `.env` самого signalfire указывает на `odin`
(`CLICKHOUSE__HOST=odin`), поэтому по умолчанию — туда же, для согласованности с подключением
самого приложения.

## Подключение

```
ssh odin "docker exec -i dwh-ch-1 sh -c 'clickhouse-client --user \"\$CLICKHOUSE_USER\" --password \"\$CLICKHOUSE_PASSWORD\" -q \"...\"'"
```

- Хост: `odin` (только SSH, локального туннеля/проброса портов нет)
- Контейнер: `dwh-ch-1` (на `loki` — `dwh-ch-2`, тот же кластер, другой шард)
- `CLICKHOUSE_USER` / `CLICKHOUSE_PASSWORD` уже заданы как переменные окружения внутри
  контейнера (из `.env.odin`/`.env.loki` проекта `dwh`, через
  `dwh/compose/clickhouse/docker-compose.yaml`), так что реальное значение креда никогда не
  должно появляться ни в команде, ни в этом файле.

Добавьте `Bash(ssh odin *)` в `.claude/settings.local.json`, чтобы это выполнялось без запроса
подтверждения.

## Запуск запросов

Та же особенность с экранированием кавычек, что и у Postgres — для многострочного/сложного SQL
heredoc через stdin проще, чем экранирование в `-c`:

```
ssh odin "docker exec -i dwh-ch-1 sh -c 'clickhouse-client --user \"\$CLICKHOUSE_USER\" --password \"\$CLICKHOUSE_PASSWORD\" --multiquery'" <<'SQL'
SELECT sec_id, count(*), max(trade_dttm)
FROM ods.moex_trades
GROUP BY sec_id
ORDER BY 2 DESC
LIMIT 20;
SQL
```

Полезные флаги: `--format PrettyCompact` (по умолчанию, для человека), `--format TSVWithNames`
или `CSV` для парсируемого вывода, `-q`/`--query` для одного запроса вместо stdin.

## Изучение схемы

- `SHOW DATABASES` — список баз (`ods`, `stg`, `dds`, `dm` — созданы `ON CLUSTER sharded` в
  `dwh/migrations/ch/001_create_databases.sql`)
- `SHOW TABLES FROM ods` — список таблиц в базе
- `DESCRIBE TABLE ods.moex_trades` — колонки и типы
- `SELECT * FROM system.clusters WHERE cluster = 'sharded'` — убедиться, что видны оба шарда

## Данные signalfire: пайплайн сделок MOEX

Три слоя, описаны в `dwh/migrations/ch/00N_*.sql` этого репозитория (всё `ON CLUSTER sharded`):

| Таблица | Движок | Роль |
|---|---|---|
| `stg.kafka_moex_trades_local` | `Kafka` | Потребляет топик `SGN_MOEX_TRADES_RAW` (Avro через Schema Registry), публикует `BrokerProvider` сервиса `moex-fetcher` |
| `ods.moex_trades_local` | `ReplacingMergeTree(_loaded_dttm)` | Хранение по шардам, дедупликация по `_loaded_dttm`, TTL 30 дней по `trade_dttm` |
| `ods.moex_trades` | `Distributed` | Точка входа для запросов — читать/писать сюда, не в `_local` |
| `ods.mv_moex_trades_local` | `MATERIALIZED VIEW` | Переносит строки `stg` → `ods`, приводя `Float64` → `Decimal64(6)` и строку `trade_session_dt` → `Date` |

Всегда запрашивать `ods.moex_trades` (таблицу `Distributed`), а не `ods.moex_trades_local`, кроме
случаев, когда нужны данные конкретно одного шарда. Так как локальная таблица —
`ReplacingMergeTree`, строки не дедуплицируются до фонового merge — добавляйте `FINAL`
(`SELECT ... FROM ods.moex_trades FINAL`) или группируйте по `max(_loaded_dttm)`, если запросу
нужен гарантированно дедуплицированный подсчёт.

## DDL и запись — вне зоны ответственности

Этот скилл только читает. Изменения схемы идут через миграции в `dwh/migrations/ch/` этого
репозитория (именование: `NNN_action_schema.object.sql`), применяемые `ON CLUSTER sharded` —
никогда не выполнять DDL напрямую через `clickhouse-client` в продовом кластере.