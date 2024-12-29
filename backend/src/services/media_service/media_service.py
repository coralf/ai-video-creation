
import os
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import JSONResponse
import torch
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline
from datasets import load_dataset
import uuid

