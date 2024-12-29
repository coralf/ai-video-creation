from ast import Dict, main
from datetime import datetime
from email.mime import audio
from os import name, path
import os
from re import sub
import string
from typing import List
import uuid
from numpy import save
from pydub import AudioSegment
import ChatTTS
from functools import reduce

from backend.src.services.chat_tts_service.chat_tts_utils import getChatTTSSetting
from backend.src.services.whisper_service.whisper_next import audio_save_to_srt_text
from backend.src.services.whisper_service.whisper_service import (
    generate_srt_with_whisper,
)

from ...controllers.text_to_image_controller import getAssetsBaseUrl
from pydub.silence import detect_leading_silence
from .gen_video import create_video_from_segments
from .model import (
    GenVideoParams,
    ImageModel,
    ProjectModel,
    ProjectMetaModel,
    Segment,
    StoryboardModel,
    VideoModel,
)
import json
from ...tools.file_tools import (
    getAudiosBasePath,
    getImagesBasePath,
    getProjectMeta,
    getProjectMetaPath,
    getSrtsBasePath,
    write_json_to_file,
    load_json_to_pydantic,
)
from ...controllers.whisper_controller import audioSaveToSrtText
from ...controllers.chat_tts_controller import (
    TextToAudioRequest,
    textSaveToAudio,
)
from backend.src.utils.log_utils import logger


def getNowFormat():
    # 获取当前时间
    now = datetime.now()
    # 格式化时间为 "年_月_日_时_分_秒" 的字符串
    return now.strftime("%Y_%m_%d_%H_%M_%S")


def getProjectService():
    return ProjectService()


class ProjectService:

    def __init__(self):
        pass

    def getProjects(self):
        projcetMeta = getProjectMeta()
        for project in projcetMeta.projects:
            storyboards = project.storyboards
            project.preViewImageUrl = self.getPreViewImageUrl(storyboards)
        return projcetMeta.projects

    def getPreViewImageUrl(self, storyboards: List[StoryboardModel]):
        
        if storyboards is not None and len(storyboards) > 0:
            storyboard = storyboards[0]
            if storyboard is not None and storyboard.image is not None:
                return storyboard.image.url

    def initProject(self):
        dicPath = path.join(path.dirname(os.getcwd()))
        print(dicPath)

    def createProject(self):
        projectMeta = getProjectMeta()
        project = {"id": str(uuid.uuid4()), "name": getNowFormat()}
        projectMeta.projects.append(project)
        write_json_to_file(projectMeta, getProjectMetaPath())
        return project

    def deleteById(self, projectModel: ProjectModel):
        projectMeta = getProjectMeta()
        projectMeta.projects = list(
            filter(lambda item: item.id != projectModel.id, projectMeta.projects)
        )
        write_json_to_file(projectMeta, getProjectMetaPath())

    def getById(self, id: str):
        projectMeta = getProjectMeta()
        projects = [item for item in projectMeta.projects if item.id == id]
        return projects[0] if projects else None

    def saveStoryboards(self, projectId: str, storyboards: List[StoryboardModel]):
        project = self.getById(projectId)
        project.storyboards = storyboards
        projectMeta = getProjectMeta()
        projectIndex = next(
            index
            for index, item in enumerate(projectMeta.projects)
            if item.id == projectId
        )
        projectMeta.projects[projectIndex] = project
        write_json_to_file(projectMeta, getProjectMetaPath())

    def generateVideo(self, projectId: str):
        project = self.getById(projectId)
        storyboards = project.storyboards
        # cleanText = replace_newlines_with_period(storyboards)
        subTitles = getSubtitles(project.storyboards)
        chatTTSSetting = getChatTTSSetting()
        params = TextToAudioRequest(
            text=subTitles,
            stream=False,
            lang=None,
            # 关闭所有文本处理,确保完全按照原文生成
            skip_refine_text=True,
            refine_text_only=False,
            use_decoder=True,
            do_text_normalization=False,
            do_homophone_replacement=False,
            # params_refine_text=ChatTTS.Chat.RefineTextParams(
            #     prompt="",
            #     # 最小化随机性
            #     top_P=0.05,
            #     top_K=1,
            #     temperature=0.05,
            #     # 增加重复惩罚
            #     repetition_penalty=1.5,
            #     max_new_token=384,
            #     min_new_token=0,
            #     show_tqdm=False,
            #     ensure_non_empty=True,
            # ),
            params_infer_code=ChatTTS.Chat.InferCodeParams(
                prompt=f"[speed_{str(chatTTSSetting.speed)}]",
                top_P=0.1,
                top_K=20,
                temperature=0.3,
                repetition_penalty=1.05,
                max_new_token=2048,
                min_new_token=0,
                show_tqdm=True,
                ensure_non_empty=True,
                stream_batch=True,
                spk_emb=None,
                manual_seed=chatTTSSetting.audioSeed,
            ),
        )

        # 根据文本生成音频
        audioPathList = textSaveToAudio(params)
        stayDurationMillisecond = 300
        audioPath, audioPathList = add_fixed_interval(
            audioPathList, interval_ms=stayDurationMillisecond
        )

        logger.info(f"audioPath:{audioPath}")
        # 根据音频生成字幕
        subtitles = getSubtitles(storyboards)
        srtPath = audio_save_to_srt_text(
            audioPathList, subtitles, stayDurationMillisecond
        )
        delete_audio_files(audioPathList)
        logger.info(f"srtPath:{srtPath}")
        segments = list(map(lambda x: toSegment(x), project.storyboards))
        genVideoParams = GenVideoParams(
            audioPath=audioPath, srtPath=srtPath, segments=segments
        )
        # 调用生成视频的函数
        videoPath = create_video_from_segments(genVideoParams)
        # 提取视频文件名和不带后缀的文件名
        videoName = os.path.basename(videoPath)
        videoNameWithoutExt = os.path.splitext(videoName)[0]

        videoUrl = os.path.join(getAssetsBaseUrl(), "videos", videoName)

        project = self.getById(projectId)
        projectMeta = getProjectMeta()
        projectIndex = next(
            index
            for index, item in enumerate(projectMeta.projects)
            if item.id == projectId
        )
        project.video = VideoModel(
            id=videoNameWithoutExt,
            name=videoName,
            url=videoUrl,
        )
        projectMeta.projects[projectIndex] = project
        write_json_to_file(projectMeta, getProjectMetaPath())

        return VideoModel(
            id=videoNameWithoutExt,
            name=videoName,
            url=videoUrl,
        )


