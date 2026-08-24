from typing import List
from pydantic import BaseModel


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
    weekly: List[DayRule]
    special: List[SpecialDateRule] = []
    lag_start_minutes: int = 0
    lag_stop_minutes: int = 0
