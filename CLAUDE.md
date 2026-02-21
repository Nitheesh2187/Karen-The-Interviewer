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

Both must run simultaneously. The Vite dev server proxies `/ws/*`, `/api/*`, and `/health` to `localhost:8000`, so frontend code uses relative paths (e.g. `/ws/interview`, `/api/extract-pdf`).

## Environment

Requires a `.env` file at the project root with:
- `DEEPGRAM_API_KEY` — used for both STT (streaming WebSocket) and TTS (Aura REST API)
- `GROQ_API_KEY` — used for Groq LLM (Llama 3.3 70B Versatile)

The backend `config.py` loads `.env` from both `backend/.env` and the project root.

## Architecture

Real-time voice interview agent. User speaks → STT transcribes → LLM generates interviewer response → TTS converts to speech → browser plays it back.

### Data Flow (one Q&A cycle)
```
Browser mic (PCM16 16kHz) → WebSocket → FastAPI → Deepgram STT WebSocket
                                                      ↓
                                              transcript text
                                                      ↓
                                              Groq LLM (Llama 3.3 70B)
                                                      ↓
                                              response text
                                                      ↓
                                              Deepgram Aura TTS (REST)
                                                      ↓
Browser audio playback ← WebSocket ← PCM16 24kHz audio bytes
```

### Backend (`backend/app/`)

- **`main.py`** — FastAPI app. WebSocket `/ws/interview` (JSON control + binary audio), POST `/api/extract-pdf` (resume PDF text extraction via `pypdf`), GET `/health`.
- **`services/interview.py`** — `InterviewSession` orchestrator. Connects STT→LLM→TTS pipeline. Uses a **5-second debounce timer** to accumulate final transcript segments into a complete answer before triggering LLM.
- **`services/stt.py`** — Raw WebSocket to Deepgram Nova-2 (not SDK). Streams PCM16 audio, receives JSON transcripts with `is_final` flags. Lazy-connected on first audio chunk.
- **`services/llm.py`** — Groq SDK (`llama-3.3-70b-versatile`). Maintains chat history. `generate_response()` for Q&A, `generate_feedback()` for post-interview structured JSON analysis.
- **`services/tts.py`** — Deepgram Aura TTS (`aura-asteria-en`) via `aiohttp` REST. Returns raw PCM16 at 24kHz.
- **`prompts/`** — `interviewer.py` sets interviewer persona with JD/resume context. `feedback.py` instructs LLM to return structured JSON scores.

### Frontend (`frontend/src/`)

Five-screen flow via React Router: Landing → Setup → Preparing → Interview → Feedback.

- **`app/pages/`** — `landing.tsx` (hero + typing animation), `setup.tsx` (3-step form: JD/resume/confirm), `preparing.tsx` (loading transition), `interview.tsx` (main interview UI + WAV header creation + audio queue), `feedback.tsx` (scores + breakdown).
- **`app/hooks/useWebSocket.ts`** — WebSocket lifecycle. Sends JSON (control messages) and binary (audio). Receives JSON (transcripts, responses, feedback) and binary (TTS audio).
- **`app/hooks/useAudioRecorder.ts`** — Mic capture via AudioContext + ScriptProcessor. Downsamples from native rate → 16kHz, converts Float32 → Int16 (PCM16). Does NOT use MediaRecorder (needs raw PCM for Deepgram).
- **`app/context/interview-context.tsx`** — React Context for global state (interview setup data, feedback data). Wraps all routes via `pages/root.tsx`.
- **`app/components/ui/`** — shadcn/ui component library (Radix UI + Tailwind). Pre-built accessible components.
- **Styling** — Tailwind CSS v4 (`@tailwindcss/vite` plugin), theme tokens in `styles/theme.css` (oklch colors, light/dark mode via `next-themes`).

### WebSocket Message Protocol

**Client → Server:**
- `{ type: "setup", role, experience_level, job_description, resume }` — start interview
- `{ type: "end_interview" }` — end and request feedback
- Binary frames — raw PCM16 16kHz audio chunks

**Server → Client:**
- `{ type: "status", message }` — status updates ("Thinking...", etc.)
- `{ type: "transcript", text, is_final }` — STT results
- `{ type: "agent_response", text, question_number }` — interviewer question
- `{ type: "feedback", data }` — structured feedback JSON
- `{ type: "error", message }` — error messages
- Binary frames — raw PCM16 24kHz TTS audio

### Key Design Decisions

- **No Deepgram SDK** — v5 API changed drastically; raw WebSocket (`websockets` lib) for STT, `aiohttp` for TTS REST.
- **PCM16 everywhere** — 16kHz mono for STT input, 24kHz mono for TTS output. Frontend manually constructs WAV headers (RIFF) for browser playback.
- **Groq for LLM** — Uses synchronous Groq client wrapped in `asyncio.to_thread()` for async compatibility.
- **Lazy STT connection** — STT WebSocket connects on first audio chunk, not at session start.
- **Audio queue** — Frontend queues TTS audio chunks and plays them sequentially to prevent overlapping playback.
