import os
from turtle import width
from fastapi import (
    APIRouter,
    Depends,
    File,
    UploadFile,
    FastAPI,
    Request,
    HTTPException,
)
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from datasets import load_dataset
import uuid
from pydantic import BaseModel
import httpx
from contextlib import asynccontextmanager
import torch
import numpy as np
from PIL import Image
import io
import base64
from basicsr.archs.rrdbnet_arch import RRDBNet
from gfpgan.utils import GFPGANer
from facexlib.utils.face_restoration_helper import FaceRestoreHelper
from ..services.kolors.kolors_service import load_pipe, infer
from realesrgan import RealESRGANer
import cv2
import numpy as np
import io
from PIL import Image
from ..tools.file_tools import getImagesBasePath, getVideoBasePath
from io import BytesIO
from ..services.project_service.model import ImageModel


class GenerateResponse(BaseModel):
    image: str  # base64编码的图片


# 数据模型定义
class GenerateRequest(BaseModel):
    prompt: str
    width: int = 1024
    height: int = 1024
    num_inference_steps: int = 32
    guidance_scale: float = 5.0
    num_images_per_prompt: int = 1
    seed: int = 40
    upscale: bool = True


class UpscaleVO(BaseModel):
    image: str  # base64编码的图片


router = APIRouter(prefix="/text-to-image")

# 定义全局超时配置（10分钟）
global_timeout_config = httpx.Timeout(
    timeout=600.0,  # 总超时时间为10分钟
    connect=600.0,  # 连接超时时间为10分钟
    read=600.0,  # 读取超时时间为10分钟
    write=600.0,  # 写入超时时间为10分钟
    pool=600.0,  # 池管理超时时间为10分钟
)

upsampler = None


# 模型加载函数
def load_upscaler():
    projectDir = os.getcwd()
    model_path = os.path.join(projectDir, "weights", "RealESRGAN_x2plus.pth")
    model = RRDBNet(
        num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=2
    )
    return RealESRGANer(scale=2, model_path=model_path, model=model)


# 创建一个异步上下文管理器来管理客户端的生命周期
@asynccontextmanager
async def lifespan(app: FastAPI):

    load_pipe()
    global upsampler
    upsampler = load_upscaler()

    # 在应用程序启动时创建客户端实例
    app.state.http_client = httpx.AsyncClient(timeout=global_timeout_config)
    yield
    # 在应用程序关闭时关闭客户端实例
    await app.state.http_client.aclose()


# 使用全局客户端的依赖项
async def get_global_http_client(request: Request) -> httpx.AsyncClient:
    return request.app.state.http_client


def upscaleImage(image_path):
    # 打开图像
    img = Image.open(image_path)

    # 将图像转换为 NumPy 数组，并确保是 RGB 格式
    img_array = np.array(img.convert("RGBA"))

    # 使用 Real-ESRGAN 进行超分辨率处理
    sr_img_array, _ = upsampler.enhance(img_array)

    # 将 NumPy 数组转换回 PIL 图像对象
    sr_img = Image.fromarray(sr_img_array)

    # 保存处理后的图像
    sr_img.save(image_path)


@router.post("/generate", response_model=ImageModel)
async def generate(request: GenerateRequest):
    """生成图像的API端点"""
    _, images = infer(
        request.prompt,
        request.width,
        request.height,
        request.num_inference_steps,
        request.guidance_scale,
        request.num_images_per_prompt,
        request.seed,
    )

    imgId = str(uuid.uuid4())
    imgName = f"{imgId}.png"
    imgPath = os.path.join(getImagesBasePath(), imgName)
    # 处理生成的图像
    image = images[0]
    image.save(imgPath)
    upscaleImage(imgPath)
    # # 执行超分辨率处理
    imageUrl = os.path.join(getAssetsBaseUrl(), "images", imgName)
    return ImageModel(id=imgId, name=imgName, url=imageUrl)


@router.post("/upscale", response_model=UpscaleVO)
async def upscale_image(
    file: UploadFile = File(...),
    client: httpx.AsyncClient = Depends(get_global_http_client),
):
    """
    接收上传的图片，使用RealESRGAN_x4plus模型提升图片清晰度，并返回处理好的图片。

    :param file: 上传的图片文件
    :return: 处理好的图片文件
    """
    try:
        # 将上传的文件内容读入内存并转换为numpy数组
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_UNCHANGED)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # 如果图像有alpha通道，去掉它（如果有的话）
        if img.shape[2] == 4:
            img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)

        # 执行超分辨率处理
        output, _ = upsampler.enhance(img)

        # 将处理后的图像转换为字节流
        _, img_encoded = cv2.imencode(".png", output)
        img_bytes = img_encoded.tobytes()

        # 返回处理好的图片作为流响应
        return StreamingResponse(io.BytesIO(img_bytes), media_type="image/png")

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error during enhancement: {str(e)}"
        )


@router.get("/images/{imageId}")
def upscale_image(imageId: str):
    fileImageBasePath = getImagesBasePath()
    imageFilePath = os.path.join(fileImageBasePath, imageId)
    return FileResponse(imageFilePath)


@router.get("/videos/{videoName}")
def upscale_image(videoName: str):
    basePath = getVideoBasePath()
    filePath = os.path.join(basePath, videoName)
    return FileResponse(filePath)


def getAssetsBaseUrl():
    return "http://localhost:8085/text-to-image/"
