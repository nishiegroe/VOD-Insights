$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent $PSScriptRoot)

$toolsDir = Join-Path $PWD "tools"
$licensesDir = Join-Path $toolsDir "licenses"
New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
New-Item -ItemType Directory -Force -Path $licensesDir | Out-Null

$ffmpegZip = Join-Path $toolsDir "ffmpeg.zip"
$ffmpegUrl = "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip"
$ytDlpExe = Join-Path $toolsDir "yt-dlp.exe"
$ytDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"

Write-Host "Downloading FFmpeg..."
Invoke-WebRequest -Uri $ffmpegUrl -OutFile $ffmpegZip

Write-Host "Extracting FFmpeg..."
$ffmpegExtract = Join-Path $toolsDir "ffmpeg"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $ffmpegExtract
Expand-Archive -Path $ffmpegZip -DestinationPath $ffmpegExtract -Force

Write-Host "Downloading yt-dlp..."
Invoke-WebRequest -Uri $ytDlpUrl -OutFile $ytDlpExe

Write-Host "Copying Tesseract from system install..."
$tesseractTarget = Join-Path $toolsDir "tesseract"
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $tesseractTarget
$candidates = @(
	"C:\Program Files\Tesseract-OCR",
	"C:\Program Files (x86)\Tesseract-OCR"
)
$src = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $src) {
	throw "Tesseract install not found at $($candidates -join ' or '). Install via winget and rerun this script."
}
Write-Host "Found Tesseract at $src"
New-Item -ItemType Directory -Force -Path $tesseractTarget | Out-Null
Copy-Item -Recurse -Force (Join-Path $src "*") $tesseractTarget
Write-Host "Tesseract copied to tools/"

Write-Host "Fetching license texts..."
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/tesseract-ocr/tesseract/main/LICENSE" -OutFile (Join-Path $licensesDir "tesseract_LICENSE.txt")
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/COPYING.LGPLv3" -OutFile (Join-Path $licensesDir "ffmpeg_LGPLv3.txt")
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/yt-dlp/yt-dlp/master/LICENSE" -OutFile (Join-Path $licensesDir "yt-dlp_LICENSE.txt")

Write-Host "Done. Tools are in tools/ and licenses in tools/licenses/."