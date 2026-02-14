import io
import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader

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


@app.post("/api/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    contents = await file.read()
    try:
        reader = PdfReader(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read PDF file")

    text = ""
    for page in reader.pages:
        page_text = page.extract_text()
        if page_text:
            text += page_text + "\n"

    text = text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="No text could be extracted from this PDF")

    return {"text": text, "pages": len(reader.pages)}


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
