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

        # torch bundles its own CUDA/cuDNN/cuBLAS DLLs; make them visible so the
        # ONNX Runtime CUDA execution provider can load against them.
        try:
            import torch
            torch_lib = os.path.join(os.path.dirname(torch.__file__), 'lib')
            if os.path.isdir(torch_lib):
                paths_to_add.append(torch_lib)
        except Exception:
            pass

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
        
        # Check if separation products already exist
        final_inst = os.path.join(output_dir, f"{audio_base}_(Instrumental).mp3")
        final_voc = os.path.join(output_dir, f"{audio_base}_(Vocals).mp3")
        elrc_file = os.path.join(output_dir, f"{audio_base}.elrc")

        if os.path.exists(final_inst) and os.path.exists(final_voc) and not os.path.exists(elrc_file):
            log_safe(f"Skipping separation: Instrumental and Vocals already exist for '{audio_base}' and .elrc is missing.")
            result = {
                "instrumental": os.path.basename(final_inst),
                "vocals": os.path.basename(final_voc),
                "files": [os.path.basename(final_inst), os.path.basename(final_voc)]
            }
            try:
                with open(result_file, "w", encoding="utf-8") as f:
                    json.dump(result, f)
            except Exception as file_e:
                log_safe(f"Failed to write existing result file: {file_e}")
            
            sys.__stdout__.write(json.dumps(result) + "\n")
            sys.__stdout__.flush()
            return

        def run_single_separation(preset_name, suffix):
            log_safe(f"Starting run for {suffix} (preset={preset_name})...")
            
            if preset_name == "none":
                # Force the usage of UVR-MDX-NET-Inst_HQ_5.onnx. The model returns
                # both stems natively, so we never use spectral inversion (which
                # attempted a 142 GiB allocation on long tracks).
                log_safe(f"Force running UVR-MDX-NET-Inst_HQ_5.onnx...")
                
                sep = Separator(
                    log_level=logging.INFO, 
                    model_file_dir=uvr_model_dir,
                    output_dir=output_dir,
                    output_format='mp3'
                )
                
                # Apply GPU patch to avoid crashes if needed to instantiate raw model providers
                available_providers = ort.get_available_providers()
                if gpu_enabled and 'CUDAExecutionProvider' in available_providers:
                    sep.onnx_execution_provider = [
                        ("CUDAExecutionProvider", {"device_id": 0}),
                        "CPUExecutionProvider"
                    ]
                    import torch
                    if torch.cuda.is_available():
                        sep.torch_device = torch.device("cuda")
                
                sep.load_model(model_filename="UVR-MDX-NET-Inst_HQ_5.onnx")
            else:
                # Create instance with the specified ensemble_preset
                sep = Separator(
                    log_level=logging.INFO, 
                    model_file_dir=uvr_model_dir,
                    output_dir=output_dir,
                    output_format='mp3',
                    ensemble_preset=preset_name
                )
                log_safe(f"Loading models for preset {preset_name}...")
                sep.load_model()
            
            custom_names = {
                "instrumental": f"{audio_base}_inst_{suffix}",
                "vocals": f"{audio_base}_voc_{suffix}"
            }
            
            log_safe(f"Running separation for {suffix} with preset {preset_name}...")
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

        isolate_vocals = os.getenv("ISOLATE_VOCALS", "1") == "1"
        log_safe(f"Isolate Vocals setting: {isolate_vocals}")

        inst_preset = os.getenv("INST_PRESET", "instrumental_clean")
        voc_preset = os.getenv("VOC_PRESET", "vocal_clean")
        # Two heavy runs at once oversubscribe a single GPU (contention/OOM); run
        # them sequentially unless explicitly enabled.
        parallel = os.getenv("KRAOQ_PARALLEL_SEPARATION", "0") == "1"
        log_safe(f"Parallel separation: {parallel}")

        res_voc = None
        single_model = inst_preset == "none" and isolate_vocals and voc_preset == "none"
        if single_model:
            # One model produces both stems — a single pass is enough.
            log_safe("Single-model preset 'none' for both stems. Running one pass.")
            res_inst = run_single_separation("none", "inst")
            res_voc = res_inst
        elif isolate_vocals:
            if parallel:
                with ThreadPoolExecutor(max_workers=2) as executor:
                    fut_inst = executor.submit(run_single_separation, inst_preset, "inst")
                    fut_voc = executor.submit(run_single_separation, voc_preset, "voc")

                    res_inst = fut_inst.result()
                    res_voc = fut_voc.result()
            else:
                res_inst = run_single_separation(inst_preset, "inst")
                res_voc = run_single_separation(voc_preset, "voc")
        else:
            log_safe("Skipping vocal isolation run (ISOLATE_VOCALS=0).")
            res_inst = run_single_separation(inst_preset, "inst")

        # Combine results:
        # Instrumental from the instrumental run, Vocals from the vocal run.
        inst_file = res_inst["instrumental"]
        final_inst = os.path.join(output_dir, f"{audio_base}_(Instrumental).mp3")
        if os.path.exists(inst_file):
            if os.path.exists(final_inst):
                os.remove(final_inst)
            os.rename(inst_file, final_inst)
            log_safe(f"Renamed instrumental to {final_inst}")

        final_voc = None
        if res_voc is not None:
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
            if res_voc is not None and os.path.exists(res_voc["instrumental"]): os.remove(res_voc["instrumental"])
        except:
            pass

        result = {
            "instrumental": os.path.basename(final_inst),
            "vocals": os.path.basename(final_voc) if final_voc else None,
            "files": [os.path.basename(final_inst)] + ([os.path.basename(final_voc)] if final_voc else [])
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
