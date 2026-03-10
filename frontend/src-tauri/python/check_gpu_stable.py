import os
import sys

# Try imports first
try:
    import torch
    torch_available = torch.cuda.is_available()
    torch_name = torch.cuda.get_device_name(0) if torch_available else "N/A"
except Exception as e:
    torch_available = f"Error: {e}"
    torch_name = "N/A"

try:
    import onnxruntime as ort
    ort_providers = ort.get_available_providers()
except Exception as e:
    ort_providers = f"Error: {e}"

log_file = r".\gpu_check.txt"
with open(log_file, 'w') as f:
    f.write(f"Python: {sys.version}\n")
    f.write(f"Torch CUDA available: {torch_available}\n")
    f.write(f"CUDA Device: {torch_name}\n")
    f.write(f"ORT providers: {ort_providers}\n")
    f.write(f"PATH: {os.environ.get('PATH', '')}\n")
