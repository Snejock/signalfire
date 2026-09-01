from .base_config import BaseConfig
from .moex import MOEX


class AppConfig(BaseConfig):
    """Конфиг приложения: настройки из config/config.yml, дополненные
    инфраструктурными кредами из корневого .env (см. BaseConfig)"""
    moex: MOEX
