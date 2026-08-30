-- Пишет из stg.kafka_moex_trades_local в dds.moex_candles_1h (Distributed), агрегируя сделки
-- в часовые OHLCV-свечи. Независима от ods.mv_moex_trades_local — ClickHouse допускает
-- несколько независимых MV на одной Kafka-таблице, каждая получает свою копию консюмленных
-- блоков
DROP VIEW IF EXISTS dds.mv_moex_candles_1h_local ON CLUSTER sharded SYNC;
CREATE MATERIALIZED VIEW IF NOT EXISTS dds.mv_moex_candles_1h_local ON CLUSTER sharded
TO dds.moex_candles_1h AS
    SELECT
        sec_id,
        board_id,
        toStartOfInterval(trade_dttm, INTERVAL 1 HOUR) AS candle_dttm,
        argMinState(toDecimal64(price_amt, 6), tuple(trade_dttm, trade_no)) AS open_price_amt,
        argMaxState(toDecimal64(price_amt, 6), tuple(trade_dttm, trade_no)) AS close_price_amt,
        max(toDecimal64(price_amt, 6))       AS high_price_amt,
        min(toDecimal64(price_amt, 6))       AS low_price_amt,
        sum(quantity_cnt)                    AS volume_cnt,
        sum(toDecimal64(trade_value, 6))     AS trade_value_amt,
        count()                              AS trade_cnt
    FROM stg.kafka_moex_trades_local
    GROUP BY sec_id, board_id, candle_dttm
;
