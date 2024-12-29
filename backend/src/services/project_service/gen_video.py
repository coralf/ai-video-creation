import os
import subprocess
import chardet
import pysrt
from pathlib import Path
import ffmpeg

import shutil

from backend.src.tools.file_tools import (
    ensure_directory_exists,
    getAudiosBasePath,
    getVideoBasePath,
    getVideoSaveFilePath,
)
from .model import GenVideoParams
from backend.src.utils.log_utils import logger


def calculate_subtitle_indices(segments, current_idx):
    """计算当前片段在字幕文件中的起始和结束索引"""
    start_idx = sum(len(seg.texts) for seg in segments[:current_idx])
    end_idx = start_idx + len(segments[current_idx].texts) - 1
    return start_idx, end_idx


def create_temp_video_segment(image_path, duration, idx, temp_dir):
    """创建单个视频片段"""
    temp_video = str(temp_dir / f"segment_{idx}.mp4")
    width, height = 800, 450

    # 计算移动距离和方向
    if idx % 2 == 0:  # 从上往下
        y_start = int(height * 0.4)
        y_end = 0
    else:  # 从下往上
        y_start = 0
        y_end = int(height * 0.4)

    try:
        stream = (
            ffmpeg.input(image_path, loop=1, t=duration)
            .filter("scale", width, int(height * 1.8))  # 放大图片以留出移动空间
            .filter("fps", fps=30)  # 提高帧率到60fps
            .filter(
                "crop",
                width,
                height,
                0,
                # 使用线性匀速移动
                f"if(gte(t,0),{y_start}+({y_end}-{y_start})*t/{duration},{y_start})",
            )
            .filter(
                "minterpolate",
                fps=30,  # 输出帧率
                mi_mode="mci",  # 运动补偿插值
                mc_mode="aobmc",  # 自适应叠加块匹配补偿
                me_mode="bidir",  # 双向运动估计
                vsbmc=1,
            )  # 可变大小块运动补偿
            .output(
                temp_video,
                vcodec="libx264",
                pix_fmt="yuv420p",
                # 视频编码参数优化
                **{
                    "preset": "slow",  # 编码预设，更好的质量
                    "crf": "18",  # 恒定质量因子，更高质量
                    "profile:v": "high",  # 使用高规格编码
                    "level": "4.2",  # 编码级别
                    "r": 30,  # 输出帧率
                },
            )
            .overwrite_output()
        )

        logger.info(f"执行ffmpeg命令: {' '.join(stream.compile())}")
        stream.run(capture_stdout=True, capture_stderr=True)
        return temp_video

    except ffmpeg.Error as e:
        logger.error(f"FFmpeg错误: {e.stderr.decode()}")
        raise


