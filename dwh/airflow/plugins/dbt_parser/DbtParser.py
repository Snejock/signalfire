import json
import logging
import os
from airflow.providers.standard.operators.bash import BashOperator
from airflow.providers.standard.operators.trigger_dagrun import TriggerDagRunOperator
# from airflow.providers.ssh.operators.ssh import SSHOperator
from airflow.utils.task_group import TaskGroup


class DbtParser:
    """
    Utility class for parsing dbt projects and creating corresponding Airflow task groups.

    Analyzes dbt manifest.json to automatically create Airflow tasks for dbt model execution.
    Supports model grouping by dag_id metadata and automatic dependency resolution.

    Key features:
    - Loads and parses dbt manifest.json
    - Creates BashOperator tasks for dbt commands via Docker
    - Creates TriggerDagRunOperator tasks for external DAGs
    - Automatic task dependency resolution
    - Model grouping by dag_id from metadata
    - DBT tag filtering support
    - Variable passing to dbt commands

    :param dag: Airflow DAG for task attachment
    :param dbt_global_cli_flags: Global dbt CLI flags
    :param dbt_project_dir: Directory containing dbt_project.yml
    :param dbt_profiles_dir: Directory containing profiles.yml
    :param dbt_target: Target dbt profile (dev, prod, etc.)
    :param dbt_tag: Filter models by specific tag
    :param dbt_run_group_name: Task group name for dbt run (default: 'dbt_run')
    :param dbt_test_group_name: Task group name for dbt test (default: 'dbt_test')
    :param dbt_vars: Dictionary of variables for dbt commands

    Example:
        parser = DbtParser(dag=dag, dbt_target='prod', dbt_tag='daily')
        run_group = parser.get_dbt_run_group()
    """

    def __init__(self, dag=None, dbt_global_cli_flags=None, dbt_project_dir=None, dbt_profiles_dir=None,
                 dbt_target=None,dbt_tag=None, dbt_run_group_name='dbt_run', dbt_test_group_name='dbt_test',
                 dbt_vars=None):
        self.dag = dag
        self.dbt_global_cli_flags = dbt_global_cli_flags
        self.dbt_project_dir = dbt_project_dir
        self.dbt_profiles_dir = dbt_profiles_dir
        self.dbt_target = dbt_target
        self.dbt_tag = dbt_tag
        self.dbt_vars = dbt_vars or {}

        self.dbt_run_group = TaskGroup(dbt_run_group_name)
        # self.dbt_test_group = TaskGroup(dbt_test_group_name)

        self.processing()

    def load_dbt_manifest(self):
        """
        Helper function to load the dbt manifest file.

        Returns: A JSON object containing the dbt manifest content.
        """
        # manifest_path = os.path.join(self.dbt_project_dir, 'dbt', 'target', 'manifest.json')
        manifest_path = os.path.abspath('/opt/dwh/dbt/target/manifest.json')
        try:
            if not os.path.exists(manifest_path):
                raise FileNotFoundError(f'Manifest file not found: {manifest_path}')

            with open(manifest_path, 'r', encoding='utf-8') as f:
                file_content = json.load(f)

            if not file_content.get('nodes'):
                raise ValueError('Invalid manifest: missing "nodes" section')

            return file_content

        except (FileNotFoundError, json.JSONDecodeError, ValueError) as e:
            logging.error(f'Failed to load dbt manifest: {e}')
            raise

    def make_dbt_task(self, node_name, dbt_verb):
        """
        Takes the manifest JSON content and returns a BashOperator task
        to run a dbt command.

        Args:
            node_name: The name of the node
            dbt_verb: 'run' or 'test'

        Returns: A BashOperator task that runs the respective dbt command
        """

        model_name = node_name.split('.')[-1]
        if dbt_verb == 'test':
            node_name = node_name.replace('model', 'test')  # Just a cosmetic renaming of the task
            task_group = self.dbt_test_group
        else:
            task_group = self.dbt_run_group

        # Prepare vars string if any variables are provided
        vars_str = ''
        if self.dbt_vars:
            vars_json = json.dumps(self.dbt_vars)
            vars_str = f"--vars '{vars_json}'"

        dbt_task = BashOperator(
            task_id=node_name,
            task_group=task_group,
            bash_command=(f"""
                docker exec dwh_dbt dbt {self.dbt_global_cli_flags} {dbt_verb} \
                --target {self.dbt_target} \
                --models {model_name} \
                --profiles-dir {self.dbt_profiles_dir} \
                --project-dir {self.dbt_project_dir} \
                {vars_str}
            """
            ),
            # env={
            #     'DBT_USER': '{{ conn.postgres.login }}',
            #     'DBT_ENV_SECRET_PASSWORD': '{{ conn.postgres.password }}',
            #     'DBT_HOST': '{{ conn.postgres.host }}',
            #     'DBT_SCHEMA': '{{ conn.postgres.schema }}',
            #     'DBT_PORT': '{{ conn.postgres.port }}',
            # },
            dag=self.dag
        )
        # Keeping the log output, it's convenient to see when testing the python code outside of Airflow
        logging.info('Created task: %s', node_name)
        return dbt_task

        # dbt_task = SSHOperator(
        #     task_id=node_name,
        #     ssh_conn_id='dbt',
        #     cmd_timeout=86400,
        #     command=(
        #         f'source /opt/dbt/venv/bin/activate | '
        #         f'/opt/dbt/venv/bin/./dbt {self.dbt_global_cli_flags} {dbt_verb} '
        #         f'--target {self.dbt_target} --models {model_name} '
        #         f'--profiles-dir {self.dbt_profiles_dir} --project-dir {self.dbt_project_dir}'
        #     )
        # )
        # # Keeping the log output, it's convenient to see when testing the python code outside of Airflow
        # logging.info('Created task: %s', node_name)
        # return dbt_task

    def make_dag_task(self, dag_id, dbt_verb):
        """
        Takes the manifest JSON content and returns a TriggerDagRunOperator task
        to run a DAG.

        Args:
            dag_id: The dag_id of the DAG to trigger
            dbt_verb: 'run' or 'test'

        Returns: A TriggerDagRunOperator task that runs
        """

        if dag_id in self.dag.task_dict:
            logging.info(f'Task {dag_id} already exists. Skipping duplicate creation')
            return self.dag.get_task(dag_id)

        if dbt_verb == 'test':
            task_group = self.dbt_test_group
        else:
            task_group = self.dbt_run_group

        # # Prepare vars string if any variables are provided
        # vars_str = ''
        # if self.dbt_vars:
        #     import json
        #     vars_json = json.dumps(self.dbt_vars)
        #     vars_str = f"--vars '{vars_json}'"

        dag_task = TriggerDagRunOperator(
            task_id=dag_id,
            task_group=task_group,
            trigger_dag_id=dag_id,
            wait_for_completion=True,
            poke_interval=15,
            dag=self.dag
        )
        # Keeping the log output, it's convenient to see when testing the python code outside of Airflow
        logging.info('Created DAG task: %s', dag_id)
        return dag_task

        # dbt_task = SSHOperator(
        #     task_id=node_name,
        #     ssh_conn_id='dbt',
        #     cmd_timeout=86400,
        #     command=(
        #         f'source /opt/dbt/venv/bin/activate | '
        #         f'/opt/dbt/venv/bin/./dbt {self.dbt_global_cli_flags} {dbt_verb} '
        #         f'--target {self.dbt_target} --models {model_name} '
        #         f'--profiles-dir {self.dbt_profiles_dir} --project-dir {self.dbt_project_dir}'
        #     )
        # )
        # # Keeping the log output, it's convenient to see when testing the python code outside of Airflow
        # logging.info('Created task: %s', node_name)
        # return dbt_task

    def get_dbt_run_group(self):
        """
        Getter method to retrieve the previously constructed dbt tasks.

        Returns: An Airflow task group with dbt run nodes.
        """
        return self.dbt_run_group

    def get_dbt_test_group(self):
        """
        Getter method to retrieve the previously constructed dbt tasks.

        Returns: An Airflow task group with dbt test nodes.
        """
        return self.dbt_test_group

    def processing(self):
        """
        Parse out a JSON file and populates the task groups with dbt tasks
        """
        manifest_json = self.load_dbt_manifest()

        # 1: Grouping models by dag_id
        dag_groups = {}
        model_to_dag_id = {}
        local_tasks = {}

        for node_name in manifest_json['nodes'].keys():
            if node_name.split('.')[0] == 'model':
                tags = manifest_json['nodes'][node_name]['tags']
                # Only use nodes with the right tag, if tag is specified
                if (self.dbt_tag and self.dbt_tag in tags) or not self.dbt_tag:
                    dag_id = manifest_json['nodes'][node_name]['meta']['dag_id']

                    # Skip model if its dag_id is the current DAG, create a dbt_task
                    if dag_id == self.dag.dag_id:
                        task = self.make_dbt_task(node_name, dbt_verb='run')
                        local_tasks[node_name] = task
                        continue

                    # Add model into group
                    if dag_id not in dag_groups:
                        dag_groups[dag_id] = []
                    dag_groups[dag_id].append(node_name)
                    model_to_dag_id[node_name] = dag_id

        # 2: Creating tasks for each group (dag_id)
        dag_tasks = {}

        for dag_id, models in dag_groups.items():
            # Create only one task for group models
            dag_tasks[dag_id] = self.make_dag_task(dag_id, dbt_verb='run')
            logging.info(f'Created DAG task for group {dag_id} containing models: {models}')

        # 3: Set dependencies between local tasks
        for node_name, task in local_tasks.items():
            upstream_nodes = manifest_json['nodes'][node_name]['depends_on']['nodes']

            for upstream_node in upstream_nodes:
                if upstream_node in local_tasks:
                    local_tasks[upstream_node] >> task
                    logging.info(f'Set local dependency: {upstream_node} >> {node_name}')

        # 4: Set dependencies between groups
        dag_dependencies = {}

        for node_name in model_to_dag_id.keys():
            current_dag_id = model_to_dag_id[node_name]

            # Get upstream models for current model
            upstream_nodes = manifest_json['nodes'][node_name]['depends_on']['nodes']

            for upstream_node in upstream_nodes:
                if upstream_node in model_to_dag_id:
                    upstream_dag_id = model_to_dag_id[upstream_node]

                    if upstream_dag_id != current_dag_id:
                        if current_dag_id not in dag_dependencies:
                            dag_dependencies[current_dag_id] = set()
                        dag_dependencies[current_dag_id].add(upstream_dag_id)

        # 5: Apply dependencies between groups
        for downstream_dag_id, upstream_dag_ids in dag_dependencies.items():
            for upstream_dag_id in upstream_dag_ids:
                if upstream_dag_id in dag_tasks and downstream_dag_id in dag_tasks:
                    dag_tasks[upstream_dag_id] >> dag_tasks[downstream_dag_id]
                    logging.info(f'Set dependency: {upstream_dag_id} >> {downstream_dag_id}')
