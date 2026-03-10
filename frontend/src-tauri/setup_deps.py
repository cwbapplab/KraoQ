import os
import urllib.request
import zipfile
import subprocess
import sys
import shutil

PYTHON_VER = "3.11.8"
PYTHON_URL = f"https://www.python.org/ftp/python/{PYTHON_VER}/python-{PYTHON_VER}-embed-amd64.zip"
GET_PIP_URL = "https://bootstrap.pypa.io/get-pip.py"
FFMPEG_URL = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
MODEL_URL = "https://github.com/TRvlvr/model_repo/releases/download/all_public_uvr_models/UVR-MDX-NET-Inst_HQ_5.onnx"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PYTHON_DIR = os.path.join(BASE_DIR, "python_env")
BIN_DIR = os.path.join(BASE_DIR, "python", "bin")
MODELS_DIR = os.path.join(BASE_DIR, "python", "models")

def download_file(url, desc):
    print(f"Downloading {url} to {desc}...")
    urllib.request.urlretrieve(url, desc)
    print(f"Downloaded {desc}")

def setup_python():
    os.makedirs(PYTHON_DIR, exist_ok=True)
    zip_path = os.path.join(PYTHON_DIR, "python.zip")
    
    if not os.path.exists(os.path.join(PYTHON_DIR, "python.exe")):
        download_file(PYTHON_URL, zip_path)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(PYTHON_DIR)
        os.remove(zip_path)

        # Modify ._pth file to enable site-packages
        pth_file = os.path.join(PYTHON_DIR, f"python{PYTHON_VER.split('.')[0]}{PYTHON_VER.split('.')[1]}._pth")
        if os.path.exists(pth_file):
            with open(pth_file, 'r') as f:
                lines = f.readlines()
            with open(pth_file, 'w') as f:
                for line in lines:
                    if line.startswith('#import site'):
                        f.write('import site\n')
                    else:
                        f.write(line)
        
        # Download and install pip
        get_pip_path = os.path.join(PYTHON_DIR, "get-pip.py")
        download_file(GET_PIP_URL, get_pip_path)
        subprocess.run([os.path.join(PYTHON_DIR, "python.exe"), get_pip_path], check=True)
        os.remove(get_pip_path)

    # Install requirements
    req_path = os.path.join(BASE_DIR, "python", "requirements.txt")
    python_exe = os.path.join(PYTHON_DIR, "python.exe")
    print("Installing python requirements...")
    subprocess.run([python_exe, "-m", "pip", "install", "-r", req_path], check=True)

def setup_ffmpeg():
    os.makedirs(BIN_DIR, exist_ok=True)
    if not os.path.exists(os.path.join(BIN_DIR, "ffmpeg.exe")):
        zip_path = os.path.join(BIN_DIR, "ffmpeg.zip")
        download_file(FFMPEG_URL, zip_path)
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(BIN_DIR)
        
        ffmpeg_exe = os.path.join(BIN_DIR, "ffmpeg-master-latest-win64-gpl", "bin", "ffmpeg.exe")
        ffprobe_exe = os.path.join(BIN_DIR, "ffmpeg-master-latest-win64-gpl", "bin", "ffprobe.exe")
        
        if os.path.exists(ffmpeg_exe):
            shutil.copy(ffmpeg_exe, os.path.join(BIN_DIR, "ffmpeg.exe"))
        if os.path.exists(ffprobe_exe):
            shutil.copy(ffprobe_exe, os.path.join(BIN_DIR, "ffprobe.exe"))
        
        shutil.rmtree(os.path.join(BIN_DIR, "ffmpeg-master-latest-win64-gpl"), ignore_errors=True)
        os.remove(zip_path)

def setup_models():
    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = os.path.join(MODELS_DIR, "UVR-MDX-NET-Inst_HQ_5.onnx")
    if not os.path.exists(model_path):
        download_file(MODEL_URL, model_path)

if __name__ == "__main__":
    print("Starting setup...")
    setup_python()
    setup_ffmpeg()
    setup_models()
    print("Setup completed successfully.")
