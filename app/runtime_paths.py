from __future__ import annotations

import os
import shutil
import sys
import logging
import zipfile
from pathlib import Path
from typing import Any, Dict, Iterable, Optional

logger = logging.getLogger(__name__)

APP_NAME = "VODInsights"


def is_frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def get_exe_dir() -> Path:
    return Path(sys.executable).resolve().parent


def get_app_root() -> Path:
    if hasattr(sys, "_MEIPASS"):
        candidate = Path(sys._MEIPASS) / "app"
        if candidate.exists():
            return candidate
    return Path(__file__).resolve().parent


def get_project_root() -> Path:
    if is_frozen():
        return get_exe_dir()
    return Path(__file__).resolve().parent.parent


def get_install_dir() -> Path:
    """Get the application installation directory.
    
    For packaged apps, this is where the .exe is located.
    For dev, this returns the project root.
    Can be overridden with AET_INSTALL_DIR environment variable.
    """
    env_dir = os.environ.get("AET_INSTALL_DIR")
    if env_dir:
        candidate = Path(env_dir)
        if candidate.exists():
            return candidate
    if is_frozen():
        return get_exe_dir()
    return get_project_root()


def _get_app_data_base() -> Path:
    env_path = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA")
    if env_path:
        return Path(env_path)
    return Path.home() / "AppData" / "Roaming"


def get_app_data_dir() -> Path:
    env_dir = os.environ.get("AET_APPDATA_DIR")
    if env_dir:
        return Path(env_dir)
    env_base = os.environ.get("AET_APPDATA_BASE")
    if env_base:
        return Path(env_base) / APP_NAME
    return _get_app_data_base() / APP_NAME


def ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def get_default_config_path() -> Path:
    return get_app_root() / "config.json"


def get_config_path(create: bool = True) -> Path:
    config_path = get_app_data_dir() / "config.json"
    if create:
        ensure_dir(config_path.parent)
        if not config_path.exists():
            default_path = get_default_config_path()
            if default_path.exists():
                config_path.write_text(default_path.read_text(encoding="utf-8"), encoding="utf-8")
    return config_path


def resolve_log_path(config_path: Path, filename: str) -> Path:
    default_config = get_config_path(create=False).resolve()
    try:
        if config_path.resolve() == default_config:
            return get_app_data_dir() / filename
    except FileNotFoundError:
        pass
    return config_path.parent / filename


def reset_log_file(path: Path) -> None:
    try:
        if path.exists():
            path.unlink()
    except Exception:
        logger.exception("Failed to reset log file: %s", path)


def get_downloads_dir() -> Path:
    return ensure_dir(get_app_data_dir() / "downloads")


def get_uploads_dir() -> Path:
    return ensure_dir(get_app_data_dir() / "uploads")


def get_easyocr_models_dir() -> Path:
    return get_app_data_dir() / "easyocr_models"


def get_gpu_ocr_packages_dir() -> Path:
    return get_app_data_dir() / "python_packages"


def ensure_easyocr_models() -> Path:
    target_dir = ensure_dir(get_easyocr_models_dir())
    bundled_candidates = [get_app_root() / "easyocr_models"]
    for candidate in bundled_candidates:
        if candidate.exists():
            try:
                shutil.copytree(candidate, target_dir, dirs_exist_ok=True)
            except Exception:
                logger.exception("Failed to copy EasyOCR models from %s", candidate)
            break
    return target_dir


def get_tools_dirs() -> list[Path]:
    candidates = [get_exe_dir() / "tools"]
    candidates.append(get_exe_dir().parent / "tools")
    if hasattr(sys, "_MEIPASS"):
        candidates.append(Path(sys._MEIPASS) / "tools")
    candidates.append(get_project_root() / "tools")
    return [path for path in candidates if path.exists()]


def _search_tools_dir(tools_dir: Path, names: list[str]) -> Optional[str]:
    for tool_name in names:
        candidate = tools_dir / tool_name
        if candidate.is_file():
            return str(candidate)

    for tool_name in names:
        for candidate in tools_dir.rglob(tool_name):
            if candidate.is_file():
                return str(candidate)
    return None


def _extract_tool_zip(name: str, tools_dir: Path) -> Optional[Path]:
    zip_path = tools_dir / f"{name}.zip"
    if not zip_path.is_file():
        return None

    target_root = ensure_dir(get_app_data_dir() / "tools")
    target_dir = target_root / name
    if target_dir.exists():
        return target_dir

    try:
        ensure_dir(target_dir)
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(target_dir)
        logger.info("Extracted %s to %s", zip_path, target_dir)
        return target_dir
    except Exception:
        logger.exception("Failed to extract %s", zip_path)
        return None


