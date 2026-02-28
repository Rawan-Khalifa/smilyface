# PitchMind

## Structure

```
├── frontend/     ← Next.js app (npm run dev from here)
└── backend/      ← FastAPI (uvicorn main:app from backend/)
```

## Run

**Frontend**
```bash
cd frontend && npm install && npm run dev
```

**Backend**
```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
```
