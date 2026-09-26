import os
import sys
import re
import json
import glob
import ctypes
import zipfile
import importlib.metadata as metadata


def add_nvidia_paths():
    """Make bundled CUDA/cuDNN DLLs visible to ONNX Runtime.

    Checks each site-packages entry for nvidia-* runtime dirs, and also
    torch's bundled lib directory (which carries cublas/cudnn/cudart).
    """
    paths_to_add = []
    try:
        scan_dirs = list(sys.path)
        try:
            import torch  # noqa: F401
            scan_dirs.append(os.path.join(os.path.dirname(torch.__file__), "lib"))
        except Exception:
            pass

        for base in scan_dirs:
            if not base or not os.path.isdir(base):
                continue
            torch_lib = os.path.join(base, "lib")
            if os.path.isdir(torch_lib):
                paths_to_add.append(torch_lib)
            try:
                for item in os.listdir(base):
                    if item.startswith("nvidia"):
                        bin_dir = os.path.join(base, item, "bin")
                        if os.path.isdir(bin_dir):
                            paths_to_add.append(bin_dir)
            except Exception:
                pass
            cublas = os.path.join(base, "nvidia", "cublas", "bin")
            cudnn = os.path.join(base, "nvidia", "cudnn", "bin")
            if os.path.isdir(cublas):
                paths_to_add.append(cublas)
            if os.path.isdir(cudnn):
                paths_to_add.append(cudnn)

        for p in paths_to_add:
            if p not in os.environ.get("PATH", ""):
                os.environ["PATH"] = p + os.pathsep + os.environ.get("PATH", "")
            try:
                os.add_dll_directory(p)
            except (AttributeError, OSError):
                pass
    except Exception:
        pass


def cuda_major(version):
    if not version:
        return None
    m = re.match(r"(\d+)", str(version))
    return m.group(1) if m else None


def ckpt_ok(path):
    """Cheap integrity check that tolerates both zip and legacy pickle checkpoints."""
    try:
        with open(path, "rb") as f:
            head = f.read(4)
        if head[:2] == b"PK":
            return zipfile.is_zipfile(path)
        if head[:1] == b"\x80":
            return True
        return False
    except Exception:
        return False


