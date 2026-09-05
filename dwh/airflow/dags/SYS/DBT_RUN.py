import os
import logging
from datetime import datetime
from airflow import DAG
from airflow.providers.standard.operators.bash import BashOperator


dag_id = str(os.path.basename(__file__).replace('.py', ''))

with DAG(
    dag_id=dag_id,
    start_date=datetime(2020, 12, 31),
    description='',
    schedule=None,
    catchup=False,
    params={'model_name': ''},
    tags={'sys'}
) as dag:
    dbt_run = BashOperator(
        task_id='dbt_compile',
        bash_command=(f"""
            docker exec sgn-dbt dbt run --select {{{{ params.model_name }}}} -d \
            --target {os.environ.get('DBT_TARGET', 'prod')} \
            --profiles-dir {os.environ.get('DBT_PROFILES_DIR')} \
            --project-dir {os.environ.get('DBT_PROJECT_DIR')}
        """
        ),
        # env={
        #     'DBT_USER': '{{ conn.postgres.login }}',
        #     'DBT_ENV_SECRET_PASSWORD': '{{ conn.postgres.password }}',
        #     'DBT_HOST': '{{ conn.postgres.host }}',
        #     'DBT_SCHEMA': '{{ conn.postgres.schema }}',
        #     'DBT_PORT': '{{ conn.postgres.port }}',
        # },
        dag=dag
    )

    # Keeping the log output, it's convenient to see when testing the python code outside of Airflow
    logging.info('DBT run was completed successfully')

    dbt_run
