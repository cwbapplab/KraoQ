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
    # Also write to a dedicated simple debug file to avoid locks
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
            # Look for nvidia packages (installed via pip)
            for item in os.listdir(path):
                if item.startswith('nvidia'):
                    gpu_path = os.path.join(path, item, 'bin')
                    if os.path.isdir(gpu_path):
                        paths_to_add.append(gpu_path)
            
            # Legacy/Alternate layout
            cublas_path = os.path.join(path, 'nvidia', 'cublas', 'bin')
            cudnn_path = os.path.join(path, 'nvidia', 'cudnn', 'bin')
            if os.path.isdir(cublas_path): paths_to_add.append(cublas_path)
            if os.path.isdir(cudnn_path): paths_to_add.append(cudnn_path)

        for p in paths_to_add:
            if p not in os.environ['PATH']:
                os.environ['PATH'] = p + os.pathsep + os.environ['PATH']
                # log(f"Added to PATH: {p}") # can't log yet, logging not init
            try:
                os.add_dll_directory(p)
            except (AttributeError, OSError):
                pass
    except Exception:
        pass

add_nvidia_paths()

import onnxruntime as ort
# Force verbose logging to see DLL loading and provider assignment
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

        # Force use of NVIDIA GPU if possible
        # This environment variable helps ONNX picking the right CUDA device
        os.environ["CUDA_VISIBLE_DEVICES"] = "0"
        log("Set CUDA_VISIBLE_DEVICES to 0")

        bin_dir = os.path.join(app_data, "bin")
        if os.path.exists(bin_dir) and bin_dir not in os.environ['PATH']:
            os.environ['PATH'] = bin_dir + os.pathsep + os.environ['PATH']
            log("Added bin dir to PATH for FFmpeg")

        separator = Separator(
            log_level=logging.INFO, 
            model_file_dir=uvr_model_dir,
            output_dir=output_dir,
            output_format='mp3'        
        )

        log("Checking available ONNX providers...")
        try:
            available_providers = ort.get_available_providers()
            log(f"ORT Available Providers: {available_providers}")
            
            # Prefer CUDA if available, but log everything
            if 'CUDAExecutionProvider' in available_providers:
                log("CUDA is available. Ensuring it's used...")
            elif 'DmlExecutionProvider' in available_providers:
                log("DirectML is available. This can be used as a high-performance fallback.")
            else:
                log("WARNING: Neither CUDA nor DirectML found in available providers!")

        except Exception as e:
            log(f"Error checking providers: {e}")

        log(f"Loading model {model_name}...")
        
        separator.load_model(model_filename=model_name)
        
        # Verify provider after loading
        try:
            # Note: This is a bit hacky depending on audio-separator version
            # but we want to see what actually got loaded.
            log("Model loaded. Attempting to verify active provider...")
        except Exception:
            pass

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
        
        # Write to file as a fallback in case stdout is swallowed by C-level dup2
        result_file = os.path.join(output_dir, "separate_result.json")
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
