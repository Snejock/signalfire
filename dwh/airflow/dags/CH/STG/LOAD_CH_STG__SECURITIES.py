import os

import pendulum

from airflow.sdk import Asset, dag
from signalfire.operators.MOEXToClickhouseOperator import MOEXToClickhouseOperator


dag_id = str(os.path.basename(__file__).replace(".py", ""))

CH_STG__SECURITIES_ASSET = Asset("clickhouse://stg/securities")

@dag(
    dag_id=dag_id,
    start_date=pendulum.datetime(2023, 1, 1, tz="UTC"),
    schedule=None,
    catchup=False,
    tags={"MOEX", "NIGHT"}
)
def extract_data():
    MOEXToClickhouseOperator(
        task_id="extract_data",
        url="https://iss.moex.com/iss/securities.json",
        block_json="securities",
        iss_params={"is_trading": 1},
        connection_id="clickhouse_connection",
        trg_schema="stg",
        trg_table="securities",
        order_by_field="secid",
        outlets=[CH_STG__SECURITIES_ASSET]
    )

extract_data()
