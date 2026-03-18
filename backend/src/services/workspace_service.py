import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Literal, Optional
from uuid import uuid4

import httpx
from fastapi import HTTPException
from openai import OpenAI
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class WorkspaceReferencedAsset(BaseModel):
    assetId: str
    type: Literal["image", "video"]
    name: Optional[str] = None
    previewUrl: Optional[str] = None
    downloadUrl: Optional[str] = None


class WorkspaceGenerationRequest(BaseModel):
    mode: Literal["text_to_image", "image_to_video"]
    text: str
    referencedAssets: List[WorkspaceReferencedAsset] = []
    size: str = "1024x1024"


class WorkspaceConfig(BaseModel):
    chatConfigured: bool
    imageConfigured: bool
    videoConfigured: bool
    chatModel: Optional[str] = None
    imageModel: Optional[str] = None
    imageEndpoint: Optional[str] = None
    videoModel: Optional[str] = None
    videoEndpoint: Optional[str] = None


class WorkspaceAssetResult(BaseModel):
    assetId: str
    type: Literal["image", "video"]
    prompt: str
    status: Literal["ready"]
    createdAt: str
    previewUrl: Optional[str] = None
    downloadUrl: Optional[str] = None
    sourceAssetId: Optional[str] = None
    raw: Optional[Dict[str, Any]] = None


class WorkspaceGenerationResponse(BaseModel):
    message: ChatMessage
    asset: WorkspaceAssetResult


def _read_json_env(name: str) -> Dict[str, Any]:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return {}

    try:
        parsed = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"环境变量 {name} 不是合法 JSON: {exc.msg}") from exc

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=500, detail=f"环境变量 {name} 必须是 JSON 对象")

    return parsed


def _normalize_message_content(content: Any) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(str(item.get("text", "")))
        return "\n".join(part for part in text_parts if part).strip()

    return str(content or "").strip()


def _created_at() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_first_string(payload: Any, candidate_keys: List[str]) -> Optional[str]:
    normalized_keys = {key.lower() for key in candidate_keys}

    def walk(node: Any) -> Optional[str]:
        if isinstance(node, dict):
            for key, value in node.items():
                if key.lower() in normalized_keys and isinstance(value, str) and value.strip():
                    return value.strip()
            for value in node.values():
                result = walk(value)
                if result:
                    return result
        elif isinstance(node, list):
            for item in node:
                result = walk(item)
                if result:
                    return result
        return None

    return walk(payload)


