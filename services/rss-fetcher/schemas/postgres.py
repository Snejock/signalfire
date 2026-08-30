from pydantic import BaseModel


class PostgresConfig(BaseModel):
    host: str
    port: int
    user: str
    password: str
    database: str
