import os

import pendulum

from airflow.sdk import dag
from signalfire.operators.MOEXToClickhouseOperator import MOEXToClickhouseOperator


dag_id = str(os.path.basename(__file__).replace(".py", ""))

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
        url="https://iss.moex.com/iss/index.json",
        block_json="boardgroups",
        iss_params={},
        connection_id="clickhouse_connection",
        trg_schema="stg",
        trg_table="board_groups",
        order_by_field="board_group_id",
        is_pagination=False
    )

extract_data()
