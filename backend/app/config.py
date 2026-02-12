from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    deepgram_api_key: str = ""
    groq_api_key: str = ""

    model_config = {
        "env_file": [
            str(Path(__file__).resolve().parent.parent / ".env"),
            str(Path(__file__).resolve().parent.parent.parent / ".env"),
        ],
        "env_file_encoding": "utf-8",
    }


settings = Settings()
