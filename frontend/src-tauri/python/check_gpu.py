import torch
import onnxruntime as ort
import os
import sys

log_file = os.path.join(os.environ.get('APPDATA', '.'), 'com.cwbapplab.kraoq', 'gpu_check.txt')
with open(log_file, 'w') as f:
    f.write(f"Python: {sys.version}\n")
    f.write(f"Torch CUDA available: {torch.cuda.is_available()}\n")
    if torch.cuda.is_available():
        f.write(f"CUDA Device: {torch.cuda.get_device_name(0)}\n")
    f.write(f"ORT providers: {ort.get_available_providers()}\n")
    f.write(f"CWD: {os.getcwd()}\n")
    f.write(f"PATH: {os.environ.get('PATH', '')}\n")
