import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from packages.logger.logger_setup import logger_setup
from packages.routers import health
from schemas import AppConfig
from shared.providers import ClickhouseProvider, PostgresProvider

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
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

    # TODO: сузить allow_origins до адреса Signalfire-фронтенда, когда он будет развёрнут
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)

    uvicorn.run(app, host="0.0.0.0", port=8000)
