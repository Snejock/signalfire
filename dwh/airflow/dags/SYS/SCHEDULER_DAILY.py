import os
from datetime import datetime
from airflow import DAG
from airflow.providers.standard.operators.empty import EmptyOperator
from airflow.models.param import Param
from dbt_parser import DbtParser


dag_id = str(os.path.basename(__file__).replace('.py', ''))
default_args = {
    'start_date': datetime(2020, 12, 31),
    'retries': 0,
}

with DAG(
    dag_id=dag_id,
    doc_md='A dbt wrapper for Airflow using a utility class to map the dbt DAG to Airflow tasks',
    max_active_runs=1,
    max_active_tasks=1,
    default_args=default_args,
    schedule='0 3 * * *',
    catchup=False,
    tags={'sys'},
    params={
        'start_dt': Param(
            None,
            type=['null', 'string'],
            description='Start date (YYYY-MM-DD)'
        ),
        'end_dt': Param(
            None,
            type=['null', 'string'],
            description='End date (YYYY-MM-DD)'
        )
    }
) as dag:

    start = EmptyOperator(task_id='start')
    end = EmptyOperator(task_id='end')

    # The parser parses out a dbt manifest.json file and dynamically creates tasks for "dbt run" and "dbt test"
    # commands for each individual model. It groups them into task groups which we can retrieve and use in the DAG.
    dag_parser = DbtParser(
        dag=dag,
        dbt_global_cli_flags=os.environ.get('DBT_GLOBAL_CLI_FLAGS'),
        dbt_project_dir=os.environ.get('DBT_PROJECT_DIR'),
        dbt_profiles_dir=os.environ.get('DBT_PROFILES_DIR'),
        dbt_target=os.environ.get('DBT_TARGET'),
        dbt_tag='daily',
        dbt_vars={
            'start_dt': '{{ params.start_dt }}',
            'end_dt': '{{ params.end_dt }}'
        }
    )
    dbt_run_group = dag_parser.get_dbt_run_group()
    # dbt_test_group = dag_parser.get_dbt_test_group()

    start >> dbt_run_group >> end
