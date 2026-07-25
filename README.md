# CyberRakshak AI v2 — Full-Stack Build

A real, running full-stack application: **FastAPI + MongoDB backend**, **React + TypeScript + Tailwind frontend**, JWT auth, an **Ollama-powered multilingual assistant**, and **AI image/video content analyzers**.

This is genuinely functional, not a mockup — verified in this delivery:
- Backend imports cleanly and registers **40 real API routes** (`uvicorn app.main:app`)
- All detection engines were smoke-tested with real inputs and returned correct, sensible risk scores
- Frontend **type-checks with zero errors** (`tsc -b`) and **builds successfully** (`vite build`)

## What's real vs. what's a labeled placeholder

Being upfront about this matters more than pretending it's all done:

| Feature | Status |
|---|---|
| URL / Email / SMS / Password heuristic engines | **Real**, deterministic rule-based logic, ported identically to Python |
| JWT auth, MongoDB models, password hashing (bcrypt) | **Real** |
| Ollama streaming chat, system prompt, conversation history | **Real** integration (SSE streaming) — falls back to a labeled Demo Mode reply if Ollama isn't running |
| Multilingual chat | **Real** — Ollama replies in whatever language/mix the user writes in, since that's a native LLM capability; a manual language selector is also provided |
| Voice Assistant (STT/TTS) | **Real**, using the browser's built-in Web Speech API (`SpeechRecognition` / `speechSynthesis`) — works out of the box in Chrome/Edge with zero extra installs. Swap in a server-side Whisper/Coqui pipeline later if you need offline or non-Chromium support (see below) |
| Image EXIF/metadata extraction | **Real** (Pillow) |
| AI-generated image/video probability score | **Heuristic placeholder**, clearly marked `demo: true` in every response. There is no trained AI-image-detector model wired in — see "Swapping in a real detector" below |
| Video frame extraction | **Real** (OpenCV, intelligent sampling up to 8 frames) |
| Breach checker, QR decoding | **Demo Data**, clearly labeled — wiring a real breach API (e.g. HIBP) or QR library (`pyzbar`) is a small, isolated change (see service files) |
| File malware scanning | Real hashing/heuristics; real sandboxed detonation needs a third-party API (see `services/file_engine.py`) |

## Project structure

```
cyberrakshak-v2/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, middleware, router wiring
│   │   ├── config.py                # env-driven settings
│   │   ├── database.py              # Motor/MongoDB connection + collections
│   │   ├── auth/
│   │   │   ├── security.py          # bcrypt hashing, JWT issue/verify
│   │   │   └── dependencies.py      # get_current_user, require_admin
│   │   ├── models/                  # Pydantic request/response schemas
│   │   ├── routers/                 # auth, users, scan, chat, image/video analysis,
│   │   │                            # dashboard, admin, content (news/incidents)
│   │   ├── services/
│   │   │   ├── scan_engines.py      # URL/email/message/password/breach heuristics
│   │   │   ├── file_engine.py       # file hashing + QR demo
│   │   │   ├── ollama_service.py    # streaming chat, system prompt, fallback
│   │   │   ├── image_forensics.py   # EXIF analysis + AI-probability placeholder
│   │   │   └── video_forensics.py   # frame sampling + aggregation
│   │   ├── middleware/security.py   # rate limiting, security headers
│   │   └── utils/make_admin.py      # CLI to promote a user to admin
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/                   # Login, Register, Dashboard, Scanner, ToolPage,
    │   │                            # AIAssistant, AIImageAnalyzer, AIVideoAnalyzer,
    │   │                            # ScanHistory, SafetyScore, News, IncidentResponse,
    │   │                            # Profile, Admin
    │   ├── components/              # Sidebar, Layout, ProtectedRoute, RiskCard
    │   ├── context/AuthContext.tsx  # token storage + current-user state
    │   └── services/api.ts          # typed fetch client + SSE chat streaming
    ├── package.json
    └── .env.example
```

## Running it locally

### 1. Prerequisites
- Python 3.11+
- Node 18+
- MongoDB running locally (or a connection string to Atlas)
- [Ollama](https://ollama.com) installed, with a model pulled — e.g.:
  ```bash
  ollama pull llama3.1
  ollama serve
  ```
  If Ollama isn't running, the assistant still works — it replies with a clearly-labeled Demo Mode message instead of crashing.

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # edit JWT secrets before any real deployment
uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000/docs` for interactive Swagger docs of all 40 routes.

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:5173`. The Vite dev server proxies `/api/*` to `http://localhost:8000` (see `vite.config.ts`), so no CORS config is needed in development.

### 4. Create an account, then (optionally) make yourself admin
Register normally through the UI, then from `backend/`:
```bash
python -m app.utils.make_admin you@example.com
```
Log out and back in to pick up the new role and see the Admin Dashboard.

## Swapping in a real AI-image/deepfake detector

The architecture deliberately isolates this to one seam so it's a contained change:

- `app/services/image_forensics.py` → `run_ai_detection_model()`
- `app/services/video_forensics.py` → `run_deepfake_model()`

Replace the heuristic body with a call to a trained classifier (a fine-tuned CLIP/ResNet AI-image detector, or a hosted API like Hive/Sensity/Reality Defender). Everything downstream — the response schema, the UI meters, the history storage — already expects exactly this shape, so nothing else needs to change.

## Security notes
- Passwords are hashed with bcrypt and never logged or stored in plaintext, including in scan history (password-checker results store a masked `••••` target, not the real password).
- JWT access tokens are short-lived (30 min default); refresh tokens are longer-lived and used only to mint new access tokens.
- Rate limiting and security headers are wired via middleware; tighten `RATE_LIMIT_DEFAULT` per-route as needed for production.
- **Before any real deployment**: change `JWT_SECRET`/`JWT_REFRESH_SECRET` in `.env`, restrict `CORS_ALLOWED_ORIGINS` to your real frontend domain, and put the backend behind HTTPS (see the earlier deployment guidance for AWS Amplify / Azure Static Web Apps + a container host like AWS App Runner or Azure Container Apps for the FastAPI half).

## What's not wired yet (fill in for a true production launch)
- Email delivery for password-reset links (the token is generated and stored; SES/SendGrid integration is the one missing piece — see the `TODO` in `routers/auth.py`)
- Real breach-intelligence API (HaveIBeenPwned or similar) in place of `check_breach()`
- Real QR decoding (`pyzbar`/OpenCV `QRCodeDetector`) in place of `analyze_qr_demo()`
- A trained AI-image/deepfake model (see above)
- Gamification (badges/streaks) — the `achievements` collection exists in the schema but isn't populated by any route yet
