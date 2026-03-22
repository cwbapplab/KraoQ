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

import threading
from concurrent.futures import ThreadPoolExecutor

log_lock = threading.Lock()

def log_safe(msg):
    logging.info(msg)
    try:
        debug_file = os.path.join(output_dir_arg, "gpu_debug.txt")
        with log_lock:
            with open(debug_file, "a", encoding="utf-8") as f:
                f.write(str(msg) + "\n")
    except:
        pass

def separate(audio_path, output_dir, model_name="UVR-MDX-NET-Inst_HQ_5.onnx", result_file=None):
    if not result_file:
        result_file = os.path.join(output_dir, "separate_result.json")
    try:
        log_safe(f"--- Starting Parallel Separation with audio-separator ---")
        log_safe(f"Input: {audio_path}")
        log_safe(f"Model: {model_name}")
        
        app_data = os.environ.get('APP_DATA_DIR', os.path.dirname(__file__))
        uvr_model_dir = os.path.join(app_data, "models")
        
        if not os.path.exists(uvr_model_dir):
            uvr_model_dir = os.path.join(output_dir, 'models')
            os.makedirs(uvr_model_dir, exist_ok=True)
            log_safe(f"Using local models dir: {uvr_model_dir}")

        gpu_enabled = os.environ.get("GPU_ENABLED", "1") == "1"
        log_safe(f"GPU Enabled setting: {gpu_enabled}")

        if gpu_enabled:
            os.environ["CUDA_VISIBLE_DEVICES"] = "0"
        else:
            os.environ["CUDA_VISIBLE_DEVICES"] = "-1"

        bin_dir = os.path.join(app_data, "bin")
        if os.path.exists(bin_dir) and bin_dir not in os.environ['PATH']:
            os.environ['PATH'] = bin_dir + os.pathsep + os.environ['PATH']

        audio_base = os.path.splitext(os.path.basename(audio_path))[0]

        def run_single_separation(invert_spec, suffix):
            log_safe(f"Starting run for {suffix} (invert_using_spec={invert_spec})...")
            
            # Create a separate instance for thread safety
            sep = Separator(
                log_level=logging.INFO, 
                model_file_dir=uvr_model_dir,
                output_dir=output_dir,
                output_format='mp3',
                invert_using_spec=invert_spec
            )

            # Apply GPU patch to the instance
            if gpu_enabled:
                available_providers = ort.get_available_providers()
                if 'CUDAExecutionProvider' in available_providers:
                    sep.onnx_execution_provider = [
                        ("CUDAExecutionProvider", {"device_id": 0}),
                        "CPUExecutionProvider"
                    ]
                    import torch
                    if torch.cuda.is_available():
                        sep.torch_device = torch.device("cuda")
                elif 'DmlExecutionProvider' in available_providers:
                    sep.onnx_execution_provider = ["DmlExecutionProvider", "CPUExecutionProvider"]
                else:
                    sep.onnx_execution_provider = ["CPUExecutionProvider"]
            else:
                sep.onnx_execution_provider = ["CPUExecutionProvider"]
                import torch
                sep.torch_device = torch.device("cpu")

            sep.load_model(model_filename=model_name)
            
            custom_names = {
                "instrumental": f"{audio_base}_inst_{suffix}",
                "vocals": f"{audio_base}_voc_{suffix}"
            }
            
            log_safe(f"Running separation for {suffix}...")
            output_files = sep.separate(audio_path, custom_output_names=custom_names)
            log_safe(f"Run {suffix} finished. Output files: {output_files}")
            
            inst_found = None
            voc_found = None
            for f in output_files:
                f_basename = os.path.basename(f)
                if f"_inst_{suffix}" in f_basename:
                    inst_found = f_basename
                if f"_voc_{suffix}" in f_basename:
                    voc_found = f_basename

            # Fallback if not found in list
            if not inst_found:
                inst_found = f"{audio_base}_inst_{suffix}.mp3"
            if not voc_found:
                voc_found = f"{audio_base}_voc_{suffix}.mp3"
                
            return {
                "instrumental": os.path.join(output_dir, inst_found),
                "vocals": os.path.join(output_dir, voc_found),
                "files": output_files
            }

        with ThreadPoolExecutor(max_workers=2) as executor:
            # Future 1: Standard (optimistic for instrumental)
            fut_inst = executor.submit(run_single_separation, False, "inst")
            # Future 2: Spec Invert (optimized for vocals)
            fut_voc = executor.submit(run_single_separation, True, "voc")

            res_inst = fut_inst.result()
            res_voc = fut_voc.result()

        # Combine results:
        # Instrumental from standard run, Vocals from spec invert run
        inst_file = res_inst["instrumental"]
        final_inst = os.path.join(output_dir, f"{audio_base}_(Instrumental).mp3")
        if os.path.exists(inst_file):
            if os.path.exists(final_inst):
                os.remove(final_inst)
            os.rename(inst_file, final_inst)
            log_safe(f"Renamed instrumental to {final_inst}")

        voc_file = res_voc["vocals"]
        final_voc = os.path.join(output_dir, f"{audio_base}_(Vocals).mp3")
        if os.path.exists(voc_file):
            if os.path.exists(final_voc):
                os.remove(final_voc)
            os.rename(voc_file, final_voc)
            log_safe(f"Renamed vocals to {final_voc}")

        # Clean up other files
        try:
            # Delete intermediate files that were not used
            if os.path.exists(res_inst["vocals"]): os.remove(res_inst["vocals"])
            if os.path.exists(res_voc["instrumental"]): os.remove(res_voc["instrumental"])
        except:
            pass

        result = {
            "instrumental": os.path.basename(final_inst),
            "vocals": os.path.basename(final_voc),
            "files": [os.path.basename(final_inst), os.path.basename(final_voc)]
        }
        
        log_safe(f"Result: {result}")
        
        try:
            with open(result_file, "w", encoding="utf-8") as f:
                json.dump(result, f)
        except Exception as file_e:
            log_safe(f"Failed to write result file: {file_e}")

        sys.__stdout__.write(json.dumps(result) + "\n")
        sys.__stdout__.flush()
        try:
            print(json.dumps(result), flush=True)
        except Exception:
            pass

    except Exception as e:
        log_safe(f"EXCEPTION: {str(e)}")
        import traceback
        log_safe(traceback.format_exc())
        
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
