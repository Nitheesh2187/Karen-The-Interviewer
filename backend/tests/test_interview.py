"""
Integration tests for InterviewSession.

This is the orchestrator — it wires STT, LLM, and TTS together.
We mock all three services and the WebSocket to test the orchestration logic:
- start() generates opening question via LLM + TTS
- _on_transcript() accumulates text and manages the debounce timer
- _process_answer() sends accumulated text to LLM, then TTS
- end() generates feedback
"""

import json
import asyncio
from unittest.mock import patch, AsyncMock, MagicMock, call

import pytest

from app.models.schemas import InterviewSetup
from app.services.interview import InterviewSession


def _make_session(mock_ws=None, mock_llm=None, mock_tts=None):
    """Helper to create an InterviewSession with mocked dependencies."""
    setup = InterviewSetup(
        job_description="Build REST APIs",
        resume="3 years Python experience",
        role="Backend Developer",
        experience_level="mid",
    )

    if mock_ws is None:
        mock_ws = AsyncMock()

    session = InterviewSession(setup, mock_ws)

    # Replace real services with mocks
    if mock_llm is not None:
        session.llm = mock_llm
    else:
        session.llm = AsyncMock()
        session.llm.generate_response = AsyncMock(return_value="What is Python?")
        session.llm.generate_feedback = AsyncMock(return_value='{"overall_score": 8}')
        session.llm.get_history = MagicMock(return_value=[])

    if mock_tts is not None:
        session.tts = mock_tts
    else:
        session.tts = AsyncMock()
        session.tts.synthesize = AsyncMock(return_value=b"\x00\x01" * 50)

    return session


# --- start() tests ---

async def test_start_sends_status_and_opening_question():
    """start() should send a status message, then the opening question + audio."""
    mock_ws = AsyncMock()
    session = _make_session(mock_ws=mock_ws)

    await session.start()

    # Should have sent 3 things: status, agent_response, audio bytes
    calls = mock_ws.send_json.call_args_list
    assert calls[0] == call({"type": "status", "message": "Interview starting..."})
    assert calls[1][0][0]["type"] == "agent_response"
    assert calls[1][0][0]["question_number"] == 1
    mock_ws.send_bytes.assert_called_once()


async def test_start_sets_question_count_to_1():
    """After start(), question_count should be 1."""
    session = _make_session()
    await session.start()
    assert session.question_count == 1


# --- _on_transcript() tests ---

async def test_on_transcript_sends_to_frontend():
    """Every transcript (interim or final) should be forwarded to the frontend."""
    mock_ws = AsyncMock()
    session = _make_session(mock_ws=mock_ws)

    await session._on_transcript("hello", False)

    mock_ws.send_json.assert_called_with({
        "type": "transcript",
        "text": "hello",
        "is_final": False,
    })


async def test_on_transcript_accumulates_final_text():
    """Final transcripts should be accumulated in _current_transcript."""
    session = _make_session()

    await session._on_transcript("I know Python", True)
    await session._on_transcript("and Java", True)

    assert "I know Python" in session._current_transcript
    assert "and Java" in session._current_transcript


async def test_on_transcript_ignores_interim_for_accumulation():
    """Interim transcripts should NOT be accumulated."""
    session = _make_session()

    await session._on_transcript("I know Pyth", False)  # interim

    assert session._current_transcript == ""


async def test_on_transcript_resets_timer_on_interim():
    """Interim transcripts should reset the debounce timer (user still speaking)."""
    session = _make_session()

    # First, send a final to start the timer
    await session._on_transcript("hello", True)
    assert hasattr(session, "_answer_timer")
    first_timer = session._answer_timer

    # Send an interim — timer should be reset (new timer object)
    await session._on_transcript("still talking", False)
    assert session._answer_timer is not first_timer


# --- _process_answer() tests ---

