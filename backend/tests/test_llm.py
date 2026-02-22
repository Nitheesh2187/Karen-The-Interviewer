"""
Unit tests for LLMService.

We mock the Groq API so tests don't need a real API key or network.
This tests our logic, not Groq's servers.
"""

from unittest.mock import patch, MagicMock

from app.services.llm import LLMService


def _mock_groq_response(text: str):
    """Helper to create a fake Groq API response."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = text
    return mock_response


@patch("app.services.llm.client")  # replace the real Groq client with a mock
async def test_generate_response_returns_text(mock_client):
    """LLM should return the text from Groq's response."""
    # ARRANGE
    mock_client.chat.completions.create.return_value = _mock_groq_response(
        "Tell me about your experience with Python."
    )
    llm = LLMService(system_prompt="You are an interviewer.")

    # ACT
    result = await llm.generate_response("Hello, I'm ready for the interview.")

    # ASSERT
    assert result == "Tell me about your experience with Python."


@patch("app.services.llm.client")
async def test_generate_response_maintains_history(mock_client):
    """Each call should add user + assistant messages to history."""
    # ARRANGE
    mock_client.chat.completions.create.return_value = _mock_groq_response("Question 1")
    llm = LLMService(system_prompt="You are an interviewer.")

    # ACT
    await llm.generate_response("Answer 1")

    # ASSERT
    history = llm.get_history()
    assert len(history) == 2  # user message + assistant response
    assert history[0].role == "user"
    assert history[0].content == "Answer 1"
    assert history[1].role == "assistant"
    assert history[1].content == "Question 1"


@patch("app.services.llm.client")
async def test_history_accumulates_across_calls(mock_client):
    """Multiple Q&A rounds should all be in history."""
    # ARRANGE
    llm = LLMService(system_prompt="You are an interviewer.")

    mock_client.chat.completions.create.return_value = _mock_groq_response("Q1")
    await llm.generate_response("A0")  # opening

    mock_client.chat.completions.create.return_value = _mock_groq_response("Q2")
    await llm.generate_response("A1")  # second round

    # ASSERT — should have 4 messages: user/assistant pairs
    assert len(llm.get_history()) == 4


@patch("app.services.llm.client")
async def test_generate_feedback_uses_separate_conversation(mock_client):
    """Feedback should NOT add to the interview history."""
    # ARRANGE
    mock_client.chat.completions.create.return_value = _mock_groq_response("Q1")
    llm = LLMService(system_prompt="You are an interviewer.")
    await llm.generate_response("A1")
    history_before = len(llm.get_history())

    # ACT
    mock_client.chat.completions.create.return_value = _mock_groq_response('{"score": 8}')
    await llm.generate_feedback("Evaluate this interview")

    # ASSERT — history unchanged (feedback is a separate call)
    assert len(llm.get_history()) == history_before
