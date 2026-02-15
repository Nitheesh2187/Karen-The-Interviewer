import json
import asyncio
import logging

from fastapi import WebSocket

from app.models.schemas import InterviewSetup
from app.services.stt import STTService
from app.services.llm import LLMService
from app.services.tts import TTSService
from app.prompts.interviewer import get_system_prompt
from app.prompts.feedback import get_feedback_prompt

logger = logging.getLogger(__name__)


class InterviewSession:
    def __init__(self, setup: InterviewSetup, websocket: WebSocket):
        self.setup = setup
        self.websocket = websocket
        self.question_count = 0
        self._processing = False
        self._current_transcript = ""

        system_prompt = get_system_prompt(
            setup.job_description,
            setup.resume,
            setup.role,
            setup.experience_level,
        )
        self.llm = LLMService(system_prompt)
        self.tts = TTSService()
        self.stt: STTService | None = None

    async def _send_json(self, data: dict):
        """Send JSON, silently ignoring if the WebSocket is already closed."""
        try:
            await self.websocket.send_json(data)
        except Exception:
            pass

    async def _send_bytes(self, data: bytes):
        """Send bytes, silently ignoring if the WebSocket is already closed."""
        try:
            await self.websocket.send_bytes(data)
        except Exception:
            pass

    async def _ensure_stt(self):
        """Start or reconnect STT if needed. Called when audio actually arrives."""
        if self.stt is None:
            self.stt = STTService(on_transcript=self._on_transcript)
        if not self.stt.is_connected:
            await self.stt.start()

    async def start(self):
        """Initialize the interview session and ask the first question."""
        # STT is started lazily in handle_audio() — no need to connect now
        await self._send_json({
            "type": "status",
            "message": "Interview starting...",
        })

        # Generate and speak the opening question
        opening = await self.llm.generate_response(
            "Begin the interview. Introduce yourself briefly and ask your first question."
        )
        self.question_count = 1

        await self._send_json({
            "type": "agent_response",
            "text": opening,
            "question_number": self.question_count,
        })

        # Generate TTS for the opening
        audio = await self.tts.synthesize(opening)
        await self._send_bytes(audio)

    async def handle_audio(self, audio_bytes: bytes):
        """Forward audio from frontend to STT."""
        await self._ensure_stt()
        await self.stt.send_audio(audio_bytes)

    async def _on_transcript(self, transcript: str, is_final: bool):
        """Callback from STT service when transcript is received."""
        await self._send_json({
            "type": "transcript",
            "text": transcript,
            "is_final": is_final,
        })

        if is_final and transcript.strip():
            self._current_transcript += " " + transcript.strip()

            # Use a small delay to accumulate final segments into a complete answer
            if hasattr(self, "_answer_timer"):
                self._answer_timer.cancel()

            self._answer_timer = asyncio.get_event_loop().call_later(
                5.0, lambda: asyncio.ensure_future(self._process_answer())
            )

    async def _process_answer(self):
        """Process the accumulated answer and generate next question."""
        if self._processing or not self._current_transcript.strip():
            return

        self._processing = True
        answer = self._current_transcript.strip()
        self._current_transcript = ""

        try:
            await self._send_json({
                "type": "status",
                "message": "Thinking...",
            })

            # Generate next question
            response = await self.llm.generate_response(answer)
            self.question_count += 1

            await self._send_json({
                "type": "agent_response",
                "text": response,
                "question_number": self.question_count,
            })

            # Generate and send TTS
            audio = await self.tts.synthesize(response)
            await self._send_bytes(audio)

        except Exception as e:
            logger.error(f"Error processing answer: {e}", exc_info=True)
            await self._send_json({
                "type": "error",
                "message": f"Error generating response: {str(e)}",
            })
        finally:
            self._processing = False

    async def end(self):
        """End the interview and generate feedback."""
        await self._send_json({
            "type": "status",
            "message": "Generating feedback...",
        })

        try:
            feedback_prompt = get_feedback_prompt(
                self.setup.job_description,
                self.setup.role,
                self.setup.experience_level,
            )
            feedback_text = await self.llm.generate_feedback(feedback_prompt)

            # Clean up markdown fencing if present
            if feedback_text.startswith("```"):
                lines = feedback_text.split("\n")
                lines = lines[1:]  # remove opening fence
                if lines and lines[-1].strip() == "```":
                    lines = lines[:-1]
                feedback_text = "\n".join(lines)

            feedback_data = json.loads(feedback_text)

            await self._send_json({
                "type": "feedback",
                "data": feedback_data,
            })

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse feedback JSON: {e}")
            logger.error(f"Raw feedback: {feedback_text}")
            await self._send_json({
                "type": "feedback",
                "data": {
                    "overall_score": 0,
                    "overall_assessment": "Unable to generate structured feedback. Please try again.",
                    "strengths": [],
                    "improvements": [],
                    "question_feedback": [],
                },
            })
        except Exception as e:
            logger.error(f"Error generating feedback: {e}", exc_info=True)
            await self._send_json({
                "type": "error",
                "message": f"Error generating feedback: {str(e)}",
            })

    async def cleanup(self):
        """Clean up resources."""
        if self.stt:
            await self.stt.stop()
