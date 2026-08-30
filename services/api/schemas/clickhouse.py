from pydantic import BaseModel


class ClickhouseConfig(BaseModel):
    host: str
    port: int
    user: str
    password: str
    secure: bool
