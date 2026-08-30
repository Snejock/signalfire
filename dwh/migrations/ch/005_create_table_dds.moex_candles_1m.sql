-- Слой DDS: 1-минутные OHLCV-свечи по сделкам MOEX, агрегируются из Kafka в реальном времени.
-- Хранятся бессрочно
DROP TABLE IF EXISTS dds.moex_candles_1m_local ON CLUSTER sharded SYNC;
CREATE TABLE IF NOT EXISTS dds.moex_candles_1m_local ON CLUSTER sharded
(
    sec_id      LowCardinality(String),
    board_id    LowCardinality(String),
    candle_dttm DateTime,

    -- open_price_amt/close_price_amt: argMin/argMax не ассоциативны без полного состояния
    -- (нужно помнить и цену, и время сделки) — требуют AggregateFunction + -State/-Merge.
    -- Тай-брейк — кортеж (trade_dttm, trade_no): trade_no монотонно возрастает и однозначно
    -- упорядочивает сделки внутри одной секунды (DateTime — секундная точность).
    open_price_amt  AggregateFunction(argMin, Decimal(18, 6), Tuple(DateTime, UInt64)),
    close_price_amt AggregateFunction(argMax, Decimal(18, 6), Tuple(DateTime, UInt64)),

    -- high_price_amt/low_price_amt/volume_cnt/trade_value_amt/trade_cnt: SimpleAggregateFunction —
    -- max/min/sum ассоциативны сами по себе, итоговое значение хранится без сериализованного
    -- состояния, читается напрямую (в запросах — max(x)/min(x)/sum(x), без -Merge).
    high_price_amt  SimpleAggregateFunction(max, Decimal(18, 6)),
    low_price_amt   SimpleAggregateFunction(min, Decimal(18, 6)),
    volume_cnt      SimpleAggregateFunction(sum, UInt64),
    trade_value_amt SimpleAggregateFunction(sum, Decimal(38, 6)),  -- sum(trade_value); для VWAP = trade_value_amt/volume_cnt
    trade_cnt       SimpleAggregateFunction(sum, UInt64)
)
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(candle_dttm)
-- board_id — часть сортировочного ключа, а не просто атрибут: у одной бумаги может быть
-- несколько бордов (основной режим, аукционы, переговорные сделки и т.п.), и молча мешать
-- их цены в одну свечу при merge нельзя (см. историю фикса — ClickHouse на это ругается).
-- Свечи по разным бордам физически раздельны; смешать их в один график — на чтении, GROUP BY sec_id, candle_dttm.
ORDER BY (sec_id, board_id, candle_dttm)
SETTINGS index_granularity = 8192
;

-- Distributed-таблица поверх dds.moex_candles_1m_local — точка входа для записи/чтения
DROP TABLE IF EXISTS dds.moex_candles_1m ON CLUSTER sharded SYNC;
CREATE TABLE IF NOT EXISTS dds.moex_candles_1m ON CLUSTER sharded
AS dds.moex_candles_1m_local
ENGINE = Distributed(sharded, dds, moex_candles_1m_local, cityHash64(sec_id))
;
