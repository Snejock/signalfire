import logging

from fastapi import APIRouter, Depends

from packages.constants import MAIN_BOARD_ID
from packages.dependencies import get_ch_provider
from schemas import CompanyOut
from shared.providers import ClickhouseProvider

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/companies", response_model=list[CompanyOut])
async def list_companies(
    ch_provider: ClickhouseProvider = Depends(get_ch_provider),
) -> list[CompanyOut]:
    """Список бумаг на основном борде (см. packages/constants.py), по которым есть свечи
    (дневные — самые дешёвые для DISTINCT).

    Справочника компаний с именами/секторами в DWH пока нет (moex-fetcher опрашивает все
    бумаги без whitelist) — временно отдаём голый sec_id вместо имени, позже подтянем
    название из БД, когда там появится соответствующий справочник.
    """
    rows = await ch_provider.query(
        """
        SELECT sec_id, max(candle_dttm) AS last_seen_dttm
        FROM dds.moex_candles_1d
        WHERE board_id = %(board_id)s
        GROUP BY sec_id
        ORDER BY sec_id
        """,
        {"board_id": MAIN_BOARD_ID},
    )

    return [
        CompanyOut(sec_id=sec_id, board_id=MAIN_BOARD_ID, last_seen_at=last_seen_dttm)
        for sec_id, last_seen_dttm in rows
    ]
