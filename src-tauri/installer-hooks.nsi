!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Configuring runtime dependencies..."
  IfFileExists "$INSTDIR\binaries\WebView2Loader.dll" 0 +2
    CopyFiles /SILENT "$INSTDIR\binaries\WebView2Loader.dll" "$INSTDIR\WebView2Loader.dll"
  IfFileExists "$INSTDIR\resources\binaries\WebView2Loader.dll" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\binaries\WebView2Loader.dll" "$INSTDIR\WebView2Loader.dll"
  IfFileExists "$INSTDIR\resources\WebView2Loader.dll" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\WebView2Loader.dll" "$INSTDIR\WebView2Loader.dll"

  IfFileExists "$INSTDIR\binaries\wintun.dll" 0 +2
    CopyFiles /SILENT "$INSTDIR\binaries\wintun.dll" "$INSTDIR\wintun.dll"
  IfFileExists "$INSTDIR\resources\binaries\wintun.dll" 0 +2
    CopyFiles /SILENT "$INSTDIR\resources\binaries\wintun.dll" "$INSTDIR\wintun.dll"
!macroend
