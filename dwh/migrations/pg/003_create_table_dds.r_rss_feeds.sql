-- Справочник RSS-лент (Data Vault reference-таблица), которые опрашивает rss-fetcher.
-- Сидируется вручную
DROP SEQUENCE IF EXISTS dds.r_rss_feeds__feed_id_seq CASCADE;
CREATE SEQUENCE IF NOT EXISTS dds.r_rss_feeds__feed_id_seq;

DROP TABLE IF EXISTS dds.r_rss_feeds;
CREATE TABLE IF NOT EXISTS dds.r_rss_feeds (
    _loaded_dttm    timestamp(0) with time zone DEFAULT now(),
    feed_id         integer DEFAULT nextval('dds.r_rss_feeds__feed_id_seq') CONSTRAINT r_rss_feeds__feed_id_pk PRIMARY KEY,
    feed_nm         text,
    feed_link       text,
    feed_type       text,
    country_code    text,
    city_nm         text,
    language_code   text,
    interval_sec    smallint,
    is_active       boolean
);