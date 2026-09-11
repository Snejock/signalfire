DROP TABLE IF EXISTS ods.r_securities ON CLUSTER replicated SYNC;
CREATE TABLE IF NOT EXISTS ods.r_securities ON CLUSTER replicated
(
    _loaded_dttm         DateTime DEFAULT now(),
    sec_id               LowCardinality(String),
    security_short_nm    String,
    security_full_nm     String,
    isin                 LowCardinality(String),
    reg_id               String,
    is_traded            UInt8,
    emitent_id           UInt32,
    emitent_nm           String,
    emitent_inn          String,
    security_type        LowCardinality(String),
    security_group_code  LowCardinality(String),
    primary_board_id     LowCardinality(String),
    marketprice_board_id LowCardinality(String)
)
ENGINE = MergeTree()
ORDER BY sec_id
;