def merge_video_segments(segment_videos, temp_dir):
    """合并所有视频片段"""
    concat_file = temp_dir / "concat.txt"
    output_path = "final_video.mp4"

    # 创建concat文件
    with open(concat_file, "w") as f:
        for video in segment_videos:
            absolute_path = os.path.abspath(video)
            f.write(f"file '{absolute_path}'\n")

    try:
        logger.info(f"使用concat文件: {concat_file}")
        (
            ffmpeg.input(str(concat_file), format="concat", safe=0)
            .output(output_path, vcodec="copy")
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        return output_path, concat_file

    except ffmpeg.Error as e:
        logger.error(f"FFmpeg错误: {e.stderr.decode()}")
        raise


def add_audio_to_video(video_path, audio_path):
    """添加音频到视频"""
    final_with_audio = "final_with_audio.mp4"
    input_video = ffmpeg.input(video_path)
    input_audio = ffmpeg.input(audio_path)

    try:
        (
            ffmpeg.output(
                input_video,
                input_audio,
                final_with_audio,
                vcodec="copy",
                acodec="aac",
                strict="experimental",
                **{"b:a": "192k", "ar": "44100"},
            )
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        return final_with_audio

    except ffmpeg.Error as e:
        logger.error(f"FFmpeg错误: {e.stderr.decode()}")
        raise


def add_subtitles_to_video(video_path, srt_path):
    """添加字幕到视频"""
    shutil.rmtree(getVideoBasePath())
    final_with_subs = getVideoSaveFilePath()

    try:
        (
            ffmpeg.input(video_path)
            .filter(
                "subtitles",
                srt_path,
                force_style=(
                    "Fontname=Noto Sans CJK SC,"
                    "Fontsize=30,"
                    "PrimaryColour=&HFFFFFF,"
                    "BorderStyle=1,"
                    "Outline=2,"
                    "OutlineColour=&H000000,"
                    "Alignment=2,"
                    "MarginV=50"
                ),
            )
            .output(
                final_with_subs,
                acodec="copy",
                vcodec="libx264",
                **{"map": "0:v", "map": "0:a"},
            )
            .overwrite_output()
            .run(capture_stdout=True, capture_stderr=True)
        )
        return final_with_subs

    except ffmpeg.Error as e:
        logger.error(f"FFmpeg错误: {e.stderr.decode()}")
        raise


def removeFile(filePath):
    if os.path.exists(filePath):
        os.remove(filePath)

def cleanup_temp_files(segment_videos, concat_file, output_path, final_with_audio):
    """清理临时文件"""
    logger.info("清理临时文件...")
    for video in segment_videos:
        removeFile(video)
    removeFile(str(concat_file))
    removeFile(output_path)
    removeFile(final_with_audio)


def create_video_from_segments(params: GenVideoParams):
    """主函数：从图片片段创建视频"""
    try:
        # 设置工作目录
        audiosBasePath = getVideoBasePath()
        temp_dir = Path(audiosBasePath) / "temp_videos"
        temp_dir.mkdir(exist_ok=True)

        # 验证输入文件
        if not os.path.exists(params.audioPath):
            raise FileNotFoundError(f"音频文件不存在: {params.audioPath}")
        if not os.path.exists(params.srtPath):
            raise FileNotFoundError(f"字幕文件不存在: {params.srtPath}")

        # 读取字幕文件
        subs = pysrt.open(params.srtPath)
        segment_videos = []

        # 处理每个片段
        for idx, segment in enumerate(params.segments):
            if not os.path.exists(segment.imagePath):
                raise FileNotFoundError(f"图片文件不存在: {segment.imagePath}")

            logger.info(f"处理第 {idx+1} 个片段，图片路径: {segment.imagePath}")

            # 获取字幕时间范围
            start_idx, end_idx = calculate_subtitle_indices(params.segments, idx)
            try:
                start_sub = subs[start_idx]
                end_sub = subs[end_idx]
            except IndexError:
                raise ValueError(f"字幕索引超出范围: {start_idx} 或 {end_idx}")

            duration = (end_sub.end.ordinal - start_sub.start.ordinal) / 1000.0
            logger.info(f"片段持续时间: {duration}秒")

            # 创建视频片段
            temp_video = create_temp_video_segment(
                segment.imagePath, duration, idx, temp_dir
            )
            segment_videos.append(temp_video)

        # 合并视频片段
        output_path, concat_file = merge_video_segments(segment_videos, temp_dir)

        # 添加音频
        final_with_audio = add_audio_to_video(output_path, params.audioPath)

        # 添加字幕
        final_with_subs = add_subtitles_to_video(final_with_audio, params.srtPath)

        # 清理临时文件
        cleanup_temp_files(segment_videos, concat_file, output_path, final_with_audio)

        logger.info(f"视频生成完成: {final_with_subs}")
        return final_with_subs

    except Exception as e:
        logger.error(f"发生错误: {str(e)}")
        raise


def check_srt_encoding(srt_path):
    """检查字幕文件编码"""
    with open(srt_path, "rb") as f:
        raw = f.read()
    logger.info(f"SRT文件编码检测结果: {chardet.detect(raw)}")


def check_available_fonts():
    """检查可用的中文字体"""
    try:
        result = subprocess.run(["fc-list", ":lang=zh"], capture_output=True, text=True)
        logger.info("可用的中文字体:")
        logger.info(result.stdout)
    except Exception as e:
        logger.error(f"检查字体时出错: {str(e)}")
