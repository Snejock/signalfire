-- Raw Kafka-таблица — consumer топика SGN_MOEX_TRADES_RAW (Avro + Schema Registry).
-- На каждом шарде свой независимый consumer с общим kafka_group_name —
-- Redpanda сам разруливает партиции топика между консьюмерами группы.
DROP TABLE IF EXISTS stg.kafka_moex_trades_local ON CLUSTER sharded SYNC;
CREATE TABLE IF NOT EXISTS stg.kafka_moex_trades_local ON CLUSTER sharded
(
    _source_system          LowCardinality(String),
    trade_no                UInt64,
    trade_dttm              DateTime,
    board_id                LowCardinality(String),
    sec_id                  LowCardinality(String),
    price_amt               Float64,
    quantity_cnt            UInt64,
    trade_value             Float64,
    period_code             LowCardinality(String),
    systime_dttm            DateTime,
    buysell_code            LowCardinality(String),
    decimals_cnt            UInt8,
    tradingsession_code     LowCardinality(String),
    trade_session_dt        String
)
ENGINE = Kafka
SETTINGS kafka_broker_list = 'loki:39092',
         kafka_topic_list = 'SGN_MOEX_TRADES_RAW',
         kafka_group_name = 'LOAD_CH_STG_MOEX_TRADES',
         kafka_format = 'AvroConfluent',
         format_avro_schema_registry_url = 'http://loki:38081'
;