param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = "Stop"

$target = Join-Path $Root "third_party_licenses"
if (Test-Path $target) {
    Remove-Item -Recurse -Force $target
}
New-Item -ItemType Directory -Force $target | Out-Null

function Copy-LicenseFile {
    param(
        [string]$Source,
        [string]$DestinationName
    )
    if (Test-Path $Source) {
        Copy-Item $Source (Join-Path $target $DestinationName) -Force
    } else {
        Write-Host "Warning: license not found at $Source"
    }
}

# Bundled tools
Copy-LicenseFile (Join-Path $Root "tools\licenses\tesseract_LICENSE.txt") "tesseract_LICENSE.txt"
Copy-LicenseFile (Join-Path $Root "tools\licenses\ffmpeg_LGPLv3.txt") "ffmpeg_LGPLv3.txt"
Copy-LicenseFile (Join-Path $Root "tools\licenses\yt-dlp_LICENSE.txt") "yt-dlp_LICENSE.txt"

# Frontend dependencies
Copy-LicenseFile (Join-Path $Root "frontend\node_modules\react\LICENSE") "react_LICENSE.txt"
Copy-LicenseFile (Join-Path $Root "frontend\node_modules\react-dom\LICENSE") "react-dom_LICENSE.txt"
Copy-LicenseFile (Join-Path $Root "frontend\node_modules\react-router-dom\LICENSE.md") "react-router-dom_LICENSE.md"
Copy-LicenseFile (Join-Path $Root "frontend\node_modules\vite\LICENSE.md") "vite_LICENSE.md"
Copy-LicenseFile (Join-Path $Root "frontend\node_modules\@vitejs\plugin-react\LICENSE") "vite_plugin-react_LICENSE.txt"

# Desktop dependencies
Copy-LicenseFile (Join-Path $Root "desktop\node_modules\electron\LICENSE") "electron_LICENSE.txt"
Copy-LicenseFile (Join-Path $Root "desktop\node_modules\electron-builder\LICENSE") "electron-builder_LICENSE.txt"

# Python dependencies
Copy-LicenseFile (Join-Path $Root ".venv\Lib\site-packages\dxcam-0.0.5.dist-info\LICENSE") "dxcam_LICENSE.txt"
Copy-LicenseFile (Join-Path $Root ".venv\Lib\site-packages\numpy-1.26.4.dist-info\LICENSE.txt") "numpy_LICENSE.txt"
Copy-LicenseFile (Join-Path $Root ".venv\Lib\site-packages\opencv_python-4.9.0.80.dist-info\LICENSE.txt") "opencv-python_LICENSE.txt"
Copy-LicenseFile (Join-Path $Root ".venv\Lib\site-packages\pytesseract-0.3.10.dist-info\LICENSE") "pytesseract_LICENSE.txt"
Copy-LicenseFile (Join-Path $Root ".venv\Lib\site-packages\flask-3.0.3.dist-info\LICENSE.txt") "flask_LICENSE.txt"

# MSS license file is not shipped in the wheel; emit a standard MIT license text.
$mssLicensePath = Join-Path $target "mss_LICENSE.txt"
if (-not (Test-Path $mssLicensePath)) {
    @"
MIT License

Copyright (c) Mickael Schoentgen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"@ | Set-Content -Path $mssLicensePath -Encoding UTF8
}

Write-Host "Third-party licenses copied to $target"