def remove_punctuation(s):
    # 将字符串中的标点符号替换为空格
    s = s.translate(str.maketrans(string.punctuation, " " * len(string.punctuation)))
    # 去掉前后空格
    s = s.strip()
    return s


def replace_newlines_with_period(storyboards: List[StoryboardModel]):
    """将字符串中的所有换行符替换为句号"""
    subtitles = getSubtitles(storyboards)
    text = "。".join(subtitles)
    return text


def getSubtitles(storyboards: List[StoryboardModel]):
    subtitles: List[str] = []
    for item in storyboards:
        subtitleList = getCleanSubtitles(item.subtitle)
        subtitles.extend(subtitleList)
    return [s for s in subtitles if s.strip()]


def getCleanSubtitles(subtitle: str):
    subtitleList = subtitle.split("\n")
    subtitleList = list(
        map(lambda subtitle: remove_punctuation(subtitle), subtitleList)
    )
    subtitleList = [s for s in subtitleList if s.strip()]
    return subtitleList


def toSegment(item: StoryboardModel):
    imagePath = os.path.join(getImagesBasePath(), item.image.name)
    subtitleList = getCleanSubtitles(item.subtitle)
    return Segment(imagePath=imagePath, texts=subtitleList, audioPaths=[])


def delete_audio_files(audio_paths: List[str]):
    for audio_path in audio_paths:
        if os.path.exists(audio_path):
            os.remove(audio_path)


def trim_silence(audio, silence_threshold=-40.0, chunk_size=10):
    """
    移除音频开头和结尾的静音部分。
    :param audio: 音频片段 (AudioSegment)
    :param silence_threshold: 静音阈值 (dBFS)
    :param chunk_size: 检测静音时的块大小 (ms)
    :return: 去除静音后的音频片段
    """
    start_trim = detect_leading_silence(audio, silence_threshold, chunk_size)
    end_trim = detect_leading_silence(audio.reverse(), silence_threshold, chunk_size)

    duration = len(audio)
    trimmed_audio = audio[start_trim : duration - end_trim]

    return trimmed_audio


def save_audio_files(audios, output_folder):
    """
    将音频片段列表保存到指定的文件夹中。
    :param audios: 音频片段列表 (AudioSegment 对象)
    :param output_folder: 输出文件夹路径
    :return: 保存的音频文件路径列表
    """
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    audio_paths = []
    for audio in audios:
        # 生成唯一的文件名
        audio_name = str(uuid.uuid4()) + ".wav"
        output_path = os.path.join(output_folder, audio_name)

        # 保存音频文件
        audio.export(output_path, format="wav")

        # 添加保存的文件路径到列表中
        audio_paths.append(output_path)

    return audio_paths


def add_fixed_interval(audio_files, interval_ms=200):
    """
    在每个音频文件之间添加固定间隔并拼接所有音频文件。
    :param audio_files: 包含音频文件路径的列表
    :param interval_ms: 固定间隔时间 (ms)
    :return: 拼接后的音频片段
    """
    # 加载并修剪所有音频文件
    audios = [trim_silence(AudioSegment.from_wav(f)) for f in audio_files]

    audiosDir = getAudiosBasePath()
    trimSilenceAudioPathList = save_audio_files(audios, audiosDir)

    # 创建指定时长的静音片段
    silence = AudioSegment.silent(duration=interval_ms)

    # 拼接所有音频片段，并在它们之间插入静音
    combined_audio = reduce(lambda x, y: x + silence + y, audios)
    audioName = str(uuid.uuid4())
    audioPath = os.path.join(getAudiosBasePath(), f"{audioName}.wav")
    combined_audio.export(audioPath, format="wav")
    delete_audio_files(audio_files)
    return audioPath, trimSilenceAudioPathList
