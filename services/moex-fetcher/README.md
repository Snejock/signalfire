### MOEX Stream Service

Сервис для получения сделок на бирже MOEX и публикации их в Redpanda. Напрямую в ClickHouse
сервис ничего не пишет — сделки попадают туда через `Kafka`-движок ClickHouse и
`MATERIALIZED VIEW` (см. `dwh/migrations/ch/`), которые читают тот же топик отдельно от
приложения; ClickHouse сервису нужен только для чтения курсора возобновления при старте.

#### Как это работает

1. **Курсор при старте.** `Application._get_cursor` читает `SELECT max(trade_no) FROM ods.moex_trades`
   из ClickHouse. Если таблица пуста — курсор `0`. Так сервис не теряет и не дублирует сделки
   между рестартами (перезапуск не требует знать, где остановились — источник истины в ClickHouse).

2. **Торговое расписание.** `packages/utils/moex_calendar.py` (`MoexCalendar`) решает, открыт ли
   рынок сейчас (`is_open`) и когда он откроется в следующий раз (`get_next_open_dttm`), по
   правилам из `config/config.yml`:
   - `weekly` — базовое расписание по дням недели (`week_day` 1–7, `start_time`/`stop_time`);
   - `special` — точечные исключения по конкретным датам (праздники, перенесённые рабочие дни),
     имеют приоритет над `weekly`;
   - `lag_start_minutes`/`lag_stop_minutes` — сдвигают фактическое окна опроса относительно
     официального расписания торгов (стартовать позже/раньше, стопать позже/раньше).

   Пока рынок закрыт, `Application._wait_until_market_open` спит до следующего открытия одним
   `asyncio.sleep`, не опрашивая API впустую.

3. **Опрос MOEX ISS API.** Пока рынок открыт, `Application.main_process` в цикле каждые
   `poll_interval_sec` секунд запрашивает
   `https://iss.moex.com/iss/engines/stock/markets/shares/trades.json` через `MoexProvider`
   (`shared/providers/moex_provider.py`) с параметрами `next_trade=1&tradeno=<курсор>` — так
   ISS API отдаёт только сделки после последнего просмотренного `TRADENO`, без полной перевыборки.

4. **Публикация в Redpanda.** Каждая строка ответа приводится к плоскому словарю (см. `message`
   в `Application.main_process`) и публикуется через `BrokerProvider`
   (`shared/providers/broker_provider.py`) в топик `SGN_MOEX_TRADES_RAW` по Avro-схеме
   `dwh/migrations/rp/SGN_MOEX_TRADES_RAW.json` (Schema Registry). Курсор (`max(TRADENO)` по
   батчу) обновляется только после того, как весь батч поставлен в очередь продюсера — не раньше.

5. **Ошибки — не фатальны.** Сетевые сбои/некорректный ответ ISS API логируются и не роняют
   процесс — цикл засыпает на `poll_interval_sec` (либо на 5 секунд при ошибках парсинга) и
   пробует снова на следующей итерации.

#### Конфигурация

- `config/config.yml` — только торговый календарь и параметры опроса (не инфраструктурные креды,
  см. пример структуры выше). Монтируется в контейнер как read-only.
- Инфраструктурные креды (ClickHouse, брокер) сервис берёт из корневого `.env` репозитория —
  подробнее про то, как `AppConfig`/`BaseConfig` их читают, см. `../../CLAUDE.md` → «Общий
  скелет сервиса».

#### Требования

- Python 3.14+
- Доступные ClickHouse (чтение курсора) и Redpanda + Schema Registry (публикация сделок) — см.
  `../../dwh/README.md`.

#### Запуск

Локально (из этой директории, при поднятой инфраструктуре и `dwh-net`):
```bash
uv run python moex-fetcher.py
```

Через Docker Compose — из **корня репозитория** (образу нужен весь workspace, см.
`../../CLAUDE.md` → «Docker / деплой»):
```bash
docker network create dwh-net || true   # один раз, если сети ещё нет
docker compose up -d --build sgn-moex-fetcher
docker compose logs -f sgn-moex-fetcher
```