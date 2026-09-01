import logging

import httpx
from pydantic import HttpUrl

logger = logging.getLogger(__name__)


class HttpProvider:
    """Универсальный асинхронный HTTP-клиент (с опциональной поддержкой прокси)"""

    def __init__(self, timeout_sec: int = 10, proxy_url: str | None = None, user_agent: str = "signalfire/1.0"):
        self._client: httpx.AsyncClient | None = None
        self._timeout = timeout_sec
        self._proxy_url = proxy_url
        self._user_agent = user_agent

    async def connect(self) -> None:
        if self._client is None:
            self._client = httpx.AsyncClient(
                http2=True,
                timeout=self._timeout,
                follow_redirects=True,
                headers={"User-Agent": self._user_agent},
                proxy=self._proxy_url,
            )
            logger.info("HTTP client initialized")

    async def fetch(self, url: str | HttpUrl) -> str:
        if self._client is None:
            raise RuntimeError("HTTP client is not connected. Call connect() first.")

        response = await self._client.get(str(url))
        response.raise_for_status()
        return response.text

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
            logger.info("HTTP client closed")
