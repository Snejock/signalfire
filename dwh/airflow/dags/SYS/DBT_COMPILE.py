import os
import logging
from datetime import datetime
from airflow import DAG
from airflow.providers.standard.operators.bash import BashOperator


dag_id = str(os.path.basename(__file__).replace('.py', ''))

# Пути — внутри контейнера sgn-dbt (см. dwh/compose/dbt/docker-compose.yaml: volumes/working_dir)
DBT_TARGET = os.environ.get('DBT_TARGET', 'prod')
DBT_PROFILES_DIR = os.environ.get('DBT_PROFILES_DIR', '/root/.dbt')
DBT_PROJECT_DIR = os.environ.get('DBT_PROJECT_DIR', '/usr/app/dbt/dwh')

with DAG(
    dag_id=dag_id,
    start_date=datetime(2020, 12, 31),
    description='',
    schedule=None,
    catchup=False,
    tags={'SYS'}
) as dag:
    dbt_compile = BashOperator(
        task_id='dbt_compile',
        bash_command=(f"""
            docker exec sgn-dbt dbt compile \
            --target {DBT_TARGET} \
            --profiles-dir {DBT_PROFILES_DIR} \
            --project-dir {DBT_PROJECT_DIR}
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
    logging.info('DBT compile was completed successfully')

    dbt_compile
