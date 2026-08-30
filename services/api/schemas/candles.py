from datetime import datetime
from typing import Literal

from pydantic import BaseModel

Timeframe = Literal["1m", "5m", "15m", "1h", "1d"]


class CandleOut(BaseModel):
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int
    vwap: float | None = None


class CandlesOut(BaseModel):
    sec_id: str
    board_id: str
    timeframe: Timeframe
    candles: list[CandleOut]
