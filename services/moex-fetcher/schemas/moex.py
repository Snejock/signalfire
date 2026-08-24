from typing import Annotated
from pydantic import BaseModel, Field


class DayRule(BaseModel):
    week_day: int
    is_work_day: int
    start_time: str
    stop_time: str


class SpecialDateRule(BaseModel):
    date: str
    is_work_day: int
    start_time: str
    stop_time: str


class MOEX(BaseModel):
    timezone: str
    weekly: list[DayRule]
    special: list[SpecialDateRule] = []
    lag_start_minutes: int = 0
    lag_stop_minutes: int = 0
    poll_interval_sec: Annotated[float, Field(gt=0)] = 2.0
