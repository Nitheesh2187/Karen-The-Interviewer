import json
import asyncio
import logging
from typing import Callable, Awaitable

import websockets

from app.config import settings

logger = logging.getLogger(__name__)

# Deepgram's streaming STT WebSocket endpoint
# We pass our config as query parameters in the URL
DEEPGRAM_WS_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-2"
    "&language=en"
    "&smart_format=true"
    "&interim_results=true"
    "&utterance_end_ms=1500"
    "&vad_events=true"
    "&endpointing=300"
    "&encoding=linear16"
    "&sample_rate=16000"
)


class STTService:
    """
    Speech-to-Text using Deepgram's streaming WebSocket API directly.

    Instead of using the Deepgram SDK (which changed drastically in v5),
    we connect to their WebSocket endpoint directly. This is simpler,
    more transparent, and gives us full control.

    How it works:
    1. Open a WebSocket to Deepgram with our API key in the header
    2. Send raw audio bytes (PCM16, 16kHz mono)
    3. Deepgram sends back JSON with transcript results
    4. We parse the JSON and call our callback with the transcript text
    """

    def __init__(self, on_transcript: Callable[[str, bool], Awaitable[None]]):
        """
        on_transcript(text, is_final): callback when Deepgram recognizes speech.
        - text: the recognized words
        - is_final: True when Deepgram is confident this segment is complete
        """
        self.on_transcript = on_transcript
        self.ws = None
        self._running = False
        self._receive_task = None

    @property
    def is_connected(self) -> bool:
        return self.ws is not None and self._running

    async def start(self):
        """Open WebSocket connection to Deepgram."""
        # The API key goes in an HTTP header during the WebSocket handshake
        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}

        self.ws = await websockets.connect(
            DEEPGRAM_WS_URL,
            additional_headers=headers,
        )
        self._running = True

        # Start a background task to listen for responses from Deepgram
        # This runs concurrently — it doesn't block the main flow
        self._receive_task = asyncio.create_task(self._receive_loop())
        logger.info("Deepgram STT connection started")

    async def _receive_loop(self):
        """
        Background task: continuously read messages from Deepgram.

        Deepgram sends JSON messages like:
        {
          "type": "Results",
          "channel": {
            "alternatives": [{ "transcript": "hello world" }]
          },
          "is_final": true,
          "speech_final": false
        }
        """
        try:
            async for message in self.ws:
                if not self._running:
                    break

                try:
                    data = json.loads(message)
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type")

                if msg_type == "Results":
                    # Extract transcript from the nested JSON structure
                    channel = data.get("channel", {})
                    alternatives = channel.get("alternatives", [])
                    if alternatives:
                        transcript = alternatives[0].get("transcript", "")
                        if transcript:
                            is_final = data.get("is_final", False)
                            await self.on_transcript(transcript, is_final)

                elif msg_type == "UtteranceEnd":
                    # Deepgram detected end of speech (silence after talking)
                    # We don't need to handle this separately since we use
                    # is_final flag + our own debounce timer in interview.py
                    pass

        except websockets.exceptions.ConnectionClosed:
            logger.info("Deepgram STT connection closed")
        except Exception as e:
            logger.error(f"STT receive error: {e}", exc_info=True)

    async def send_audio(self, audio_bytes: bytes):
        """Send raw audio bytes to Deepgram for transcription."""
        if self.ws and self._running:
            try:
                await self.ws.send(audio_bytes)
            except Exception as e:
                logger.error(f"Error sending audio to Deepgram: {e}")

    async def stop(self):
        """Close the Deepgram WebSocket connection."""
        self._running = False
        if self.ws:
            try:
                # Send empty byte to signal end of audio
                await self.ws.send(b"")
                await self.ws.close()
            except Exception as e:
                logger.warning(f"Error closing STT connection: {e}")
            self.ws = None
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
