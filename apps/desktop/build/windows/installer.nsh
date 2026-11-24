; Custom NSIS installer script for Open Headers

!macro customInstall
  ; Show progress messages during installation
  DetailPrint "Installing OpenHeaders..."
  SetDetailsPrint both
  
  ; Show extraction progress
  DetailPrint "Extracting files..."
  
  ; Clean up old/corrupted registry entries first
  DetailPrint "Cleaning up old protocol handler entries..."
  DeleteRegKey HKCR "openheaders"
  
  ; Register openheaders:// protocol with clean entries
  DetailPrint "Registering openheaders:// protocol handler..."
  WriteRegStr HKCR "openheaders" "" "URL:OpenHeaders Protocol"
  WriteRegStr HKCR "openheaders" "URL Protocol" ""
  WriteRegStr HKCR "openheaders\DefaultIcon" "" "$INSTDIR\OpenHeaders.exe,0"
  WriteRegStr HKCR "openheaders\shell" "" "open"
  WriteRegStr HKCR "openheaders\shell\open" "" "Open with OpenHeaders"
  WriteRegStr HKCR "openheaders\shell\open" "FriendlyAppName" "OpenHeaders"
  WriteRegStr HKCR "openheaders\shell\open\command" "" '"$INSTDIR\OpenHeaders.exe" "%1"'
  
  ; Also register in HKCU for current user (fallback)
  WriteRegStr HKCU "Software\Classes\openheaders" "" "URL:OpenHeaders Protocol"
  WriteRegStr HKCU "Software\Classes\openheaders" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\openheaders\DefaultIcon" "" "$INSTDIR\OpenHeaders.exe,0"
  WriteRegStr HKCU "Software\Classes\openheaders\shell" "" "open"
  WriteRegStr HKCU "Software\Classes\openheaders\shell\open" "" "Open with OpenHeaders"
  WriteRegStr HKCU "Software\Classes\openheaders\shell\open" "FriendlyAppName" "OpenHeaders"
  WriteRegStr HKCU "Software\Classes\openheaders\shell\open\command" "" '"$INSTDIR\OpenHeaders.exe" "%1"'
  
  DetailPrint "Protocol handler registered successfully."

  ; Builds up to 2026.11.1 kept their update downloads in a folder of
  ; another name, a whole installer among them. An update those builds
  ; start runs from that folder and leaves it; the next install removes it.
  ${if} $EXEDIR != "$LOCALAPPDATA\openheaders-updater\pending"
    RMDir /r "$LOCALAPPDATA\openheaders-updater"
  ${endif}

  ; The updater keeps the block map of the installer it last downloaded
  ; beside the copy this installer keeps of itself, and computes the next
  ; download from the pair. An install the updater did not start from that
  ; folder leaves the map describing another file: the next update would
  ; fail its check and download everything. The map goes, and the updater
  ; takes the right one from the feed.
  Push $R0
  ${StdUtils.GetParentPath} $R0 "$LOCALAPPDATA\${APP_INSTALLER_STORE_FILE}"
  ${if} $EXEDIR != "$R0\pending"
    Delete "$R0\current.blockmap"
  ${endif}
  Pop $R0
!macroend

!macro customUnInstall
  ; Show uninstall progress
  DetailPrint "Uninstalling OpenHeaders..."
  SetDetailsPrint both
  
  ; Remove protocol handlers
  DetailPrint "Removing protocol handlers..."
  DeleteRegKey HKCR "openheaders"
  DeleteRegKey HKCU "Software\Classes\openheaders"
  
  ; Clean up registry entries
  DetailPrint "Cleaning up registry entries..."
  DeleteRegValue HKLM "Software\RegisteredApplications" "OpenHeaders"
  DeleteRegValue HKCU "Software\RegisteredApplications" "OpenHeaders"
  
  ; Remove application files
  DetailPrint "Removing application files..."
  Sleep 500
  
  ; Final cleanup
  DetailPrint "Completing uninstallation..."
!macroend