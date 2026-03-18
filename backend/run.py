import os
import sys
sys.path.insert(0, os.path.dirname(os.getcwd()))
import uvicorn
import src.main

os.environ['CURL_CA_BUNDLE'] = ''

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=8085,
        reload=False,
        log_level="info",
    )
