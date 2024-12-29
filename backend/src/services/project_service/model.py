from ast import Num
from turtle import speed
from typing import List, Optional
from pydantic import BaseModel


class ImageModel(BaseModel):
    id: str
    name: str = ""
    url: str = ""


class VideoModel(BaseModel):
    id: str
    name: str = ""
    url: str = ""


class StoryboardModel(BaseModel):
    id: str
    image: Optional[ImageModel] = None
    subtitle: str = ""
    prompts: str = ""
    seed: int = 0


class ProjectModel(BaseModel):
    id: str = ""
    name: str = ""
    preViewImageUrl: Optional[str] = None
    video: Optional[VideoModel] = None
    storyboards: List[StoryboardModel] = []


class ChatTTSSettingModel(BaseModel):
    audioSeed: int = 1
    testText: str = ""
    speed: int = 5


class ProjectMetaModel(BaseModel):
    chatttsSetting: Optional[ChatTTSSettingModel] = None
    projects: List[ProjectModel] = []


class Segment(BaseModel):
    imagePath: str
    texts: List[str]
    audioPaths: List[str] = []


class GenVideoParams(BaseModel):
    audioPath: str
    srtPath: str
    segments: List[Segment] = []
