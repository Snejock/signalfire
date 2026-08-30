from pydantic import BaseModel


class ProxyConfig(BaseModel):
    host: str
    port: int
    user: str
    password: str
