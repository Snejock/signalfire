import asyncio
import json
import logging
import os
from pathlib import Path

from confluent_kafka import SerializingProducer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
from confluent_kafka.serialization import StringSerializer

logger = logging.getLogger(__name__)

# Корень репозитория (в контейнере совпадает с /app — см. Dockerfile,
# где shared/ копируется в WORKDIR /app/shared)
BASE_DIR = Path(__file__).resolve().parents[2]
DEFAULT_SCHEMA_DIR = BASE_DIR / "dwh" / "migrations" / "rp"


class BrokerProvider:
    """Провайдер для публикации сообщений в Redpanda (Kafka) через Avro + Schema Registry"""

    def __init__(self, config):
        self.config = config.broker
        self._producer = None
        self._lock = asyncio.Lock()

    async def connect(self, schema: str) -> None:
        async with self._lock:
            if self._producer is None:
                try:
                    sr_client = SchemaRegistryClient({'url': self.config.schema_registry_url})
                    avro_serializer = AvroSerializer(
                        schema_registry_client=sr_client,
                        schema_str=self._load_avro_schema(schema),
                        conf={'auto.register.schemas': True}
                    )
                    string_serializer = StringSerializer('utf_8')

                    conf = {
                        'bootstrap.servers': f"{self.config.host}:{self.config.port}",
                        'client.id': self.config.client_id,
                        "linger.ms": self.config.linger_ms,
                        "batch.size": self.config.batch_size,
                        "compression.type": self.config.compression_type,
                        "acks": self.config.acks,
                        'key.serializer': string_serializer,
                        'value.serializer': avro_serializer,
                    }
                    self._producer = SerializingProducer(conf)
                    logger.info("Broker avro producer initialized")

                except Exception:
                    logger.exception("Failed to initialize broker producer")
                    raise

    async def close(self) -> None:
        async with self._lock:
            if self._producer is not None:
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, self._producer.flush)
                self._producer = None
                logger.info("Broker producer closed")

    def produce(self, message: dict, topic: str, key_field: str) -> None:
        if self._producer is None:
            raise RuntimeError("Producer is not connected")

        try:
            self._producer.produce(
                topic=topic,
                key=str(message[key_field]),
                value=message,
                on_delivery=self._delivery_report
            )
        except Exception:
            logger.exception("Error producing to broker")

        self._producer.poll(0)  # обработка внутренних событий (в т.ч. delivery callbacks)

    @staticmethod
    def _delivery_report(err, msg):
        if err is not None:
            logger.error(f"Message delivery failed: {err}")
        else:
            logger.debug(f"Message delivered to {msg.topic()} [{msg.partition()}] at offset {msg.offset()}")

    @staticmethod
    def _load_avro_schema(schema: str) -> str:
        """
        Читает Avro-схему по имени из dwh/migrations/rp/<schema>.json.
        Путь можно переопределить переменной окружения DWH__SCHEMA_DIR
        """
        schema_dir = os.environ.get("DWH__SCHEMA_DIR", str(DEFAULT_SCHEMA_DIR))
        schema_path = os.path.join(schema_dir, f"{schema}.json")

        with open(schema_path) as f:
            return json.dumps(json.load(f))
