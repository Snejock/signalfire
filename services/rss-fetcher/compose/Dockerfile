FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Копирование файлов конфигурации и кода shared (нужен целиком для сборки его пакета)
COPY pyproject.toml uv.lock ./
COPY shared/ ./shared/
COPY services/rss-fetcher/pyproject.toml ./services/rss-fetcher/

# Установка зависимостей без исходного кода
RUN uv sync \
    --index-url https://mirrors.aliyun.com/pypi/simple \
    --default-index https://mirrors.aliyun.com/pypi/simple \
    --frozen \
    --no-dev \
    --no-install-project \
    --package rss-fetcher

# Копирование исходного кода
COPY services/rss-fetcher/ ./services/rss-fetcher/
COPY dwh/migrations/rp ./dwh/migrations/rp

# Финальная синхронизация с кодом проекта
RUN uv sync \
    --index-url https://mirrors.aliyun.com/pypi/simple \
    --default-index https://mirrors.aliyun.com/pypi/simple \
    --frozen \
    --no-dev \
    --no-editable \
    --package rss-fetcher

WORKDIR /app/services/rss-fetcher

RUN mkdir -p log
