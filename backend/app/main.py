import json
import asyncio
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import InterviewSetup
from app.services.interview import InterviewSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Interview Voice Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws/interview")
async def interview_websocket(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket connected")

    session: InterviewSession | None = None

    try:
        while True:
            message = await websocket.receive()

            if "text" in message:
                data = json.loads(message["text"])
                msg_type = data.get("type")

                if msg_type == "setup":
                    setup = InterviewSetup(
                        job_description=data["job_description"],
                        resume=data["resume"],
                        role=data["role"],
                        experience_level=data["experience_level"],
                    )
                    session = InterviewSession(setup, websocket)
                    await session.start()

                elif msg_type == "end_interview":
                    if session:
                        await session.end()
                    break

            elif "bytes" in message:
                # Binary audio data from mic
                if session:
                    await session.handle_audio(message["bytes"])

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except RuntimeError as e:
        # Starlette raises RuntimeError (not WebSocketDisconnect) if
        # receive() is called after a disconnect message was already
        # delivered.  This is normal — the client closed the connection
        # while we were still in the receive loop.
        if "disconnect" in str(e).lower():
            logger.info("WebSocket already disconnected")
        else:
            logger.error(f"WebSocket runtime error: {e}", exc_info=True)
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        if session:
            await session.cleanup()
        logger.info("Session cleaned up")
