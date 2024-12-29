from typing import Any, Dict, List
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
from fastapi.responses import JSONResponse, StreamingResponse
from h11 import Response
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from datasets import load_dataset
import uuid
from pydantic import BaseModel
import httpx
from contextlib import AsyncExitStack, asynccontextmanager
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
from ..services.project_service.project_service import ProjectService, getProjectService
from ..services.project_service.model import ProjectModel, StoryboardModel


router = APIRouter(prefix="/project")


# 创建一个异步上下文管理器来管理客户端的生命周期
@asynccontextmanager
async def lifespan(app: FastAPI):
    # async with AsyncExitStack() as stack:
    #     project_service = await stack.enter_async_context(getProjectService())
    #     await project_service.init_project()
    #     yield
    yield


@router.get("/getProjects", response_model=List[ProjectModel])
def getProjects(project_service: ProjectService = Depends(getProjectService)):
    try:
        projects = project_service.getProjects()
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/createProject", response_model=Any)
def createProject(project_service: ProjectService = Depends(getProjectService)):
    return project_service.createProject()


@router.post("/deleteById", response_model=Any)
def createProject(
    request: ProjectModel, project_service: ProjectService = Depends(getProjectService)
):
    return project_service.deleteById(request)


@router.get("/getById", response_model=Any)
def getById(id: str, project_service: ProjectService = Depends(getProjectService)):
    return project_service.getById(id)


class SaveStoryboardRequestModel(BaseModel):
    projectId: str
    storyboards: List[StoryboardModel] = []


@router.post("/saveStoryboards", response_model=Any)
def saveStoryboards(
    saveStoryboardRequestModel: SaveStoryboardRequestModel,
    project_service: ProjectService = Depends(getProjectService),
):
    projectId = saveStoryboardRequestModel.projectId
    storyboards = saveStoryboardRequestModel.storyboards
    return project_service.saveStoryboards(projectId, storyboards)


class GenerateVideoModel(BaseModel):
    projectId: str


@router.post("/generateVideo")
def generateVideo(
    saveStoryboardRequestModel: GenerateVideoModel,
    project_service: ProjectService = Depends(getProjectService),
):
    return project_service.generateVideo(saveStoryboardRequestModel.projectId)