def main():
    app_data = os.environ.get("APP_DATA_DIR", os.path.dirname(__file__))
    models_dir = os.environ.get("APP_MODELS_DIR", os.path.join(app_data, "models"))

    add_nvidia_paths()

    torch_info = {
        "version": None, "cuda_build": None, "available": False, "device": None,
        "capability": None, "arch_list": [], "kernel_ok": False, "error": None,
    }
    try:
        import torch
        torch_info["version"] = torch.__version__
        torch_info["cuda_build"] = torch.version.cuda
        torch_info["available"] = bool(torch.cuda.is_available())
        if torch_info["available"]:
            torch_info["device"] = torch.cuda.get_device_name(0)
            cap = torch.cuda.get_device_capability(0)
            torch_info["capability"] = f"{cap[0]}.{cap[1]}"
            try:
                torch_info["arch_list"] = list(torch.cuda.get_arch_list())
            except Exception:
                pass
            try:
                x = torch.randn(8, 8, device="cuda")
                _ = (x @ x).sum().item()
                torch.cuda.synchronize()
                torch_info["kernel_ok"] = True
            except Exception as e:
                torch_info["error"] = str(e).strip().splitlines()[0]
    except Exception as e:
        torch_info["error"] = str(e)

    onnx_info = {
        "package_version": None, "available_providers": [], "active_providers": [],
        "cuda_active": False, "provider_dll": None, "missing_dll": None, "error": None,
    }
    try:
        import onnxruntime as ort
        try:
            onnx_info["package_version"] = metadata.version("onnxruntime-gpu")
        except Exception:
            onnx_info["package_version"] = getattr(ort, "__version__", None)
        try:
            onnx_info["available_providers"] = list(ort.get_available_providers())
        except Exception:
            onnx_info["available_providers"] = []

        provider_dll = os.path.join(os.path.dirname(ort.__file__), "capi", "onnxruntime_providers_cuda.dll")
        onnx_info["provider_dll"] = provider_dll
        if os.path.exists(provider_dll) and hasattr(ctypes, "WinDLL"):
            try:
                ctypes.WinDLL(provider_dll)
            except OSError as e:
                msg = str(e)
                m = re.search(r'depends on "([^"]+)"', msg)
                if not m:
                    m = re.search(r'"([^"]+\.dll)"', msg)
                onnx_info["missing_dll"] = m.group(1) if m else None
                onnx_info["error"] = msg

        model = os.path.join(models_dir, "UVR-MDX-NET-Inst_HQ_5.onnx")
        if not os.path.exists(model):
            candidates = glob.glob(os.path.join(models_dir, "*.onnx"))
            model = candidates[0] if candidates else None

        if "CUDAExecutionProvider" in onnx_info["available_providers"]:
            if model:
                try:
                    so = ort.SessionOptions()
                    so.log_severity_level = 3
                    sess = ort.InferenceSession(
                        model,
                        sess_options=so,
                        providers=[("CUDAExecutionProvider", {"device_id": 0}), "CPUExecutionProvider"],
                    )
                    active = list(sess.get_providers())
                    onnx_info["active_providers"] = active
                    onnx_info["cuda_active"] = "CUDAExecutionProvider" in active
                except Exception as e:
                    onnx_info["error"] = str(e)
            elif not onnx_info["error"]:
                onnx_info["error"] = "No ONNX model available for activation test"
    except Exception as e:
        onnx_info["error"] = str(e)

    # Expected CUDA major for the installed onnxruntime-gpu build.
    onnx_cuda_major = None
    try:
        dist = metadata.distribution("onnxruntime-gpu")
        for req in (dist.requires or []):
            m = re.search(r"nvidia-cuda-runtime(?:-cu\d+)?\s*~=\s*(\d+)", req)
            if m:
                onnx_cuda_major = m.group(1)
                break
    except Exception:
        pass
    if onnx_cuda_major is None and onnx_info["package_version"]:
        m = re.match(r"(\d+)\.(\d+)", onnx_info["package_version"])
        if m:
            minor = int(m.group(2))
            onnx_cuda_major = "12" if minor <= 26 else "13"

    torch_cuda_major = cuda_major(torch_info["cuda_build"])
    compat = {
        "torch_cuda_major": torch_cuda_major,
        "onnx_cuda_major": onnx_cuda_major,
        "match": (torch_cuda_major == onnx_cuda_major) if (torch_cuda_major and onnx_cuda_major) else None,
    }

    # Word-level lyric sync (stable-ts imports torchaudio). torchaudio shares torch's
    # version numbers, so an unpinned install pulls a newer build whose native
    # extension fails to load against the pinned torch — word-by-word highlighting
    # then silently falls back to plain, uncolored text.
    alignment_info = {
        "ok": False, "torch_version": None, "torchaudio_version": None,
        "stable_ts_version": None, "error": None,
    }
    try:
        alignment_info["stable_ts_version"] = metadata.version("stable-ts")
    except Exception:
        pass
    try:
        import torch  # noqa: F401
        alignment_info["torch_version"] = torch_info["version"] or getattr(torch, "__version__", None)
        import torchaudio  # noqa: F401
        alignment_info["torchaudio_version"] = getattr(torchaudio, "__version__", None)
        alignment_info["ok"] = True
    except Exception as e:
        lines = [l for l in str(e).strip().splitlines() if l.strip()]
        alignment_info["error"] = lines[-1] if lines else str(e)
    if alignment_info["torchaudio_version"] is None:
        try:
            alignment_info["torchaudio_version"] = metadata.version("torchaudio")
        except Exception:
            pass
    if alignment_info["ok"] and alignment_info["stable_ts_version"] is None:
        alignment_info["ok"] = False
        alignment_info["error"] = "stable-ts is not installed"

    invalid_models = []
    for f in sorted(glob.glob(os.path.join(models_dir, "*.ckpt"))):
        if not ckpt_ok(f):
            invalid_models.append(os.path.basename(f))
    for f in sorted(glob.glob(os.path.join(models_dir, "*.onnx"))):
        try:
            if os.path.getsize(f) < 1024:
                invalid_models.append(os.path.basename(f))
        except Exception:
            invalid_models.append(os.path.basename(f))

    issues = []

    if not torch_info["available"]:
        issues.append({
            "id": "torch_cuda_unavailable",
            "severity": "error",
            "title": "PyTorch cannot see the GPU",
            "detail": torch_info["error"] or "torch.cuda.is_available() returned False",
            "fix_id": "torch",
        })
    elif not torch_info["kernel_ok"]:
        issues.append({
            "id": "torch_kernel_missing",
            "severity": "error",
            "title": "GPU detected but PyTorch cannot execute on it",
            "detail": torch_info["error"] or "CUDA kernel test failed",
            "fix_id": "torch",
        })

    cuda_provider_available = "CUDAExecutionProvider" in onnx_info["available_providers"]
    if cuda_provider_available and not onnx_info["cuda_active"]:
        parts = []
        if onnx_info["missing_dll"]:
            parts.append(f"ONNX Runtime needs {onnx_info['missing_dll']}, which is missing.")
        elif onnx_info["error"]:
            parts.append(onnx_info["error"])
        else:
            parts.append("CUDAExecutionProvider failed to activate.")
        if compat["match"] is False:
            parts.append(
                f"onnxruntime-gpu {onnx_info['package_version']} targets CUDA {compat['onnx_cuda_major']}, "
                f"but PyTorch provides CUDA {compat['torch_cuda_major']}."
            )
        issues.append({
            "id": "onnx_cuda_inactive",
            "severity": "error",
            "title": "ONNX Runtime is running on CPU",
            "detail": " ".join(parts),
            "fix_id": "onnxruntime",
        })
    elif compat["match"] is False:
        issues.append({
            "id": "onnx_cuda_mismatch",
            "severity": "error",
            "title": "ONNX Runtime / PyTorch CUDA version mismatch",
            "detail": (
                f"onnxruntime-gpu {onnx_info['package_version']} targets CUDA {compat['onnx_cuda_major']}, "
                f"but PyTorch provides CUDA {compat['torch_cuda_major']}."
            ),
            "fix_id": "onnxruntime",
        })

    if invalid_models:
        issues.append({
            "id": "invalid_model",
            "severity": "warning",
            "title": "Corrupt model file detected",
            "detail": ", ".join(invalid_models) + " is invalid and will be re-downloaded.",
            "fix_id": "models",
        })

    if not alignment_info["ok"]:
        detail = alignment_info["error"] or "stable-ts/torchaudio could not be imported"
        ta = alignment_info["torchaudio_version"]
        tv = alignment_info["torch_version"]
        if ta and tv and ta.split("+")[0] != tv.split("+")[0]:
            detail = f"torchaudio {ta} is incompatible with torch {tv}. {detail}"
        issues.append({
            "id": "word_alignment_unavailable",
            "severity": "warning",
            "title": "Word-by-word lyric sync is unavailable",
            "detail": detail,
            "fix_id": "torchaudio",
        })

    if not torch_info["available"] and not onnx_info["cuda_active"]:
        status = "unavailable"
    elif any(i["severity"] == "error" for i in issues):
        status = "degraded"
    elif issues:
        status = "degraded"
    else:
        status = "ok"

    report = {
        "torch": torch_info,
        "onnx": onnx_info,
        "compat": compat,
        "alignment": alignment_info,
        "invalid_models": invalid_models,
        "cpu_count": os.cpu_count(),
        "status": status,
        "issues": issues,
    }

    sys.stdout.write(json.dumps(report) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        sys.stdout.write(json.dumps({"status": "unavailable", "issues": [], "error": str(e)}) + "\n")
        sys.stdout.flush()
