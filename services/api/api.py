import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from packages.logger.logger_setup import logger_setup
from packages.routers import candles, companies, health, news
from schemas import AppConfig

from shared.providers import ClickhouseProvider, PostgresProvider

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Подключает провайдеры при старте сервера, отключает при остановке. Код до yield
    выполняется один раз при старте, код после yield — один раз при остановке; между ними
    сервер просто работает. Передаётся в FastAPI(lifespan=lifespan) — сам FastAPI вызывает
    эту функцию."""
    logger.info("Connecting providers...")
    await asyncio.gather(
        app.state.pg_provider.connect(),
        app.state.ch_provider.connect(),
    )
    logger.info("Providers connected")

    yield

    logger.info("Closing providers...")
    await app.state.pg_provider.close()
    await app.state.ch_provider.close()
    logger.info("Providers closed")


if __name__ == "__main__":
    logger_setup(log_file_path="log/api.log", level=logging.INFO)
    logger.info("Initializing application...")

    config = AppConfig()
    app = FastAPI(title="Signalfire API", lifespan=lifespan)
    app.state.pg_provider = PostgresProvider(config=config)
    app.state.ch_provider = ClickhouseProvider(config=config)

    # Фронтенд всегда идёт через same-origin прокси (nginx в проде, Vite dev-proxy в деве —
    # см. apps/web/compose/nginx.conf и apps/web/vite.config.ts), поэтому браузер никогда не
    # делает кросс-origin запрос к этому API напрямую и CORS реального значения не имеет;
    # API к тому же read-only и без авторизации. Оставлено широким, а не убрано совсем —
    # чтобы не блокировать прямые обращения к /docs и подобные сценарии.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(companies.router)
    app.include_router(candles.router)
    app.include_router(news.router)

    uvicorn.run(app, host="0.0.0.0", port=8000)
