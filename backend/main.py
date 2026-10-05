from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import PROJECT_CONFIG

app = FastAPI(
    title=PROJECT_CONFIG["name"],
    version=PROJECT_CONFIG["version"],
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "message": f"{PROJECT_CONFIG['name']} backend is running",
        "status": "ok",
        "version": PROJECT_CONFIG["version"],
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
    }