class WorkspaceService:
    def __init__(self) -> None:
        self.dashscope_base_url = os.getenv(
            "DASHSCOPE_BASE_URL",
            "https://dashscope.aliyuncs.com/compatible-mode/v1",
        ).rstrip("/")
        self.dashscope_api_key = os.getenv("DASHSCOPE_API_KEY", "").strip()
        self.chat_model = os.getenv("QWEN_CHAT_MODEL", "qwen3.5-plus").strip()
        self.image_model = os.getenv("VOLCENGINE_IMAGE_MODEL", "").strip()
        self.image_endpoint = os.getenv("VOLCENGINE_IMAGE_ENDPOINT", "").strip()
        self.video_model = os.getenv("VOLCENGINE_VIDEO_MODEL", "").strip()
        self.video_endpoint = os.getenv("VOLCENGINE_VIDEO_ENDPOINT", "").strip()
        self.chat_extra_body = _read_json_env("QWEN_CHAT_EXTRA_BODY")
        self.image_extra_body = _read_json_env("VOLCENGINE_IMAGE_EXTRA_BODY")
        self.video_extra_body = _read_json_env("VOLCENGINE_VIDEO_EXTRA_BODY")
        self._chat_client: Optional[OpenAI] = None

        if self.dashscope_api_key:
            self._chat_client = OpenAI(
                api_key=self.dashscope_api_key,
                base_url=self.dashscope_base_url,
            )

    def get_config(self) -> WorkspaceConfig:
        return WorkspaceConfig(
            chatConfigured=bool(self.dashscope_api_key and self.chat_model),
            imageConfigured=bool(self.image_model or self.image_endpoint),
            videoConfigured=bool(self.video_model or self.video_endpoint),
            chatModel=self.chat_model or None,
            imageModel=self.image_model or None,
            imageEndpoint=self.image_endpoint or None,
            videoModel=self.video_model or None,
            videoEndpoint=self.video_endpoint or None,
        )

    async def chat(self, messages: List[ChatMessage]) -> ChatMessage:
        if not self._chat_client or not self.chat_model:
            raise HTTPException(status_code=400, detail="未配置 DASHSCOPE_API_KEY 或 QWEN_CHAT_MODEL")

        try:
            completion = self._chat_client.chat.completions.create(
                model=self.chat_model,
                messages=[message.model_dump() for message in messages],
                **self.chat_extra_body,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"请求千问模型失败: {exc}") from exc

        choice = (completion.choices or [None])[0]
        message = choice.message if choice else None
        content = _normalize_message_content(message.content if message else "")
        if not content:
            raise HTTPException(status_code=502, detail="千问模型返回为空，请检查响应格式")

        return ChatMessage(role="assistant", content=content)

    def stream_chat(self, messages: List[ChatMessage]) -> Iterator[str]:
        if not self._chat_client or not self.chat_model:
            raise HTTPException(status_code=400, detail="未配置 DASHSCOPE_API_KEY 或 QWEN_CHAT_MODEL")

        try:
            stream = self._chat_client.chat.completions.create(
                model=self.chat_model,
                messages=[message.model_dump() for message in messages],
                stream=True,
                **self.chat_extra_body,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"请求千问模型失败: {exc}") from exc

        for chunk in stream:
            choice = (chunk.choices or [None])[0]
            if not choice or not choice.delta:
                continue

            delta = _normalize_message_content(choice.delta.content)
            if delta:
                yield f"data: {json.dumps({'delta': delta}, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'done': True}, ensure_ascii=False)}\n\n"

    async def generate(self, request: WorkspaceGenerationRequest) -> WorkspaceGenerationResponse:
        prompt = request.text.strip()
        if not prompt:
            raise HTTPException(status_code=400, detail="请输入要生成的内容")

        if request.mode == "text_to_image":
            asset = await self.generate_image(prompt=prompt, size=request.size)
            return WorkspaceGenerationResponse(
                message=ChatMessage(role="assistant", content="图片已经生成并放入画布。"),
                asset=asset,
            )

        if len(request.referencedAssets) != 1 or request.referencedAssets[0].type != "image":
            raise HTTPException(status_code=400, detail="图生视频需要且只支持引用 1 张图片")

        asset = await self.generate_video_from_image(
            prompt=prompt,
            source_asset=request.referencedAssets[0],
        )
        return WorkspaceGenerationResponse(
            message=ChatMessage(role="assistant", content="视频已经生成并放入画布。"),
            asset=asset,
        )

    async def generate_image(self, prompt: str, size: str = "1024x1024") -> WorkspaceAssetResult:
        if not self.image_endpoint:
            raise HTTPException(status_code=400, detail="尚未配置文生图接口")

        image_api_key = self._resolve_api_key("VOLCENGINE_IMAGE_API_KEY")
        payload: Dict[str, Any] = {
            "prompt": prompt,
            "size": size,
            **self.image_extra_body,
        }
        if self.image_model:
            payload["model"] = self.image_model

        response = await self._post(self.image_endpoint, payload, image_api_key, provider="图片接口")
        image_url = _extract_first_string(response, ["url", "image_url", "imageUrl"])
        b64_json = _extract_first_string(response, ["b64_json"])
        image_data_url = f"data:image/png;base64,{b64_json}" if b64_json else None
        preview_url = image_url or image_data_url
        download_url = image_url or image_data_url

        if not preview_url:
            raise HTTPException(status_code=502, detail="文生图接口未返回可用的图片地址")

        return WorkspaceAssetResult(
            assetId=str(uuid4()),
            type="image",
            prompt=prompt,
            status="ready",
            createdAt=_created_at(),
            previewUrl=preview_url,
            downloadUrl=download_url,
            raw=response,
        )

    async def generate_video_from_image(
        self,
        prompt: str,
        source_asset: WorkspaceReferencedAsset,
    ) -> WorkspaceAssetResult:
        if not self.video_endpoint:
            raise HTTPException(status_code=400, detail="尚未配置图生视频接口")

        asset_url = (source_asset.downloadUrl or source_asset.previewUrl or "").strip()
        if not asset_url:
            raise HTTPException(status_code=400, detail="图生视频缺少源图片地址")

        video_api_key = self._resolve_api_key("VOLCENGINE_VIDEO_API_KEY")
        payload: Dict[str, Any] = {
            "prompt": prompt,
            "image_url": asset_url,
            **self.video_extra_body,
        }
        if self.video_model:
            payload["model"] = self.video_model

        response = await self._post(self.video_endpoint, payload, video_api_key, provider="图生视频接口")
        video_url = _extract_first_string(
            response,
            ["url", "video_url", "videoUrl", "file_url", "fileUrl", "output_url", "outputUrl"],
        )
        preview_url = _extract_first_string(response, ["cover_url", "coverUrl", "poster_url", "posterUrl"]) or video_url

        if not video_url:
            raise HTTPException(status_code=502, detail="图生视频接口未返回可用的视频地址")

        return WorkspaceAssetResult(
            assetId=str(uuid4()),
            type="video",
            prompt=prompt,
            status="ready",
            createdAt=_created_at(),
            previewUrl=preview_url,
            downloadUrl=video_url,
            sourceAssetId=source_asset.assetId,
            raw=response,
        )

    def _resolve_api_key(self, env_name: str) -> str:
        api_key = os.getenv(env_name, "").strip() or self.dashscope_api_key
        if not api_key:
            raise HTTPException(status_code=400, detail=f"缺少 {env_name} 或 DASHSCOPE_API_KEY")
        return api_key

    async def _post(self, url: str, payload: Dict[str, Any], api_key: str, provider: str) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                response = await client.post(url, headers=headers, json=payload)
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"请求{provider}失败: {exc}") from exc

        if response.status_code >= 400:
            detail = response.text.strip() or "未知错误"
            raise HTTPException(
                status_code=response.status_code,
                detail=f"{provider}请求失败: {detail}",
            )

        try:
            return response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail=f"{provider}返回了非 JSON 响应") from exc


_workspace_service = WorkspaceService()


def get_workspace_service() -> WorkspaceService:
    return _workspace_service
