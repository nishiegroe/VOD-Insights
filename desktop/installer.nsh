!macro customInit
  IfFileExists "$WINDIR\System32\nvcuda.dll" done
  IfFileExists "$WINDIR\SysWOW64\nvcuda.dll" done

  MessageBox MB_ICONEXCLAMATION|MB_YESNO "NVIDIA CUDA driver not detected. GPU OCR will be unavailable until drivers are installed. Open the NVIDIA driver download page?" IDYES openDriver
  Goto done

openDriver:
  ExecShell "open" "https://www.nvidia.com/Download/index.aspx"

done:
!macroend
