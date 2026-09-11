import os

import pendulum
from airflow.sdk import Asset, BaseHook, dag, task
from clickhouse_driver import Client


dag_id = str(os.path.basename(__file__).replace(".py", ""))
CH_STG__SECURITIES_ASSET = Asset("clickhouse://stg/securities")

def _get_client(connection_id: str = "clickhouse_connection") -> Client:
    connect = BaseHook.get_connection(connection_id)
    return Client(
        host=connect.host,
        port=int(connect.port),
        user=connect.login,
        password=connect.password,
        database="ods",
    )


@dag(
    dag_id=dag_id,
    start_date=pendulum.datetime(2023, 1, 1, tz="UTC"),
    schedule=[CH_STG__SECURITIES_ASSET],
    catchup=False,
    tags={"MOEX", "ODS"}
)
def sync_ods():
    @task(task_id="sync")
    def sync() -> None:
        client = _get_client()
        client.execute("TRUNCATE TABLE ods.r_securities")
        client.execute("""
            INSERT INTO ods.r_securities
            SELECT
                now()                   AS _loaded_dttm,
                secid                   AS sec_id,
                shortname               AS security_short_nm,
                name                    AS security_full_nm,
                isin,
                regnumber               AS reg_id,
                toUInt8(is_traded)      AS is_traded,
                toUInt32(emitent_id)    AS emitent_id,
                emitent_title           AS emitent_nm,
                emitent_inn,
                `type`                  AS security_type,
                `group`                 AS security_group_code,
                primary_boardid         AS primary_board_id,
                marketprice_boardid     AS marketprice_board_id
            FROM stg.securities
        """)
        client.execute("SYSTEM RELOAD DICTIONARY dds.r_securities_dict")
    sync()

sync_ods()
