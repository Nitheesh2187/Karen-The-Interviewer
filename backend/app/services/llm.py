import asyncio
import logging

from groq import Groq

from app.config import settings
from app.models.schemas import Message, InterviewFeedback

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.groq_api_key)


def _make_strict_schema(pydantic_model) -> dict:
    """Convert a Pydantic model schema to a Groq strict-compatible schema.

    Groq strict mode requires `additionalProperties: false` on every object.
    Pydantic doesn't add this by default, so we patch it in recursively.
    """
    schema = pydantic_model.model_json_schema()

    def _patch(obj):
        if isinstance(obj, dict):
            if obj.get("type") == "object" or "properties" in obj:
                obj["additionalProperties"] = False
            for v in obj.values():
                _patch(v)
        elif isinstance(obj, list):
            for item in obj:
                _patch(item)

    _patch(schema)
    return schema


class LLMService:
    def __init__(self, system_prompt: str):
        self.system_prompt = system_prompt
        self.history: list[Message] = []

    async def generate_response(self, user_message: str) -> str:
        self.history.append(Message(role="user", content=user_message))

        messages = [{"role": "system", "content": self.system_prompt}]
        for msg in self.history:
            messages.append({"role": msg.role, "content": msg.content})

        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=messages,
        )

        assistant_text = response.choices[0].message.content.strip()
        self.history.append(Message(role="assistant", content=assistant_text))

        return assistant_text

    async def generate_feedback(self, feedback_prompt: str) -> str:
        """Generate feedback using full conversation history.

        Uses openai/gpt-oss-120b with strict json_schema enforcement
        so the output is guaranteed to match InterviewFeedback schema.
        """
        conversation_text = "\n".join(
            f"{'Interviewer' if m.role == 'assistant' else 'Candidate'}: {m.content}"
            for m in self.history
        )

        prompt = f"{feedback_prompt}\n\n## Interview Transcript\n{conversation_text}"

        messages = [
            {"role": "system", "content": "You are an interview evaluator. Respond with JSON."},
            {"role": "user", "content": prompt},
        ]

        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="openai/gpt-oss-120b",
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "interview_feedback",
                    "strict": True,
                    "schema": _make_strict_schema(InterviewFeedback),
                },
            },
        )

        return response.choices[0].message.content.strip()

    def get_history(self) -> list[Message]:
        return self.history.copy()
