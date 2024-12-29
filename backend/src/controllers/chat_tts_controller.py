import asyncio
from typing import List
import os
from venv import logger
from fastapi import APIRouter, Body, Depends, File, UploadFile, Response, FastAPI
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from datasets import load_dataset
from typing import Optional
import uuid
import ChatTTS
import torch
import torchaudio
from fastapi.responses import StreamingResponse
import zipfile
import io
import os
import sys
from contextlib import asynccontextmanager

from backend.src.services.chat_tts_service.chat_tts_utils import (
    getChatTTSSetting,
    saveChatTTSSetting,
)

from ..services.project_service.model import ChatTTSSettingModel

# from pydub import AudioSegment
from ..utils.pcm import pcm_arr_to_mp3_view
from ..tools.file_tools import (
    getAudiosBasePath,
    getProjectMetaPath,
    getSrtsBasePath,
    write_json_to_file,
)


chat = None
now_dir = os.getcwd()
sys.path.append(now_dir)

router = APIRouter(prefix="/chat-tts")


class TextToAudioRequest(BaseModel):
    text: list[str]
    stream: bool = False
    lang: Optional[str] = None
    skip_refine_text: bool = False
    refine_text_only: bool = False
    use_decoder: bool = True
    do_text_normalization: bool = True
    do_homophone_replacement: bool = False
    params_refine_text: Optional[ChatTTS.Chat.RefineTextParams] = None
    params_infer_code: Optional[ChatTTS.Chat.InferCodeParams] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global chat
    chat = ChatTTS.Chat()
    chat.load(
        # source="custom", custom_path="~/.cache/huggingface/hub/models--2Noise--ChatTTS"
        # source="huggingface"
    )
    yield
    print("chat_tts_initialize")
    await asyncio.sleep(0)


@router.post("/text-to-audio")
async def textToAudio(params: TextToAudioRequest):
    # if (
    #     params.params_infer_code is not None
    #     and params.params_infer_code.manual_seed is not None
    # ):
    #     torch.manual_seed(params.params_infer_code.manual_seed)
    #     params.params_infer_code.spk_emb = chat.sample_random_speaker()

    # text seed for text refining
    # if params.params_refine_text:
    #     text = chat.infer(
    #         text=params.text, skip_refine_text=False, refine_text_only=True
    #     )
    # else:
    #     # no text refining
    #     text = params.text

    wavs = chat.infer(
        text=params.text,
        stream=params.stream,
        lang=params.lang,
        skip_refine_text=params.skip_refine_text,
        use_decoder=params.use_decoder,
        do_text_normalization=params.do_text_normalization,
        do_homophone_replacement=params.do_homophone_replacement,
        params_infer_code=params.params_infer_code,
        params_refine_text=params.params_refine_text,
    )
    mp3_bytes = pcm_arr_to_mp3_view(wavs[0])
    response = Response(content=mp3_bytes, media_type="audio/mpeg")
    response.headers["Content-Disposition"] = "attachment; filename=audio.mp3"
    return response


def textSaveToAudio(params: TextToAudioRequest):
    # if (
    #     params.params_infer_code is not None
    #     and params.params_infer_code.manual_seed is not None
    # ):
    #     torch.manual_seed(params.params_infer_code.manual_seed)
    #     params.params_infer_code.spk_emb = chat.sample_random_speaker()
    global chat
    if chat is None:
        chat = ChatTTS.Chat()
        chat.load()

    # audio seed
    if params.params_infer_code.manual_seed is not None:
        torch.manual_seed(params.params_infer_code.manual_seed)
        params.params_infer_code.spk_emb = chat.sample_random_speaker()

    # text seed for text refining
    if params.params_refine_text:
        text = chat.infer(
            text=params.text, skip_refine_text=False, refine_text_only=True
        )
        logger.info(f"Refined text: {text}")
    else:
        # no text refining
        text = params.text
    wavs = chat.infer(
        text=params.text,
        stream=params.stream,
        lang=params.lang,
        skip_refine_text=params.skip_refine_text,
        use_decoder=params.use_decoder,
        do_text_normalization=params.do_text_normalization,
        do_homophone_replacement=params.do_homophone_replacement,
        params_infer_code=params.params_infer_code,
        params_refine_text=params.params_refine_text,
    )
    filePathList = []
    for wav in wavs:
        audioName = str(uuid.uuid4())
        filePath = os.path.join(getAudiosBasePath(), f"{audioName}.wav")
        # save_mp3_file(wav, filePath)
        torchaudio.save(filePath, torch.from_numpy(wav).unsqueeze(0), 24000)
        filePathList.append(filePath)
    return filePathList


@router.get("/getSetting")
def getSetting():
    return getChatTTSSetting()


@router.post("/saveSetting")
def saveSetting(chatttsSetting: ChatTTSSettingModel):
    saveChatTTSSetting(chatttsSetting)
    return JSONResponse(content={})


def save_mp3_file(wav, filePath: str):
    data = pcm_arr_to_mp3_view(wav)
    mp3_filename = filePath
    with open(mp3_filename, "wb") as f:
        f.write(data)
