from .moex import MOEX
from .base_config import BaseConfig


class AppConfig(BaseConfig):
    """Конфиг приложения: настройки из config/config.yml, дополненные
    инфраструктурными кредами из корневого .env (см. BaseConfig)"""
    moex: MOEX