async def test_process_answer_sends_next_question():
    """_process_answer should send the LLM response + TTS audio to frontend."""
    mock_ws = AsyncMock()
    mock_llm = AsyncMock()
    mock_llm.generate_response = AsyncMock(return_value="Tell me about Java")
    mock_tts = AsyncMock()
    mock_tts.synthesize = AsyncMock(return_value=b"\x00" * 100)

    session = _make_session(mock_ws=mock_ws, mock_llm=mock_llm, mock_tts=mock_tts)
    session.question_count = 1
    session._current_transcript = "I know Python well"

    await session._process_answer()

    # LLM called with the accumulated transcript
    mock_llm.generate_response.assert_called_once_with("I know Python well")

    # TTS called with LLM's response
    mock_tts.synthesize.assert_called_once_with("Tell me about Java")

    # Frontend received agent_response + audio
    json_calls = mock_ws.send_json.call_args_list
    agent_response = next(c for c in json_calls if c[0][0].get("type") == "agent_response")
    assert agent_response[0][0]["text"] == "Tell me about Java"
    assert agent_response[0][0]["question_number"] == 2
    mock_ws.send_bytes.assert_called_once()


async def test_process_answer_increments_question_count():
    """Each processed answer should increment the question counter."""
    session = _make_session()
    session.question_count = 3
    session._current_transcript = "some answer"

    await session._process_answer()

    assert session.question_count == 4


async def test_process_answer_clears_transcript():
    """After processing, _current_transcript should be empty."""
    session = _make_session()
    session._current_transcript = "some answer"

    await session._process_answer()

    assert session._current_transcript == ""


async def test_process_answer_skips_when_already_processing():
    """Should not process if already processing (prevents double triggers)."""
    mock_llm = AsyncMock()
    mock_llm.generate_response = AsyncMock(return_value="Q")
    session = _make_session(mock_llm=mock_llm)
    session._current_transcript = "answer"
    session._processing = True

    await session._process_answer()

    mock_llm.generate_response.assert_not_called()


async def test_process_answer_skips_when_transcript_empty():
    """Should not process if transcript is empty."""
    mock_llm = AsyncMock()
    mock_llm.generate_response = AsyncMock(return_value="Q")
    session = _make_session(mock_llm=mock_llm)
    session._current_transcript = "   "  # whitespace only

    await session._process_answer()

    mock_llm.generate_response.assert_not_called()


# --- end() tests ---

async def test_end_sends_feedback():
    """end() should generate feedback and send it to frontend."""
    mock_ws = AsyncMock()
    mock_llm = AsyncMock()
    mock_llm.generate_feedback = AsyncMock(return_value=json.dumps({
        "overall_score": 8,
        "overall_assessment": "Good",
        "strengths": ["Python"],
        "improvements": ["System design"],
        "question_feedback": [],
    }))

    session = _make_session(mock_ws=mock_ws, mock_llm=mock_llm)

    await session.end()

    # Should have sent status + feedback
    json_calls = mock_ws.send_json.call_args_list
    status_call = json_calls[0][0][0]
    assert status_call == {"type": "status", "message": "Generating feedback..."}

    feedback_call = json_calls[1][0][0]
    assert feedback_call["type"] == "feedback"
    assert feedback_call["data"]["overall_score"] == 8


async def test_end_strips_markdown_fencing():
    """end() should handle LLM wrapping JSON in ```markdown``` fences."""
    mock_ws = AsyncMock()
    mock_llm = AsyncMock()
    mock_llm.generate_feedback = AsyncMock(return_value='```json\n{"overall_score": 7}\n```')

    session = _make_session(mock_ws=mock_ws, mock_llm=mock_llm)

    await session.end()

    feedback_call = mock_ws.send_json.call_args_list[1][0][0]
    assert feedback_call["data"]["overall_score"] == 7


async def test_end_handles_invalid_json_gracefully():
    """If LLM returns invalid JSON, should send fallback feedback."""
    mock_ws = AsyncMock()
    mock_llm = AsyncMock()
    mock_llm.generate_feedback = AsyncMock(return_value="This is not JSON at all")

    session = _make_session(mock_ws=mock_ws, mock_llm=mock_llm)

    await session.end()

    feedback_call = mock_ws.send_json.call_args_list[1][0][0]
    assert feedback_call["type"] == "feedback"
    assert feedback_call["data"]["overall_score"] == 0
    assert "Unable to generate" in feedback_call["data"]["overall_assessment"]


# --- cleanup() tests ---

async def test_cleanup_stops_stt():
    """cleanup() should stop the STT service if it exists."""
    mock_stt = AsyncMock()
    session = _make_session()
    session.stt = mock_stt

    await session.cleanup()

    mock_stt.stop.assert_called_once()


async def test_cleanup_handles_no_stt():
    """cleanup() should not crash if STT was never started."""
    session = _make_session()
    session.stt = None

    await session.cleanup()  # should not raise
