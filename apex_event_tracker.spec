# -*- mode: python ; coding: utf-8 -*-

import os
from pathlib import Path

from PyInstaller.utils.hooks import collect_submodules

block_cipher = None

root = Path(os.getcwd()).resolve()

app_dir = root / "app"
frontend_dist = root / "frontend" / "dist"

config_path = app_dir / "config.json"
tools_dir = root / "tools"
notices_path = root / "THIRD_PARTY_NOTICES.txt"
licenses_dir = root / "third_party_licenses"

pathex = [str(root)]

hiddenimports = []
hiddenimports += collect_submodules("numpy")
hiddenimports += collect_submodules("cv2")
hiddenimports += [
    "easyocr",
    "torch",
    "torchvision",
    "torchaudio",
]

binaries = []
if tools_dir.exists():
    binaries.append((str(tools_dir), "tools"))

# Bundle frontend dist and default config.
datas = []
if frontend_dist.exists():
    datas.append((str(frontend_dist), "frontend/dist"))
if config_path.exists():
    datas.append((str(config_path), "app"))
easyocr_models_dir = root / "easyocr_models"
if easyocr_models_dir.exists():
    datas.append((str(easyocr_models_dir), "easyocr_models"))
if notices_path.exists():
    datas.append((str(notices_path), "."))
if licenses_dir.exists():
    datas.append((str(licenses_dir), "third_party_licenses"))

analysis = Analysis(
    ["app/launcher.py"],
    pathex=pathex,
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(analysis.pure, analysis.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    analysis.scripts,
    [],
    exclude_binaries=True,
    name="VODInsights",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    analysis.binaries,
    analysis.zipfiles,
    analysis.datas,
    strip=False,
    upx=False,
    name="VODInsights",
)
