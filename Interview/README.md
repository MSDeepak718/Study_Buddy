# AI Interview Preparation Platform

> RAG-powered AI Interview System with Gemini, ChromaDB, and PostgreSQL

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (for PostgreSQL)

### 1. Start PostgreSQL

```bash
docker compose up -d
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Linux/macOS
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 4. Open App
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

## Architecture

```
Interview/
├── backend/          # FastAPI + SQLAlchemy + ChromaDB
│   ├── app/
│   │   ├── api/      # Route handlers
│   │   ├── models/   # SQLAlchemy ORM
│   │   ├── schemas/  # Pydantic validation
│   │   ├── services/ # Business logic
│   │   └── utils/    # Parsing, chunking, prompts
│   └── requirements.txt
├── frontend/         # React + TypeScript + Tailwind
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── types/
└── docker-compose.yml
```

## Key Features (Phase 1)
- Admin document upload (PDF/DOCX/TXT)
- RAG pipeline with ChromaDB vector search
- Gemini-powered question generation
- Real-time answer evaluation
- Analytics dashboard with charts
- AI-generated recommendations
