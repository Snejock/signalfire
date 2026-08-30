from datetime import datetime

from pydantic import BaseModel


class CompanyOut(BaseModel):
    sec_id: str
    board_id: str
    # Человекочитаемое имя — временно всегда None (нет справочника компаний в БД),
    # фронтенд в этом случае показывает sec_id. Поле оставлено на будущее: когда в БД
    # появится справочник компаний, /companies начнёт его заполнять.
    name: str | None = None
    last_seen_at: datetime
