import os
from threading import local
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from numpy import source
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from datasets import load_dataset
import uuid
from ..tools.file_tools import getSrtsBasePath
from backend.src.utils.log_utils import logger

router = APIRouter(prefix="/whisper")


def init():

    device = "cuda" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    model_id = "openai/whisper-large-v3-turbo"

    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id,
        torch_dtype=torch_dtype,
        low_cpu_mem_usage=True,
        use_safetensors=True,
        local_files_only=True,
    )
    model.to(device)

    return model_id, torch_dtype, model, device


model_id, torch_dtype, model, device = init()


@router.get("/whisperStatus")
def whisperStatus():
    return {"msg": "ok"}


@router.post("/audio-to-text")
async def autoToText(file: UploadFile = File(...)):

    try:
        filePath = f"temp/{uuid.uuid5(uuid.NAMESPACE_DNS,"audio")}"
        # 保存上传的文件
        with open(filePath, "wb") as f:
            f.write(await file.read())
        processor = AutoProcessor.from_pretrained(model_id)
        pipe = pipeline(
            "automatic-speech-recognition",
            model=model,
            tokenizer=processor.tokenizer,
            feature_extractor=processor.feature_extractor,
            torch_dtype=torch_dtype,
            device=device,
        )
        result = pipe(filePath, return_timestamps=True, language="chinese")
        textInfo = result["chunks"]
        os.remove(filePath)
        return JSONResponse(content={"data": textInfo})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


def audioSaveToSrtText(filePath: str):
    processor = AutoProcessor.from_pretrained(model_id)
    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype,
        device=device,
    )
    result = pipe(filePath, return_timestamps=True)
    textInfo = result["chunks"]

    srtsFileName = f"{str(uuid.uuid4())}.srt"
    srtsFilePath = os.path.join(getSrtsBasePath(), srtsFileName)
    srtContent = convert_to_srt(textInfo)
    write_srt_file(srtContent, srtsFilePath)
    return srtsFilePath


def write_srt_file(srt_content, file_path):
    """Write the SRT content to a local file."""
    try:
        with open(file_path, "w", encoding="utf-8") as file:
            file.write(srt_content)
        print(f"SRT file successfully saved to {file_path}")
    except IOError as e:
        print(f"Error writing SRT file: {e}")


def convert_to_srt(subtitles):
    """Convert a list of subtitle dictionaries to SRT format string."""

    def format_time(seconds):
        """Format time in SRT format (HH:MM:SS,mmm)."""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        seconds_part = f"{seconds % 60:.3f}".zfill(6)

        return f"{hours:02}:{minutes:02}:{seconds_part}"

    srt_content = []

    for index, subtitle in enumerate(subtitles, start=1):
        start = subtitle["timestamp"][0]
        end = subtitle["timestamp"][1]
        text = subtitle["text"]

        start_time = format_time(start)
        end_time = format_time(end)

        srt_content.append(f"{index}")
        srt_content.append(f"{start_time} --> {end_time}")
        srt_content.append(text)
        srt_content.append("")  # Add an empty line between subtitles

    return "\n".join(srt_content)
