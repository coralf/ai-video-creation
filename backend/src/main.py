from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.controllers.workspace_controller import router as workspace_router
from contextlib import asynccontextmanager


@asynccontextmanager
async def combined_lifespan(*args, **kwargs):
    yield


app = FastAPI(lifespan=combined_lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspace_router)
