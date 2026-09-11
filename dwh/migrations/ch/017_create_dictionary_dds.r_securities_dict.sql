DROP DICTIONARY IF EXISTS dds.r_securities_dict ON CLUSTER replicated SYNC;
CREATE DICTIONARY IF NOT EXISTS dds.r_securities_dict ON CLUSTER replicated
(
    sec_id              String,
    security_short_nm   String,
    security_full_nm    String,
    isin                String,
    is_traded           UInt8,
    security_type       String,
    primary_board_id    String
)
PRIMARY KEY sec_id
SOURCE(CLICKHOUSE(NAME 'default_collection' TABLE 'r_securities' DB 'ods'))
LIFETIME(0)
LAYOUT(HASHED())
;