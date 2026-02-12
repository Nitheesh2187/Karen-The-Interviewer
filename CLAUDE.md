# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

**Backend** (FastAPI, runs on port 8000):
```bash
cd backend && pip install -r requirements.txt && python3 -m uvicorn app.main:app --port 8000 --reload
```

**Frontend** (React + Vite, runs on port 5173):
```bash
cd frontend && npm install && npm run dev
```

The Vite dev server proxies `/ws/*` and `/health` to `localhost:8000`, so frontend code uses relative paths (e.g. `/ws/interview`).

**Lint frontend:** `cd frontend && npm run lint`

## Environment

Requires a `.env` file at the project root with:
- `DEEPGRAM_API_KEY` — used for both STT (streaming WebSocket) and TTS (Aura REST API)
- `GOOGLE_API_KEY` — used for Gemini 2.0 Flash LLM

The backend `config.py` loads `.env` from both `backend/.env` and the project root.

## Architecture

This is a real-time voice interview agent. The user speaks into their mic, the agent transcribes, generates an interviewer response via LLM, converts it to speech, and plays it back.

### Data Flow (one Q&A cycle)
```
Browser mic (PCM16 16kHz) → WebSocket → FastAPI → Deepgram STT WebSocket
                                                      ↓
                                              transcript text
                                                      ↓
                                              Gemini 2.0 Flash (LLM)
                                                      ↓
                                              response text
                                                      ↓
                                              Deepgram Aura TTS (REST)
                                                      ↓
Browser audio playback ← WebSocket ← PCM16 24kHz audio bytes
```

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app with a single WebSocket endpoint `/ws/interview`. Handles `setup`, `end_interview` (JSON), and audio chunks (binary).
- **`services/interview.py`** — `InterviewSession` orchestrator. Connects STT→LLM→TTS pipeline. Uses a 2-second debounce timer to accumulate final transcript segments into a complete answer before triggering LLM.
- **`services/stt.py`** — Raw WebSocket connection to Deepgram (not using SDK). Streams PCM16 audio, receives JSON transcripts with `is_final` flags.
- **`services/llm.py`** — Google `generativeai` SDK. Maintains chat history. `generate_response()` for interview Q&A, `generate_feedback()` for post-interview analysis.
- **`services/tts.py`** — Deepgram Aura TTS via `aiohttp` REST call. Returns raw PCM16 audio at 24kHz.
- **`prompts/`** — System prompt templates. `interviewer.py` sets up the interviewer persona with JD/resume context. `feedback.py` instructs the LLM to return structured JSON scores.

### Frontend (`frontend/src/`)

Three-screen flow managed by `App.jsx`: Setup → Interview → Feedback.

- **`hooks/useWebSocket.js`** — WebSocket lifecycle. Sends JSON (control messages) and binary (audio). Receives JSON (transcripts, responses) and binary (TTS audio).
- **`hooks/useAudioRecorder.js`** — Mic capture via AudioContext + ScriptProcessor. Converts Float32 → Int16 (PCM16) at 16kHz. Does NOT use MediaRecorder (needs raw PCM for Deepgram).
- **`components/InterviewRoom.jsx`** — Main interview screen. Creates WAV headers manually to wrap raw PCM16 from TTS for browser playback. Uses an audio queue for sequential playback.

### Key Design Decisions

- **No Deepgram SDK** — v5 API changed drastically; raw WebSocket (`websockets` lib) is used for STT and `aiohttp` for TTS REST.
- **PCM16 everywhere** — 16kHz mono for STT input, 24kHz mono for TTS output. Frontend manually constructs WAV headers for playback.
- **No extra frontend dependencies** — WebSocket, MediaRecorder, AudioContext are all browser-native APIs.
- **`_send_json`/`_send_bytes` in `interview.py` have a recursion bug** — they call themselves instead of `self.websocket.send_json`/`self.websocket.send_bytes`. This needs fixing.
