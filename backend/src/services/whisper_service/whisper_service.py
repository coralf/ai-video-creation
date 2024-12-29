from datetime import timedelta
import whisper
from fuzzywuzzy import fuzz
import jieba


def format_timestamp(seconds: float) -> str:
    """格式化时间戳为 SRT 的时间格式"""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    ms = int((seconds - total_seconds) * 1000)
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02},{ms:03}"


def replace_homophones(text, homophones_dict):
    """替换文本中的同音字"""
    for target, variants in homophones_dict.items():
        for variant in variants:
            text = text.replace(variant, target)
    return text


def split_segment_text(segment_text, subtitles, current_index):
    """根据字幕动态拆分 segment 的文本"""
    matched_subtitles = []
    remaining_text = segment_text

    while current_index < len(subtitles) and remaining_text:
        subtitle = subtitles[current_index]
        match_ratio = fuzz.partial_ratio(subtitle, remaining_text)
        if match_ratio > 80:
            matched_subtitles.append(subtitle)
            remaining_text = remaining_text[len(subtitle) :].strip()
            current_index += 1
        else:
            break

    return matched_subtitles, current_index

def adjust_times_for_subtitles(segment, matched_subtitles):
    """根据 matched_subtitles 动态调整时间范围"""
    start_time = segment["start"]
    end_time = segment["end"]
    words = segment.get("words", [])

    # 如果有 word-level 时间信息
    if words and len(matched_subtitles) > 0:
        adjusted_segments = []
        subtitle_index = 0
        current_text = ""
        for word in words:
            current_text += word["word"]
            if current_text.strip() == matched_subtitles[subtitle_index]:
                adjusted_segments.append({
                    "start": start_time,
                    "end": word["end"],
                    "text": matched_subtitles[subtitle_index],
                })
                start_time = word["end"]  # 更新下一段的起始时间
                subtitle_index += 1
                current_text = ""
                if subtitle_index == len(matched_subtitles):
                    break
        return adjusted_segments

    # 没有 word-level 信息，平均分配时间
    avg_duration = (end_time - start_time) / len(matched_subtitles)
    return [
        {
            "start": start_time + i * avg_duration,
            "end": start_time + (i + 1) * avg_duration,
            "text": subtitle,
        }
        for i, subtitle in enumerate(matched_subtitles)
    ]


def align_subtitles_with_segments(segments, subtitles, homophones_dict=None):
    """对齐字幕文案和 Whisper 转录段落"""
    aligned_segments = []
    subtitle_index = 0
    segment_index = 0

    while subtitle_index < len(subtitles) and segment_index < len(segments):
        subtitle = subtitles[subtitle_index]
        segment = segments[segment_index]
        segment_text = segment["text"].replace(" ", "")

        # 替换同音字
        if homophones_dict:
            segment_text = replace_homophones(segment_text, homophones_dict)
            subtitle = replace_homophones(subtitle, homophones_dict)

        # 动态拆分 segment_text
        matched_subtitles, subtitle_index = split_segment_text(
            segment_text, subtitles, subtitle_index
        )

        # 根据匹配结果动态调整时间
        if matched_subtitles:
            adjusted_segments = adjust_times_for_subtitles(segment, matched_subtitles)
            aligned_segments.extend(adjusted_segments)

        segment_index += 1

    if subtitle_index != len(subtitles):
        print(
            f"Warning: 无法匹配所有字幕文案。剩余未匹配字幕：{subtitles[subtitle_index:]}"
        )

    return aligned_segments



def generate_srt_with_whisper(audio_file, subtitles, output_file):
    """使用 Whisper 模型生成与字幕文案严格对齐的 SRT 文件"""
    print("Transcribing audio with Whisper...")
    model = whisper.load_model("large-v3-turbo")
    result = model.transcribe(audio_file, task="transcribe", language="zh")
    segments = result["segments"]

    print("Aligning subtitles with segments...")
    aligned_segments = align_subtitles_with_segments(segments, subtitles)

    print("Writing to SRT file...")
    with open(output_file, "w", encoding="utf-8") as srt_file:
        for i, segment in enumerate(aligned_segments, 1):
            start_time = format_timestamp(segment["start"])
            end_time = format_timestamp(segment["end"])
            text = segment["text"]
            srt_file.write(f"{i}\n{start_time} --> {end_time}\n{text}\n\n")

    print(f"SRT file written to {output_file}")
    return output_file

"""
if __name__ == "__main__":

    # 示例使用
    audio_file = "/root/projects/ai-creation/projects/audios/e4950133-9487-4c08-9aec-4c4217c7ab22.mp3"
    text = "在一片池塘中有一群小鱼。还有漂亮的荷花。小鱼在池塘里游啊游。它们似乎在找寻着什么"
    subtitles = text.split("。")
    output_file = "/root/projects/ai-creation/projects/srts/test.srt"

    generate_srt_with_whisper(audio_file, subtitles, output_file)
"""