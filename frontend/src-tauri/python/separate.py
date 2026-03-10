import sys
import os
import json
import traceback
import logging

logging.basicConfig(
    filename="./logs.txt",
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)

def log(msg):
    logging.info(msg)

def add_nvidia_paths():
    paths_to_add = []
    try:
        for path in sys.path:
            cublas_path = os.path.join(path, 'nvidia', 'cublas', 'bin')
            cudnn_path = os.path.join(path, 'nvidia', 'cudnn', 'bin')
            if os.path.isdir(cublas_path): paths_to_add.append(cublas_path)
            if os.path.isdir(cudnn_path): paths_to_add.append(cudnn_path)

        for p in paths_to_add:
            if p not in os.environ['PATH']:
                os.environ['PATH'] = p + os.pathsep + os.environ['PATH']
            try:
                os.add_dll_directory(p)
            except AttributeError:
                pass
    except:
        pass

add_nvidia_paths()

from audio_separator.separator import Separator

def separate(audio_path, output_dir, model_name="UVR-MDX-NET-Inst_HQ_5.onnx"):
    try:
        log(f"--- Starting Separation with audio-separator ---")
        log(f"Input: {audio_path}")
        log(f"Model: {model_name}")
        
        uvr_root = r".\AppData\Local\Programs\Ultimate Vocal Remover"
        uvr_model_dir = os.path.join(uvr_root, "models", "MDX_Net_Models")
        
        if not os.path.exists(uvr_model_dir):
            uvr_model_dir = os.path.join(os.path.dirname(__file__), 'models')
            os.makedirs(uvr_model_dir, exist_ok=True)
            log(f"UVR path not found, using local models dir: {uvr_model_dir}")

        log(f"Model Dir: {uvr_model_dir}")

        if uvr_root not in os.environ['PATH']:
            os.environ['PATH'] = uvr_root + os.pathsep + os.environ['PATH']
            log("Added UVR root to PATH for FFmpeg")

        separator = Separator(
            log_level=20, 
            model_file_dir=uvr_model_dir,
            output_dir=output_dir,
            output_format='mp3'        
        )

        log(f"Loading model {model_name}...")
        separator.load_model(model_filename=model_name)

        log("Running separation...")
        output_files = separator.separate(audio_path)
        
        log(f"Separation finished. Output files: {output_files}")
        
        instrumental = None
        vocals = None

        for f in output_files:
            f_lower = f.lower()
            if "instrumental" in f_lower:
                instrumental = f
            if "vocals" in f_lower:
                vocals = f
        
        result = {
            "instrumental": instrumental,
            "vocals": vocals,
            "files": output_files
        }
        
        log(f"Result: {result}")
        print(json.dumps(result))

    except Exception as e:
        log(f"EXCEPTION: {str(e)}")
        log(traceback.format_exc())
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    audio_path = sys.argv[1]
    output_dir = sys.argv[2]
    model_name = sys.argv[3] if len(sys.argv) > 3 else "UVR-MDX-NET-Inst_HQ_5.onnx"
    
    separate(audio_path, output_dir, model_name)
