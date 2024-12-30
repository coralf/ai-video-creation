import os
import sys
sys.path.insert(0, os.path.dirname(os.getcwd()))
import uvicorn
import src.main
import torch

# import os
# os.environ['TRANSFORMERS_CACHE'] = '~/.cache/huggingface'  # 替换为你的缓存路径

os.environ['CURL_CA_BUNDLE'] = ''

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",  # 指定FastAPI应用的位置
        host="0.0.0.0",  # 监听所有网络接口
        port=8085,  # 默认端口  
        reload=True,  # 开发模式下自动重载
        log_level="info",  # 日志级别
    )