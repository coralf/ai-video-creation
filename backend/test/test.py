from typing import List
import uuid
import ChatTTS
import os
import sys
sysPath = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, sysPath)
from pydub import AudioSegment
from pydub.silence import detect_leading_silence
from functools import reduce



from backend.src.services.whisper_service.whisper_next import audio_save_to_srt_text

from backend.src.services.project_service.project_service import (
    ProjectService,
    getSubtitles,
    replace_newlines_with_period,
)
from backend.src.tools.file_tools import getAudiosBasePath, getProjectMeta


from backend.src.controllers.chat_tts_controller import (
    TextToAudioRequest,
    textSaveToAudio,
)



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


def add_fixed_interval(audio_files, interval_ms=200):
    """
    在每个音频文件之间添加固定间隔并拼接所有音频文件。
    :param audio_files: 包含音频文件路径的列表
    :param interval_ms: 固定间隔时间 (ms)
    :return: 拼接后的音频片段
    """
    # 加载并修剪所有音频文件
    audios = [trim_silence(AudioSegment.from_wav(f)) for f in audio_files]

    # 创建指定时长的静音片段
    silence = AudioSegment.silent(duration=interval_ms)

    # 拼接所有音频片段，并在它们之间插入静音
    combined_audio = reduce(lambda x, y: x + silence + y, audios)

    return combined_audio


def testTextToAudio():
    projectService = ProjectService()
    project = projectService.getById("d774ec29-6c37-44ad-9166-95296acba35f")
    print(project)

    subTitles = getSubtitles(project.storyboards)

    print(f"===>生成文本: {subTitles}")
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
        params_infer_code=ChatTTS.Chat.InferCodeParams(
            prompt="[speed_5]",
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
            manual_seed=1,
        ),
    )
    print(params.params_infer_code.manual_seed)
    audio_paths = textSaveToAudio(params)
    final_audio = add_fixed_interval(audio_paths, interval_ms=300)

    audioName = str(uuid.uuid4())
    filePath = os.path.join(getAudiosBasePath(), f"{audioName}.wav")
    final_audio.export(filePath, format="wav")
    # concatedAudioPath = concatenate_audio_files(audio_paths)
    delete_audio_files(audio_paths)
    print(filePath)


def testProjectGenerateVideo():
    projectService =  ProjectService()
    projectService.generateVideo("d774ec29-6c37-44ad-9166-95296acba35f")



def testAudioToSrt():

    subtitles = [
        "在一片池塘中有一群小鱼",
        "还有漂亮的荷花",
        "小鱼在池塘里游啊游",
        "它们似乎在找寻着什么",
        "突然一条蓝色的小鱼冲了过来",
        "它看起来惊惊慌慌的",
        "它对着同伴说快跑后面有敌人",
        "一群小鱼马上四处散开",
        "后面的水一片浑浊",
        "水花四溅",
        "原本平静的水面被打破了",
        "波纹一圈圈地扩散开来",
        "小鱼们有的躲进了荷花的阴影下",
        "有的藏进了水草丛中",
        "有的则迅速潜入了水底",
        "后面的水一片浑浊",
        "原来是一只饥饿的鳟鱼正在追逐着它们",
        "鳟鱼的体型庞大",
        "嘴巴张开",
        "露出锋利的牙齿",
        "它的眼睛紧紧盯着那些四处逃散的小鱼",
        "试图捕捉到一顿美味的午餐",
        "小鱼们凭借着对池塘环境的熟悉",
        "巧妙地躲避着鳟鱼的追捕",
        "它们灵活地穿梭在荷花茎和水草之间",
        "让鳟鱼难以捕捉",
        "经过一番激烈的追逐",
        "鳟鱼似乎意识到了捕捉这些小鱼的困难",
        "最终放弃了追捕",
        "悻悻地游向了别处",
        "池塘再次恢复了平静",
        "小鱼们也从藏身之处小心翼翼地探出头来",
        "确认安全后",
        "它们重新聚集在一起",
        "继续它们的游戏和探索",
        "荷花在微风中轻轻摇曳",
        "仿佛在庆祝小鱼们的智慧和勇气",
        "而池塘又恢复了往日的宁静和美丽",
    ]

    audio_save_to_srt_text(
        "/root/projects/ai-creation/projects/audios/b42cb472-b884-4142-93be-6ea5098cb602.wav",
        subtitles,
        300
    )

if __name__ == "__main__":

    testProjectGenerateVideo()
    # testTextToAudio()
    # testAudioToSrt()
    pass 
