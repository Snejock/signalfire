-- Оперативный слой (ODS): сделки MOEX без агрегации, TTL — 30 дней с момента сделки.
DROP TABLE IF EXISTS ods.moex_trades_local ON CLUSTER sharded SYNC;
CREATE TABLE IF NOT EXISTS ods.moex_trades_local ON CLUSTER sharded
(
    _loaded_dttm        DateTime DEFAULT now(),
    _source_system      LowCardinality(String),
    trade_no            UInt64,
    trade_dttm          DateTime,
    board_id            LowCardinality(String),
    sec_id              LowCardinality(String),
    price_amt           Decimal(18, 6),
    quantity_cnt        UInt64,
    trade_value         Decimal(18, 6),
    period_code         LowCardinality(String),
    systime_dttm        DateTime,
    buysell_code        LowCardinality(String),
    decimals_cnt        UInt8,
    tradingsession_code LowCardinality(String),
    trade_session_dt    Date,

    INDEX idx_sec_id sec_id TYPE set(100) GRANULARITY 1,
    INDEX idx_trade_dttm trade_dttm TYPE minmax GRANULARITY 1
)
ENGINE = ReplacingMergeTree(_loaded_dttm)
PARTITION BY toYYYYMM(trade_dttm)
ORDER BY (sec_id, trade_dttm, trade_no)
TTL trade_dttm + INTERVAL 30 DAY DELETE
SETTINGS index_granularity = 8192
;

-- Distributed-таблица поверх ods.moex_trades_local — точка входа для записи/чтения
DROP TABLE IF EXISTS ods.moex_trades ON CLUSTER sharded SYNC;
CREATE TABLE IF NOT EXISTS ods.moex_trades ON CLUSTER sharded
AS ods.moex_trades_local
ENGINE = Distributed(sharded, ods, moex_trades_local, cityHash64(sec_id))
;
