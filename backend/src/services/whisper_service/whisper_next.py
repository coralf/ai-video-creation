import os
from pydoc import text
from tracemalloc import start
from typing import List
from pyparsing import identbodychars
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
import uuid
import torch
from difflib import SequenceMatcher
from rapidfuzz import fuzz
import numpy as np

from backend.src.tools.file_tools import getSrtsBasePath


def align_subtitles(text_info, subtitles):
    """
    Aligns the provided subtitles with the recognized text timestamps.

    Parameters:
        text_info (list): List of word timestamps from the model.
        subtitles (list): List of subtitle lines.

    Returns:
        aligned_subtitles (list): Aligned subtitle lines with timestamps.
    """
    aligned_subtitles = []
    startIndex = 0
    for subtitle in subtitles:
        subtitle_start = None
        subtitle_end = None
        similarRatioRecordList = []
        subtitleLen = len(subtitle)
        """
        算法待优化，查找自身周围的字符串
        """
        absoluteEndIndex = startIndex + subtitleLen + 1
        for currentEndIndex in range(startIndex + 1, absoluteEndIndex):
            subTextInfoList = text_info[startIndex:currentEndIndex]
            recognizedText = "".join([item["text"] for item in subTextInfoList])
            currentRatio = similarRatio(subtitle, recognizedText)
            endIndex = currentEndIndex - 1
            similarRatioRecord = {
                "ratio": currentRatio,
                "subTextInfoList": subTextInfoList,
                "startIndex": startIndex,
                "endIndex": endIndex,
            }
            if len(similarRatioRecordList) == 0:
                similarRatioRecordList.append(similarRatioRecord)
            else:
                lastSimilarRatioRecord = similarRatioRecordList[-1]
                lastRatio = lastSimilarRatioRecord["ratio"]
                if lastRatio < currentRatio:
                    similarRatioRecordList.append(similarRatioRecord)

        similarRatioRecord = similarRatioRecordList.pop()
        recordStartIndex = similarRatioRecord["startIndex"]
        recordEndIndex = similarRatioRecord["endIndex"]
        startIndex = recordEndIndex + 1
        subtitle_start = text_info[recordStartIndex]["timestamp"][0]
        subtitle_end = text_info[recordEndIndex]["timestamp"][1]
        # Append subtitle even if partially matched
        aligned_subtitles.append(
            {
                "start": subtitle_start,
                "end": subtitle_end,
                "text": subtitle,
            }
        )
        finalRecognizedText = "".join(
            [item["text"] for item in similarRatioRecord["subTextInfoList"]]
        )
        print(
            f"字幕：'{subtitle}' , 识别的字幕：{finalRecognizedText} 置信度：{similarRatioRecord["ratio"]}"
        )
    return aligned_subtitles


def similarRatio(recognized_char, target_char):
    # return SequenceMatcher(None, recognized_char, target_char).ratio()
    return fuzz.ratio(target_char, recognized_char)


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


def save_srt_file(aligned_subtitles, output_path):
    """
    Saves the aligned subtitles to an SRT file.

    Parameters:
        aligned_subtitles (list): List of subtitle lines with timestamps.
        output_path (str): Path to save the SRT file.
    """
    with open(output_path, "w", encoding="utf-8") as f:
        for idx, subtitle in enumerate(aligned_subtitles, start=1):
            start = subtitle["start"]
            end = subtitle["end"]

            # Convert timestamps to SRT time format
            start_time = format_time(start)
            end_time = format_time(end)

            f.write(f"{idx}\n")
            f.write(f"{start_time} --> {end_time}\n")
            f.write(f"{subtitle['text']}\n\n")
    return output_path

def format_time(seconds):
    """Converts seconds to SRT time format (HH:MM:SS,mmm)."""
    milliseconds = int((seconds % 1) * 1000)
    seconds = int(seconds)
    minutes, seconds = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"


def align_subtitles_next(
    textTimestampList: List[dict], subtitles: List[str], stayDurationMillisecond: int
):
    align_subtitles = []
    currentStartTimestamp = 0
    for index, subtitle in enumerate(subtitles):
        textTimestamp = textTimestampList[index]
        duration = textTimestamp["timestamp"][1]
        stayDurationSecond = np.divide(stayDurationMillisecond, 1000)
        currentEndTimestamp = np.add(
            np.add(currentStartTimestamp, duration), stayDurationSecond
        )
        currentEndTimestamp = np.round(currentEndTimestamp, 2)
        align_subtitles.append(
            {
                "start": currentStartTimestamp,
                "end": currentEndTimestamp,
                "text": subtitle,
            }
        )
        currentStartTimestamp = currentEndTimestamp
    return align_subtitles


def audio_save_to_srt_text(
    audioPathList: List[str],
    subtitles: List[str],
    stayDurationMillisecond: int,
):
    model_id, torch_dtype, model, device = init()
    processor = AutoProcessor.from_pretrained(model_id)
    pipe = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        torch_dtype=torch_dtype,
        device=device,
    )

    textTimestampList = []
    for audioPath in audioPathList:
        result = pipe(audioPath, return_timestamps=True)
        text_info = result["chunks"]
        textTimestampList.extend(text_info)

    # Align subtitles with timestamps
    aligned_subtitles = align_subtitles_next(
        textTimestampList, subtitles, stayDurationMillisecond
    )

    srtsFileName = f"{str(uuid.uuid4())}.srt"
    srtsFilePath = os.path.join(getSrtsBasePath(), srtsFileName)
    # Save aligned subtitles to an SRT file
    return save_srt_file(aligned_subtitles, srtsFilePath)
