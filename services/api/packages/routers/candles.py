import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status

from packages.constants import MAIN_BOARD_ID
from packages.dependencies import get_ch_provider
from schemas import CandleOut, CandlesOut, Timeframe
from shared.providers import ClickhouseProvider

logger = logging.getLogger(__name__)

router = APIRouter()

# Whitelist таймфрейм -> таблица. timeframe уже провалидирован FastAPI как Literal, но имя
# таблицы всё равно берётся только отсюда, а не собирается из request-строки напрямую.
TIMEFRAME_TABLES: dict[Timeframe, str] = {
    "1m": "dds.moex_candles_1m",
    "5m": "dds.moex_candles_5m",
    "15m": "dds.moex_candles_15m",
    "1h": "dds.moex_candles_1h",
    "1d": "dds.moex_candles_1d",
}

# Дефолтное окно "от", если start_dttm не передан — чтобы по умолчанию не гонять весь
# бессрочный датасет (1d хранится без TTL).
DEFAULT_LOOKBACK: dict[Timeframe, timedelta] = {
    "1m": timedelta(days=1),
    "5m": timedelta(days=7),
    "15m": timedelta(days=14),
    "1h": timedelta(days=90),
    "1d": timedelta(days=730),
}


@router.get("/candles/{sec_id}", response_model=CandlesOut)
async def get_candles(
    sec_id: str,
    timeframe: Timeframe = Query("1d"),
    start_dttm: datetime | None = Query(None),
    end_dttm: datetime | None = Query(None),
    ch_provider: ClickhouseProvider = Depends(get_ch_provider),
) -> CandlesOut:
    # Борд пока жёстко зафиксирован (см. packages/constants.py) — не резолвим и не
    # принимаем параметром, работаем только с основным режимом торгов.
    table = TIMEFRAME_TABLES[timeframe]

    exists = await ch_provider.query(
        "SELECT count() FROM dds.moex_candles_1d WHERE sec_id = %(sec_id)s AND board_id = %(board_id)s",
        {"sec_id": sec_id, "board_id": MAIN_BOARD_ID},
    )
    if not exists or not exists[0][0]:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown sec_id: {sec_id}")

    end_dttm = end_dttm or datetime.now(timezone.utc)
    start_dttm = start_dttm or (end_dttm - DEFAULT_LOOKBACK[timeframe])

    # open/close — AggregateFunction(argMin/argMax) states: AggregatingMergeTree не гарантирует,
    # что все parts на момент чтения смержены, поэтому читаем через -Merge с GROUP BY.
    # high/low/volume/trade_value — SimpleAggregateFunction, читаются напрямую max/min/sum,
    # тоже с GROUP BY по той же причине.
    rows = await ch_provider.query(
        f"""
        SELECT
            candle_dttm,
            argMinMerge(open_price_amt)                         AS open,
            max(high_price_amt)                                 AS high,
            min(low_price_amt)                                  AS low,
            argMaxMerge(close_price_amt)                        AS close,
            sum(volume_cnt)                                     AS volume,
            sum(trade_value_amt) / nullif(sum(volume_cnt), 0)   AS vwap
        FROM {table}
        WHERE sec_id = %(sec_id)s AND board_id = %(board_id)s
          AND candle_dttm >= %(start_dttm)s AND candle_dttm < %(end_dttm)s
        GROUP BY candle_dttm
        ORDER BY candle_dttm
        """,
        {"sec_id": sec_id, "board_id": MAIN_BOARD_ID, "start_dttm": start_dttm, "end_dttm": end_dttm},
    )

    candles = [
        CandleOut(ts=ts, open=open_, high=high, low=low, close=close, volume=volume, vwap=vwap)
        for ts, open_, high, low, close, volume, vwap in rows
    ]

    return CandlesOut(sec_id=sec_id, board_id=MAIN_BOARD_ID, timeframe=timeframe, candles=candles)
