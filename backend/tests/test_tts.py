"""
Unit tests for TTSService.

We mock aiohttp so we don't hit Deepgram's real API.

Mocking aiohttp is tricky because it uses nested context managers:
    async with ClientSession() as session:        # outer
        async with session.post(...) as resp:     # inner

We use MagicMock for the outer (sync __init__) and configure
the inner post() to return an async context manager.
"""

from unittest.mock import patch, AsyncMock, MagicMock

from app.services.tts import TTSService


def _build_mock_session(response_mock):
    """Build a mock aiohttp.ClientSession with nested context managers."""
    # Inner: async with session.post(...) as resp
    mock_post_ctx = AsyncMock()
    mock_post_ctx.__aenter__.return_value = response_mock
    mock_post_ctx.__aexit__.return_value = False

    # Outer: async with ClientSession() as session
    mock_session = MagicMock()
    mock_session.post.return_value = mock_post_ctx

    mock_session_ctx = MagicMock()
    mock_session_ctx.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session_ctx.__aexit__ = AsyncMock(return_value=False)

    return mock_session_ctx


@patch("app.services.tts.aiohttp.ClientSession")
async def test_synthesize_returns_audio_bytes(mock_session_class):
    """TTS should return raw bytes from Deepgram's response."""
    # ARRANGE
    fake_audio = b"\x00\x01" * 100

    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.read.return_value = fake_audio

    mock_session_class.return_value = _build_mock_session(mock_response)

    tts = TTSService()

    # ACT
    result = await tts.synthesize("Hello world")

    # ASSERT
    assert result == fake_audio
    assert isinstance(result, bytes)


@patch("app.services.tts.aiohttp.ClientSession")
async def test_synthesize_raises_on_api_error(mock_session_class):
    """TTS should raise RuntimeError if Deepgram returns non-200."""
    # ARRANGE
    mock_response = AsyncMock()
    mock_response.status = 401
    mock_response.text.return_value = "Unauthorized"

    mock_session_class.return_value = _build_mock_session(mock_response)

    tts = TTSService()

    # ACT + ASSERT
    import pytest
    with pytest.raises(RuntimeError, match="TTS request failed: 401"):
        await tts.synthesize("Hello")
