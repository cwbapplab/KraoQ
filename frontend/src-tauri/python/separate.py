import sys
import os
import json
import traceback
import logging

output_dir_arg = sys.argv[2] if len(sys.argv) > 2 else "."
logging.basicConfig(
    filename=os.path.join(output_dir_arg, "logs.txt"),
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)

def log(msg):
    logging.info(msg)
    try:
        debug_file = os.path.join(output_dir_arg, "gpu_debug.txt")
        with open(debug_file, "a", encoding="utf-8") as f:
            f.write(str(msg) + "\n")
    except:
        pass

def add_nvidia_paths():
    paths_to_add = []
    try:
        import sys
        import os
        for path in sys.path:
            if not os.path.isdir(path): continue
            for item in os.listdir(path):
                if item.startswith('nvidia'):
                    gpu_path = os.path.join(path, item, 'bin')
                    if os.path.isdir(gpu_path):
                        paths_to_add.append(gpu_path)
            
            cublas_path = os.path.join(path, 'nvidia', 'cublas', 'bin')
            cudnn_path = os.path.join(path, 'nvidia', 'cudnn', 'bin')
            if os.path.isdir(cublas_path): paths_to_add.append(cublas_path)
            if os.path.isdir(cudnn_path): paths_to_add.append(cudnn_path)

        for p in paths_to_add:
            if p not in os.environ['PATH']:
                os.environ['PATH'] = p + os.pathsep + os.environ['PATH']
            try:
                os.add_dll_directory(p)
            except (AttributeError, OSError):
                pass
    except Exception:
        pass

add_nvidia_paths()

import onnxruntime as ort
ort.set_default_logger_severity(0)

from audio_separator.separator import Separator

def separate(audio_path, output_dir, model_name="UVR-MDX-NET-Inst_HQ_5.onnx", result_file=None):
    if not result_file:
        result_file = os.path.join(output_dir, "separate_result.json")
    try:
        log(f"--- Starting Separation with audio-separator ---")
        log(f"Input: {audio_path}")
        log(f"Model: {model_name}")
        
        app_data = os.environ.get('APP_DATA_DIR', os.path.dirname(__file__))
        uvr_model_dir = os.path.join(app_data, "models")
        
        if not os.path.exists(uvr_model_dir):
            uvr_model_dir = os.path.join(output_dir, 'models')
            os.makedirs(uvr_model_dir, exist_ok=True)
            log(f"Using local models dir: {uvr_model_dir}")

        log(f"Model Dir: {uvr_model_dir}")

        gpu_enabled = os.environ.get("GPU_ENABLED", "1") == "1"
        log(f"GPU Enabled setting: {gpu_enabled}")

        if gpu_enabled:
            os.environ["CUDA_VISIBLE_DEVICES"] = "0"
            log("Set CUDA_VISIBLE_DEVICES to 0")
        else:
            os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
            log("GPU Disabled. Set CUDA_VISIBLE_DEVICES to -1")

        bin_dir = os.path.join(app_data, "bin")
        if os.path.exists(bin_dir) and bin_dir not in os.environ['PATH']:
            os.environ['PATH'] = bin_dir + os.pathsep + os.environ['PATH']
            log("Added bin dir to PATH for FFmpeg")

        # --- GPU ENFORCEMENT ---
        # The Separator class determines GPU usage internally by checking
        # torch.cuda.is_available(). If PyTorch was installed as CPU-only,
        # it returns False and the Separator falls back to CPU for BOTH 
        # PyTorch and ONNX Runtime — even when onnxruntime-gpu is installed
        # and CUDAExecutionProvider is available.
        #
        # To fix this, we monkey-patch the Separator's device setup AFTER
        # construction so that ONNX Runtime uses CUDA when available,
        # regardless of the PyTorch build.

        separator = Separator(
            log_level=logging.INFO, 
            model_file_dir=uvr_model_dir,
            output_dir=output_dir,
            output_format='mp3'        
        )

        if gpu_enabled:
            available_providers = ort.get_available_providers()
            log(f"ORT Available Providers: {available_providers}")

            if 'CUDAExecutionProvider' in available_providers:
                log("CUDA provider available — forcing ONNX to use CUDAExecutionProvider")
                separator.onnx_execution_provider = [
                    ("CUDAExecutionProvider", {"device_id": 0}),
                    "CPUExecutionProvider"
                ]
                # Also ensure torch device is set to CUDA if possible
                import torch
                if torch.cuda.is_available():
                    separator.torch_device = torch.device("cuda")
                    log("PyTorch CUDA is available — torch_device set to cuda")
                else:
                    log("PyTorch CUDA NOT available — torch_device stays CPU, but ONNX will use CUDA")
            elif 'DmlExecutionProvider' in available_providers:
                log("DirectML provider available — forcing ONNX to use DmlExecutionProvider")
                separator.onnx_execution_provider = ["DmlExecutionProvider", "CPUExecutionProvider"]
            else:
                log("WARNING: No GPU execution provider found in ONNX Runtime!")
                log(f"Only available: {available_providers}")
        else:
            log("GPU disabled by user setting. Using CPU only.")
            separator.onnx_execution_provider = ["CPUExecutionProvider"]
            import torch
            separator.torch_device = torch.device("cpu")

        log(f"Final onnx_execution_provider: {separator.onnx_execution_provider}")
        log(f"Final torch_device: {separator.torch_device}")

        log(f"Loading model {model_name}...")
        separator.load_model(model_filename=model_name)
        
        log("Model loaded successfully.")

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
        
        try:
            with open(result_file, "w", encoding="utf-8") as f:
                json.dump(result, f)
        except Exception as file_e:
            log(f"Failed to write result file: {file_e}")

        sys.__stdout__.write(json.dumps(result) + "\n")
        sys.__stdout__.flush()
        try:
            print(json.dumps(result), flush=True)
        except Exception:
            pass

    except Exception as e:
        log(f"EXCEPTION: {str(e)}")
        log(traceback.format_exc())
        
        err_dict = {"error": str(e)}
        try:
            with open(result_file, "w", encoding="utf-8") as f:
                json.dump(err_dict, f)
        except Exception:
            pass

        sys.__stdout__.write(json.dumps(err_dict) + "\n")
        sys.__stdout__.flush()
        try:
            print(json.dumps(err_dict), flush=True)
        except Exception:
            pass
        sys.exit(1)

if __name__ == "__main__":
    audio_path = sys.argv[1]
    output_dir = sys.argv[2]
    model_name = sys.argv[3] if len(sys.argv) > 3 else "UVR-MDX-NET-Inst_HQ_5.onnx"
    result_file = sys.argv[4] if len(sys.argv) > 4 else os.path.join(output_dir, "separate_result.json")
    
    separate(audio_path, output_dir, model_name, result_file)
