from typing import List

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..services.workspace_service import (
    ChatMessage,
    WorkspaceAssetResult,
    WorkspaceGenerationRequest,
    WorkspaceGenerationResponse,
    WorkspaceService,
    get_workspace_service,
)

router = APIRouter(prefix="/workspace", tags=["workspace"])


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    message: ChatMessage


class GenerateImageRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"


class GenerateAssetRequest(WorkspaceGenerationRequest):
    pass


@router.get("/config")
def get_config(workspace_service: WorkspaceService = Depends(get_workspace_service)):
    return workspace_service.get_config()


@router.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    message = await workspace_service.chat(request.messages)
    return ChatResponse(message=message)


@router.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    return StreamingResponse(
        workspace_service.stream_chat(request.messages),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@router.post("/images", response_model=WorkspaceAssetResult)
async def generate_image(
    request: GenerateImageRequest,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    return await workspace_service.generate_image(prompt=request.prompt, size=request.size)


@router.post("/generate", response_model=WorkspaceGenerationResponse)
async def generate_asset(
    request: GenerateAssetRequest,
    workspace_service: WorkspaceService = Depends(get_workspace_service),
):
    return await workspace_service.generate(request)
