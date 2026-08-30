from pydantic import BaseModel


class BrokerConfig(BaseModel):
    host: str
    port: int
    client_id: str
    schema_registry_url: str
    linger_ms: int
    batch_size: int
    compression_type: str
    acks: int
