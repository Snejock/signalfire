import asyncio
import logging
import yaml
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from schemas import AppConfig
from shared.providers import ClickhouseProvider, MoexProvider, BrokerProvider
from packages.utils import MoexCalendar

logger = logging.getLogger(__name__)

TOPIC = "moex_trades_raw"
SCHEMA_NM = "moex_trades_raw"


class Application:
    def __init__(self, config_path: str = "./config/config.yml", cursor: int | None = None):
        logger.info("Initialize applications...")
        self.config = self._load_config(config_path)
        self.cursor = cursor
        self.calendar = MoexCalendar(self.config.moex)
        self.tz_local = ZoneInfo(self.config.moex.timezone)

        logger.debug("Initializing providers...")
        self.ch_provider = ClickhouseProvider(config=self.config)
        self.moex_provider = MoexProvider(config=self.config, timeout_sec=10)
        self.br_provider = BrokerProvider(config=self.config)

        logger.info("All components have been successfully initialized")

    async def main_process(self):
        try:
            logger.info("Launching the clients...")
            await asyncio.gather(
                self.ch_provider.connect(),
                self.moex_provider.connect(),
                self.br_provider.connect(schema=SCHEMA_NM),
            )

            logger.info("Application is running, press Ctrl+C to stop")

            if self.cursor is None:
                await self._get_cursor()

            while True:
                await self._wait_until_market_open()

                try:
                    data = await self.moex_provider.fetch(
                        url="https://iss.moex.com/iss/engines/stock/markets/shares/trades.json",
                        cursor=self.cursor
                    )
                    columns = data.get("trades", {}).get("columns", [])
                    rows = data.get("trades", {}).get("data", [])

                    # Порядок колонок может измениться, поэтому здесь выполняется определение индекса колонок
                    if rows and columns:
                        try:
                            idx = {col: i for i, col in enumerate(columns)}
                            if "TRADENO" not in idx or "TRADETIME" not in idx:
                                logger.error("Critical columns missing in MOEX response")
                                await asyncio.sleep(5)
                                continue

                        except Exception as e:
                            logger.error(f"Error parsing columns: {e}")
                            await asyncio.sleep(5)
                            continue

                        max_cursor = self.cursor
                        sent = 0

                        # публикация сделок в брокер
                        for i in rows:
                            current_cursor = i[idx["TRADENO"]]

                            if current_cursor > max_cursor:
                                max_cursor = current_cursor

                            # datetime.timestamp() у aware-объекта уже возвращает корректный UTC-эпох
                            # независимо от того, в какой таймзоне он выражен, поэтому отдельная
                            # конвертация в UTC перед этим не нужна
                            trade_local = datetime.strptime(
                                f"{i[idx["TRADEDATE"]]} {i[idx["TRADETIME"]]}", "%Y-%m-%d %H:%M:%S"
                            ).replace(tzinfo=self.tz_local)

                            systime_local = datetime.strptime(
                                i[idx["SYSTIME"]], "%Y-%m-%d %H:%M:%S"
                            ).replace(tzinfo=self.tz_local)

                            trade_session_dt = datetime.strptime(
                                i[idx["TRADE_SESSION_DATE"]], "%Y-%m-%d"
                            ).date().isoformat()

                            message = {
                                "_source_system": "MOEX",
                                "trade_no": int(i[idx["TRADENO"]]),
                                "trade_dttm": int(trade_local.timestamp()),
                                "board_id": i[idx["BOARDID"]],
                                "sec_id": i[idx["SECID"]],
                                "price_amt": float(i[idx["PRICE"]]),
                                "quantity_cnt": int(i[idx["QUANTITY"]]),
                                "trade_value": float(i[idx["VALUE"]]),
                                "period_code": i[idx["PERIOD"]],
                                "systime_dttm": int(systime_local.timestamp()),
                                "buysell_code": i[idx["BUYSELL"]],
                                "decimals_cnt": int(i[idx["DECIMALS"]]),
                                "tradingsession_code": i[idx["TRADINGSESSION"]],
                                "trade_session_dt": trade_session_dt,
                            }

                            self.br_provider.produce(message, topic=TOPIC, key_field="sec_id")
                            sent += 1

                        # Курсор обновляется после публикации всего батча в брокер.
                        # produce() лишь ставит сообщение в очередь librdkafka — фактическая
                        # доставка подтверждается асинхронно через delivery-callback и здесь не отслеживается
                        if sent:
                            logger.info(f"Published {sent} trades to broker, last id: {max_cursor}")
                            self.cursor = max_cursor
                    else:
                        logger.debug("Received empty trades list")

                except Exception as e:
                    logger.exception("Unexpected error in main loop")

                await asyncio.sleep(self.config.moex.poll_interval_sec)

        except asyncio.CancelledError:
            logger.info("Application stopping...")
        finally:
            logger.info("Cleaning up resources...")
            await self.moex_provider.close()
            await self.ch_provider.close()
            await self.br_provider.close()
            logger.info("Providers have been successfully closed")

    def run(self):
        try:
            asyncio.run(self.main_process())
        except KeyboardInterrupt:
            logger.info("Application stopping...")

    @staticmethod
    def _load_config(path: str) -> AppConfig:
        try:
            with open(path, "r") as f:
                data = yaml.safe_load(f)
                return AppConfig(**data)
        except FileNotFoundError:
            raise FileNotFoundError(f"Config file not found: {path}")

    async def _get_cursor(self):
        logger.info("Getting initial cursor from ClickHouse...")

        while True:
            try:
                result = await self.ch_provider.query(sql="SELECT max(trade_no) FROM ods.moex_trades")

                if result and result[0] and result[0][0] is not None:
                    self.cursor = int(result[0][0])
                else:
                    logger.warning("Table is empty or NULL returned, setting cursor to 0")
                    self.cursor = 0

                logger.info(f"Cursor initialized: {self.cursor}")
                return

            except Exception as e:
                logger.error(f"Failed to get cursor: {e}. Retrying in 5 seconds...")
                await asyncio.sleep(5)

    async def _wait_until_market_open(self):
        if self.calendar.is_open():
            return
        next_open_dttm = self.calendar.get_next_open_dttm()
        now_dttm = datetime.now(self.calendar.timezone)
        wait_sec = max(0, int((next_open_dttm - now_dttm).total_seconds()))
        logger.info(f"MOEX is closed. Waiting {timedelta(seconds=int(wait_sec))} until it opens at: {next_open_dttm.isoformat()}")
        await asyncio.sleep(wait_sec)
