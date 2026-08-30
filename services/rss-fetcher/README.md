### RSS Fetcher Service

Сервис опрашивает набор RSS-лент и публикует новые статьи в Redpanda. Список лент и место, до
которого каждая лента уже прочитана, сервис не хранит у себя — и то, и другое читается из
собственной базы Postgres `signalfire` при каждом старте.

#### Как это работает

1. **Список лент — из Postgres, не из файла.** При старте `Application._load_feeds_from_db`
   читает активные (`is_active = true`) строки `dds.r_rss_feeds` и на каждую поднимает отдельную
   asyncio-задачу (`Application.processing`) — ленты опрашиваются независимо друг от друга, сбой
   или медленный ответ одной ленты не блокирует остальные.
   `Application._load_feeds_from_file` + `config/rss_feeds.yaml` — не рабочий путь загрузки, а
   способ засеять `dds.r_rss_feeds` вручную при разворачивании с нуля.

2. **Курсор — свой на каждую ленту.** `Application._get_cursor` при старте задачи вычисляет
   `max(published_dttm) FROM ods.rss_news WHERE feed_id = $1`; если строк нет — берётся
   `datetime.min`. Дальше курсор двигается только вперёд и обновляется в памяти уже после того,
   как весь батч новых статей поставлен в очередь продюсера (см. `Application.processing`) — так
   сбой публикации одной статьи не сдвигает курсор мимо неё.

3. **Опрос ленты.** Раз в `feed.interval` секунд (`interval_sec` в `dds.r_rss_feeds`, своё на
   каждую ленту) `HttpProvider` (`shared/providers/http_provider.py`, ходит через SOCKS-прокси из
   `.env`) забирает RSS/Atom-документ, `RSSFeedParser`
   (`packages/parsers/rss_feed_parser.py`, на `feedparser`) разбирает его в список записей и
   чистит текст (`BeautifulSoup` — убирает разметку, `ftfy` — чинит битую кодировку). Публикуются
   только записи новее текущего курсора ленты.

4. **Картинка записи.** `ImageExtractor` (`packages/parsers/utils/image_extractor.py`; деталь
   реализации `RSSFeedParser`, наружу пакета `parsers` не экспортируется) — достаёт обложку из
   `media:content` (приоритет) или `enclosure`, отбрасывает мусорные ссылки (трекеры,
   1x1-пиксели, data:) и по возможности снимает resize-параметры URL, только если это не
   ломает подписанные (signed) ссылки. Все нюансы конкретных лент (RBC, Kommersant, NYT,
   Haaretz и т.п.) — в `tests/test_image_extractor.py`.

5. **Публикация в Redpanda.** Каждая статья публикуется через `BrokerProvider`
   (`shared/providers/broker_provider.py`) в топик `SGN_RSS_NEWS_RAW` по Avro-схеме
   `dwh/migrations/rp/SGN_RSS_NEWS_RAW.json` (Schema Registry), ключ сообщения — `link`.
   Дедупликация (повторные записи в разных лентах на одну и ту же новость) на стороне сервиса не
   делается — это задача даунстрим-обработки в Redpanda Connect (см. `dwh/README.md`).

#### Конфигурация

- Списком лент и их параметрами (`interval_sec`, `is_active`, гео/язык) управляет таблица
  `dds.r_rss_feeds` в Postgres, не файл — см. `.claude/skills/query-postgres/SKILL.md`.
- Инфраструктурные креды (Postgres, брокер, прокси) сервис берёт из корневого `.env` репозитория.
- `config/rss_feeds.yaml` — не читается приложением на старте, годится только как исходник для
  ручного сидирования `dds.r_rss_feeds` через `Application._load_feeds_from_file`.

#### Требования

- Python 3.14+
- Доступные Postgres (список лент + курсор) и Redpanda + Schema Registry (публикация статей) —
  см. `../../dwh/README.md`.

#### Запуск

Локально (из этой директории, при поднятой инфраструктуре и `dwh-net`):
```bash
uv run python rss-fetcher.py
```

Тесты:
```bash
uv run pytest
```

Через Docker Compose — из **корня репозитория** (образу нужен весь workspace, см.
`../../CLAUDE.md` → «Docker / деплой»):
```bash
docker network create dwh-net || true   # один раз, если сети ещё нет
docker compose up -d --build sgn-rss-fetcher
docker compose logs -f sgn-rss-fetcher
```