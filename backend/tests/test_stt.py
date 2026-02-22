"""
Unit tests for STTService.

We mock the websockets library so we don't connect to Deepgram.
The key things to test:
- _receive_loop parses Deepgram JSON correctly
- Callback is called with the right (text, is_final)
- send_audio forwards bytes to the WebSocket
- stop() cleans up properly
"""

import json
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock

from app.services.stt import STTService


class AsyncIterator:
    """Helper to make a list work with `async for`."""
    def __init__(self, items):
        self.items = iter(items)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self.items)
        except StopIteration:
            raise StopAsyncIteration


def _mock_ws(messages: list[str]):
    """Create a mock WebSocket that yields the given messages via `async for`."""
    mock = AsyncMock()
    mock.__aiter__ = lambda self: AsyncIterator(messages)
    return mock


def _deepgram_result(transcript: str, is_final: bool) -> str:
    """Build a fake Deepgram Results JSON message."""
    return json.dumps({
        "type": "Results",
        "channel": {
            "alternatives": [{"transcript": transcript}]
        },
        "is_final": is_final,
    })


def _deepgram_utterance_end() -> str:
    """Build a fake Deepgram UtteranceEnd JSON message."""
    return json.dumps({"type": "UtteranceEnd"})


@patch("app.services.stt.websockets.connect", new_callable=AsyncMock)
async def test_start_connects_to_deepgram(mock_connect):
    """start() should open a WebSocket and set is_connected."""
    mock_connect.return_value = _mock_ws([])

    callback = AsyncMock()
    stt = STTService(on_transcript=callback)

    await stt.start()

    assert stt.is_connected is True
    mock_connect.assert_called_once()
    call_url = mock_connect.call_args[0][0]
    assert "api.deepgram.com" in call_url
    assert "nova-2" in call_url

    await stt.stop()


@patch("app.services.stt.websockets.connect", new_callable=AsyncMock)
async def test_receive_loop_calls_callback_on_final_transcript(mock_connect):
    """When Deepgram sends a final Results message, callback should fire."""
    mock_connect.return_value = _mock_ws([_deepgram_result("hello world", is_final=True)])

    callback = AsyncMock()
    stt = STTService(on_transcript=callback)

    await stt.start()
    await asyncio.sleep(0.05)

    callback.assert_called_once_with("hello world", True)
    await stt.stop()


@patch("app.services.stt.websockets.connect", new_callable=AsyncMock)
async def test_receive_loop_calls_callback_on_interim_transcript(mock_connect):
    """Interim transcripts (is_final=False) should also trigger the callback."""
    mock_connect.return_value = _mock_ws([_deepgram_result("I am", is_final=False)])

    callback = AsyncMock()
    stt = STTService(on_transcript=callback)

    await stt.start()
    await asyncio.sleep(0.05)

    callback.assert_called_once_with("I am", False)
    await stt.stop()


@patch("app.services.stt.websockets.connect", new_callable=AsyncMock)
async def test_receive_loop_ignores_empty_transcript(mock_connect):
    """Empty transcripts should not trigger the callback."""
    mock_connect.return_value = _mock_ws([_deepgram_result("", is_final=True)])

    callback = AsyncMock()
    stt = STTService(on_transcript=callback)

    await stt.start()
    await asyncio.sleep(0.05)

    callback.assert_not_called()
    await stt.stop()


@patch("app.services.stt.websockets.connect", new_callable=AsyncMock)
async def test_receive_loop_ignores_utterance_end(mock_connect):
    """UtteranceEnd messages should not trigger the callback."""
    mock_connect.return_value = _mock_ws([_deepgram_utterance_end()])

    callback = AsyncMock()
    stt = STTService(on_transcript=callback)

    await stt.start()
    await asyncio.sleep(0.05)

    callback.assert_not_called()
    await stt.stop()


@patch("app.services.stt.websockets.connect", new_callable=AsyncMock)
async def test_receive_loop_handles_invalid_json(mock_connect):
    """Invalid JSON should be silently skipped, not crash."""
    mock_connect.return_value = _mock_ws([
        "not valid json",
        _deepgram_result("works", is_final=True),
    ])

    callback = AsyncMock()
    stt = STTService(on_transcript=callback)

    await stt.start()
    await asyncio.sleep(0.05)

    callback.assert_called_once_with("works", True)
    await stt.stop()


@patch("app.services.stt.websockets.connect", new_callable=AsyncMock)
async def test_send_audio_forwards_bytes(mock_connect):
    """send_audio should forward raw bytes to the Deepgram WebSocket."""
    ws = _mock_ws([])
    mock_connect.return_value = ws

    stt = STTService(on_transcript=AsyncMock())
    await stt.start()

    fake_audio = b"\x00\x01" * 50
    await stt.send_audio(fake_audio)

    ws.send.assert_called_once_with(fake_audio)
    await stt.stop()


async def test_send_audio_does_nothing_when_disconnected():
    """send_audio should silently do nothing if not connected."""
    stt = STTService(on_transcript=AsyncMock())
    await stt.send_audio(b"\x00\x01")  # should not raise


@patch("app.services.stt.websockets.connect", new_callable=AsyncMock)
async def test_stop_closes_websocket(mock_connect):
    """stop() should close the WebSocket and reset state."""
    ws = _mock_ws([])
    mock_connect.return_value = ws

    stt = STTService(on_transcript=AsyncMock())
    await stt.start()
    await stt.stop()

    assert stt.is_connected is False
    assert stt.ws is None
    ws.send.assert_called_with(b"")
    ws.close.assert_called_once()
