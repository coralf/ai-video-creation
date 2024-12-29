from fastapi import FastAPI
from src.controllers.whisper_controller import router as whisper_router
from fastapi.middleware.cors import CORSMiddleware  # 导入 CORS 中间件
from src.controllers.chat_tts_controller import (
    router as chat_tts_router,
    lifespan as chat_tts_lifespan,
)
from src.controllers.text_to_image_controller import (
    router as text_to_image_router,
    lifespan as text_to_image_lifespan,
)

from src.controllers.project_controller import (
    router as project_router,
    lifespan as project_lifespan,
)
from contextlib import asynccontextmanager


@asynccontextmanager
async def combined_lifespan(*args, **kwargs):
    # async with project_lifespan(*args, **kwargs):
    #     yield
    async with project_lifespan(app), chat_tts_lifespan(app), text_to_image_lifespan(
        app
    ):
        yield


app = FastAPI(lifespan=combined_lifespan)

# 添加 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=False,
    allow_methods=["*"],  # 允许所有 HTTP 方法
    allow_headers=["*"],  # 允许所有头部
)

app.include_router(project_router)
app.include_router(whisper_router)
app.include_router(chat_tts_router)
app.include_router(text_to_image_router)
