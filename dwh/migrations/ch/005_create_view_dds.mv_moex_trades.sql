-- Пишет из stg.kafka_moex_trades_local в dds.moex_trades_local,
-- приводя типы: Float64 -> Decimal64(6), строка YYYY-MM-DD -> Date.
DROP VIEW IF EXISTS dds.mv_moex_trades_local ON CLUSTER sharded;
CREATE MATERIALIZED VIEW IF NOT EXISTS dds.mv_moex_trades_local ON CLUSTER sharded TO dds.moex_trades_local AS
    SELECT
        _source_system,
        trade_no,
        trade_dttm,
        board_id,
        sec_id,
        toDecimal64(price_amt, 6)    AS price_amt,
        quantity_cnt,
        toDecimal64(trade_value, 6)  AS trade_value,
        period_code,
        systime_dttm,
        buysell_code,
        decimals_cnt,
        tradingsession_code,
        toDate(trade_session_dt)     AS trade_session_dt
    FROM stg.kafka_moex_trades_local
;