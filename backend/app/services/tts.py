import logging
import aiohttp

from app.config import settings

logger = logging.getLogger(__name__)

DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"


class TTSService:
    def __init__(self):
        self.api_key = settings.deepgram_api_key

    async def synthesize(self, text: str) -> bytes:
        """Convert text to audio bytes using Deepgram Aura TTS."""
        headers = {
            "Authorization": f"Token {self.api_key}",
            "Content-Type": "application/json",
        }

        params = {
            "model": "aura-asteria-en",
            "encoding": "linear16",
            "sample_rate": "24000",
        }

        payload = {"text": text}

        async with aiohttp.ClientSession() as session:
            async with session.post(
                DEEPGRAM_TTS_URL,
                headers=headers,
                params=params,
                json=payload,
            ) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    logger.error(f"TTS error ({resp.status}): {error_text}")
                    raise RuntimeError(f"TTS request failed: {resp.status}")

                audio_data = await resp.read()
                logger.info(f"TTS generated {len(audio_data)} bytes of audio")
                return audio_data
