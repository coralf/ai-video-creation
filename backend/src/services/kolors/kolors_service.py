import pip
import os, time, torch

# from PIL import Image
from backend.src.services.kolors.pipeline_stable_diffusion_xl_chatglm_256 import (
    StableDiffusionXLPipeline,
)
from .models.modeling_chatglm import ChatGLMModel
from .models.tokenization_chatglm import ChatGLMTokenizer
from diffusers import UNet2DConditionModel, AutoencoderKL
from diffusers import EulerDiscreteScheduler

# 获取当前脚本路径的上一级目录
# os.path.abspath(__file__)当前文件脚本路径的上一级目录
# os.path.dirname(path) 获取当前文件的目录，如果当前是目录则返回路径的上一级目录
# root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

projectDir = os.getcwd()
_pipe = None


def load_pipe():
    global _pipe
    if _pipe is not None:
        return _pipe
    ckpt_dir = os.path.join(projectDir, "weights", "Kolors")
    vae = AutoencoderKL.from_pretrained(
        f"{ckpt_dir}/vae", revision=None, variant="fp16"
    ).half()
    unet = UNet2DConditionModel.from_pretrained(
        f"{ckpt_dir}/unet", revision=None, variant="fp16"
    ).half()
    text_encoder = ChatGLMModel.from_pretrained(
        f"{ckpt_dir}/text_encoder",
        torch_dtype=torch.float16,
    ).half()
    tokenizer = ChatGLMTokenizer.from_pretrained(f"{ckpt_dir}/text_encoder")
    scheduler = EulerDiscreteScheduler.from_pretrained(f"{ckpt_dir}/scheduler")
    pipe = StableDiffusionXLPipeline(
        vae=vae,
        text_encoder=text_encoder,
        tokenizer=tokenizer,
        unet=unet,
        scheduler=scheduler,
        force_zeros_for_empty_prompt=False,
    )
    pipe = pipe.to("cuda")
    pipe.enable_model_cpu_offload()
    _pipe = pipe


def infer(
    prompt,
    width,
    height,
    num_inference_steps,
    guidance_scale,
    num_images_per_prompt,
    seed,
):
    global _pipe

    images = _pipe(
        prompt=prompt,
        height=height,
        width=width,
        num_inference_steps=num_inference_steps,
        guidance_scale=guidance_scale,
        num_images_per_prompt=num_images_per_prompt,
        generator=torch.Generator(_pipe.device).manual_seed(seed),
    ).images

    output_dir = os.path.join(projectDir, "outputs")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir, exist_ok=True)

    now = int(time.time())
    for i in range(len(images)):
        filename = f"sample_{now}_{i}.jpg"
        path_file = os.path.join(output_dir, filename)
        images[i].save(path_file)

    return output_dir, images
