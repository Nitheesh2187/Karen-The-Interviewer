"""
Unit tests for prompt generation.

No mocking needed — these are pure functions that return strings.
"""

from app.prompts.interviewer import get_system_prompt
from app.prompts.feedback import get_feedback_prompt


def test_interviewer_prompt_includes_context():
    """System prompt should include the job details and resume."""
    prompt = get_system_prompt(
        job_description="Build REST APIs",
        resume="3 years Python experience",
        role="Backend Developer",
        experience_level="mid",
    )

    assert "Backend Developer" in prompt
    assert "Build REST APIs" in prompt
    assert "3 years Python experience" in prompt
    assert "mid" in prompt


def test_interviewer_prompt_has_verbal_only_instruction():
    """Prompt should instruct no code-writing questions."""
    prompt = get_system_prompt(
        job_description="any",
        resume="any",
        role="any",
        experience_level="any",
    )

    assert "VERBAL-ONLY" in prompt


def test_feedback_prompt_includes_role():
    """Feedback prompt should include the job role."""
    prompt = get_feedback_prompt(
        job_description="Build APIs",
        role="Backend Developer",
        experience_level="senior",
    )

    assert "Backend Developer" in prompt
