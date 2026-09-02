FROM ghcr.io/dbt-labs/dbt-core:1.12.3

WORKDIR /usr/app/dbt/dwh
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
