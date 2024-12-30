import os
import json
from os import name, path
import uuid


from backend.src.services.project_service.model import ProjectMetaModel


def ensure_directory_exists(filepath):
    """确保文件路径中的所有目录都存在"""
    if filepath and not os.path.exists(filepath):
        os.makedirs(filepath)


def write_json_to_file(data, filepath, indent=4):
    """将 Python 对象写入 JSON 文件，并确保路径存在"""
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data.dict(), f, ensure_ascii=False, indent=indent)


def getProjectsBasePath():
    basePath = path.dirname(path.dirname(path.dirname(path.dirname(__file__))))
    projectsPath = path.join(basePath, "projects")
    ensure_directory_exists(projectsPath)
    return projectsPath


def getProjectMetaPath():
    return path.join(getProjectsBasePath(), "project-meta.json")


def load_json_to_pydantic(filepath, model_class):
    """从 JSON 文件加载数据并序列化成指定的 Pydantic 模型"""
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    return model_class(**data)


def getImagesBasePath():
    imagesPath = os.path.join(getProjectsBasePath(), "images")
    ensure_directory_exists(imagesPath)
    return imagesPath


def getAudiosBasePath():
    imagesPath = os.path.join(getProjectsBasePath(), "audios")
    ensure_directory_exists(imagesPath)
    return imagesPath


def getSrtsBasePath():
    imagesPath = os.path.join(getProjectsBasePath(), "srts")
    ensure_directory_exists(imagesPath)
    return imagesPath


def getVideoBasePath():
    videoBasePath = os.path.join(getProjectsBasePath(), "videos")
    ensure_directory_exists(videoBasePath)
    return videoBasePath


def getVideoSaveFilePath():

    fileBasePath = getVideoBasePath()

    fileName = f"{str(uuid.uuid4())}.mp4"

    filePath = os.path.join(fileBasePath, fileName)

    return filePath


def getProjectMeta():
    projectMetaPath = getProjectMetaPath()
    if not os.path.exists(projectMetaPath):
        write_json_to_file(ProjectMetaModel(), projectMetaPath)
    return load_json_to_pydantic(projectMetaPath, ProjectMetaModel)
