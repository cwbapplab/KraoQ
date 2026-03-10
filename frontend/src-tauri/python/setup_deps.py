import os
import urllib.request
import zipfile
import subprocess
import sys
import shutil

APP_DATA_DIR = sys.argv[1]
PYTHON_VER = "3.11.8"
GET_PIP_URL = "https://bootstrap.pypa.io/get-pip.py"
FFMPEG_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
MODEL_URL = "https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_5.onnx"

PYTHON_DIR = os.path.join(APP_DATA_DIR, "python_env")
BIN_DIR = os.path.join(APP_DATA_DIR, "bin")
MODELS_DIR = os.path.join(APP_DATA_DIR, "models")
PYTHON_EXE = os.path.join(PYTHON_DIR, "python.exe")

def download_file(url, desc):
    print(f"Downloading {url} to {desc}...")
    urllib.request.urlretrieve(url, desc)
    print(f"Downloaded {desc}")

def setup_pip():
    get_pip_path = os.path.join(PYTHON_DIR, "get-pip.py")
    if not os.path.exists(os.path.join(PYTHON_DIR, "Scripts", "pip.exe")):
        download_file(GET_PIP_URL, get_pip_path)
        subprocess.run([PYTHON_EXE, get_pip_path], check=True)
        try: os.remove(get_pip_path)
        except: pass

    # Install requirements
    req_path = os.path.join(os.path.dirname(__file__), "requirements.txt")
    print("Installing python requirements...")
    subprocess.run([PYTHON_EXE, "-m", "pip", "install", "-r", req_path], check=True)

def setup_ffmpeg():
    os.makedirs(BIN_DIR, exist_ok=True)
    if not os.path.exists(os.path.join(BIN_DIR, "ffmpeg.exe")):
        zip_path = os.path.join(BIN_DIR, "ffmpeg.zip")
        download_file(FFMPEG_URL, zip_path)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(BIN_DIR)
        
        ffmpeg_exe = os.path.join(BIN_DIR, "ffmpeg-master-latest-win64-gpl", "bin", "ffmpeg.exe")
        ffprobe_exe = os.path.join(BIN_DIR, "ffmpeg-master-latest-win64-gpl", "bin", "ffprobe.exe")
        
        if os.path.exists(ffmpeg_exe): shutil.copy(ffmpeg_exe, os.path.join(BIN_DIR, "ffmpeg.exe"))
        if os.path.exists(ffprobe_exe): shutil.copy(ffprobe_exe, os.path.join(BIN_DIR, "ffprobe.exe"))
        
        shutil.rmtree(os.path.join(BIN_DIR, "ffmpeg-master-latest-win64-gpl"), ignore_errors=True)
        os.remove(zip_path)

def setup_models():
    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = os.path.join(MODELS_DIR, "UVR-MDX-NET-Inst_HQ_5.onnx")
    if not os.path.exists(model_path):
        download_file(MODEL_URL, model_path)

if __name__ == "__main__":
    print("Starting python dependencies setup...")
    setup_pip()
    setup_ffmpeg()
    setup_models()
    print("Setup completed successfully.")
