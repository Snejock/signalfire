from pydantic import BaseModel


class RSSFetcherConfig(BaseModel):
    topic: str = "SGN_RSS_NEWS_RAW"
    schema_nm: str = "SGN_RSS_NEWS_RAW"
