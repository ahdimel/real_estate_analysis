import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import create_tables
from backend.routes import auth, properties, analysis, market, scraper

create_tables()

app = FastAPI(title="REI API", version="0.1.0")
app.include_router(auth.router)
app.include_router(properties.router)
app.include_router(analysis.router)
app.include_router(market.router)
app.include_router(scraper.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "REI API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}
