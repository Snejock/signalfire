-- Оперативный слой (ODS): загруженные статьи RSS-лент
DROP TABLE IF EXISTS ods.rss_news;
CREATE TABLE IF NOT EXISTS ods.rss_news (
    _loaded_dttm    timestamp(0) with time zone DEFAULT now(),
    _source_system  text,
    published_dttm  timestamp(0) with time zone,
    feed_id         integer,
    feed_nm         text,
    title           text,
    summary         text,
    link            text,
    image_url       text
);