def resolve_tool(name: str, extra_names: Optional[Iterable[str]] = None) -> Optional[str]:
    names = [name]
    if extra_names:
        names.extend(extra_names)

    logger.info(f"Resolving tool: {name}, extra_names: {list(extra_names) if extra_names else []}")
    
    # Try PATH first
    for tool_name in names:
        found = shutil.which(tool_name)
        if found:
            logger.info(f"Found {tool_name} in PATH: {found}")
            return found
    
    logger.info(f"Not found in PATH, checking tools directories...")
    
    # Check local tools directories
    for tools_dir in get_tools_dirs():
        logger.info(f"Checking tools_dir: {tools_dir}")
        found = _search_tools_dir(tools_dir, names)
        if found:
            logger.info("Found %s at: %s", name, found)
            return found

    # Try extracting a bundled zip and search again in app data.
    for tools_dir in get_tools_dirs():
        extracted_dir = _extract_tool_zip(name, tools_dir)
        if not extracted_dir:
            continue
        found = _search_tools_dir(extracted_dir, names)
        if found:
            logger.info("Found %s after extraction at: %s", name, found)
            return found
    
    logger.warning(f"Tool {name} not found anywhere")
    return None


def get_react_dist() -> Path:
    candidates = []
    if hasattr(sys, "_MEIPASS"):
        candidates.append(Path(sys._MEIPASS) / "frontend" / "dist")
    candidates.append(get_project_root() / "frontend" / "dist")
    candidates.append(get_app_root().parent / "frontend" / "dist")
    for path in candidates:
        if path.exists():
            return path
    return candidates[0]


def build_mode_command(mode: str, config_path: Path, extra_args: Optional[list[str]] = None) -> list[str]:
    extra_args = extra_args or []
    if is_frozen():
        return [sys.executable, "--mode", mode, "--config", str(config_path), *extra_args]
    module = {
        "main": "app.main",
        "bookmarks": "app.bookmark_main",
        "split": "app.split_bookmarks",
        "vod": "app.vod_ocr",
        "webui": "app.webui",
    }.get(mode, "app.main")
    return [sys.executable, "-m", module, "--config", str(config_path), *extra_args]


def _candidate_torch_dirs() -> list[Path]:
    candidates: list[Path] = []
    if hasattr(sys, "_MEIPASS"):
        base = Path(sys._MEIPASS)
        candidates.extend([
            base / "torch",
            base / "_internal" / "torch",
        ])
    exe_dir = get_exe_dir()
    candidates.extend([
        exe_dir / "torch",
        exe_dir / "_internal" / "torch",
    ])
    candidates.append(get_gpu_ocr_packages_dir() / "torch")
    return candidates


def prepare_torch_runtime() -> Dict[str, Any]:
    info: Dict[str, Any] = {
        "frozen": is_frozen(),
        "exe_dir": str(get_exe_dir()),
        "dll_dirs": [],
        "torch_dir": None,
        "python_packages_dir": None,
    }
    packages_dir = get_gpu_ocr_packages_dir()
    info["python_packages_dir"] = str(packages_dir)
    if packages_dir.exists():
        packages_dir_str = str(packages_dir.resolve())
        if packages_dir_str not in sys.path:
            sys.path.insert(0, packages_dir_str)
    torch_dir: Optional[Path] = None
    for candidate in _candidate_torch_dirs():
        if candidate.exists():
            torch_dir = candidate
            break

    if torch_dir is None:
        return info

    info["torch_dir"] = str(torch_dir)
    lib_dirs = [
        torch_dir / "lib",
        torch_dir / "lib" / "nvidia",
    ]
    if packages_dir.exists():
        try:
            nvidia_root = packages_dir / "nvidia"
            if nvidia_root.exists():
                for child in nvidia_root.iterdir():
                    if not child.is_dir():
                        continue
                    for name in ("bin", "lib"):
                        candidate = child / name
                        if candidate.exists():
                            lib_dirs.append(candidate)
        except Exception:
            logger.exception("Failed to discover NVIDIA runtime directories under %s", packages_dir)
    seen: set[str] = set()
    for directory in lib_dirs:
        if not directory.exists():
            continue
        key = str(directory.resolve())
        if key in seen:
            continue
        seen.add(key)
        try:
            if hasattr(os, "add_dll_directory"):
                os.add_dll_directory(key)
            os.environ["PATH"] = f"{key};{os.environ.get('PATH', '')}"
            info["dll_dirs"].append(key)
        except Exception:
            logger.exception("Failed to add torch DLL directory: %s", key)
    return info
