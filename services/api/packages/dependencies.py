from fastapi import Request
from shared.providers import ClickhouseProvider, PostgresProvider


def get_pg_provider(request: Request) -> PostgresProvider:
    return request.app.state.pg_provider


def get_ch_provider(request: Request) -> ClickhouseProvider:
    return request.app.state.ch_provider
