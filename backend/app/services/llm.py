import asyncio
import logging

from groq import Groq

from app.config import settings
from app.models.schemas import Message

logger = logging.getLogger(__name__)

client = Groq(api_key=settings.groq_api_key)


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
        """Generate feedback using full conversation history."""
        conversation_text = "\n".join(
            f"{'Interviewer' if m.role == 'assistant' else 'Candidate'}: {m.content}"
            for m in self.history
        )

        prompt = f"{feedback_prompt}\n\n## Interview Transcript\n{conversation_text}"

        messages = [
            {"role": "system", "content": "You are an interview evaluator."},
            {"role": "user", "content": prompt},
        ]

        response = await asyncio.to_thread(
            client.chat.completions.create,
            model="llama-3.3-70b-versatile",
            messages=messages,
        )

        return response.choices[0].message.content.strip()

    def get_history(self) -> list[Message]:
        return self.history.copy()
