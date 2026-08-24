FROM python:3.14-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Копирование файлов конфигурации для кэширования слоёв
COPY pyproject.toml uv.lock ./
COPY shared/pyproject.toml ./shared/
COPY dwh/migrations/rp ./dwh/migrations/rp
COPY services/moex-fetcher/pyproject.toml ./services/moex-fetcher/

# Установка зависимостей без исходного кода
RUN uv sync \
    --index-url https://mirrors.aliyun.com/pypi/simple \
    --default-index https://mirrors.aliyun.com/pypi/simple \
    --frozen \
    --no-dev \
    --no-install-project \
    --package moex-fetcher

# Копирование исходного кода
COPY shared/ ./shared/
COPY services/moex-fetcher/ ./services/moex-fetcher/

# Финальная синхронизация с кодом проекта
RUN uv sync \
    --index-url https://mirrors.aliyun.com/pypi/simple \
    --default-index https://mirrors.aliyun.com/pypi/simple \
    --frozen \
    --no-dev \
    --no-editable \
    --package moex-fetcher

WORKDIR /app/services/moex-fetcher

RUN mkdir -p log