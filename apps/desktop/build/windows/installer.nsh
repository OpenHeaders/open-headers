; Custom NSIS installer script for Open Headers

; Counts the processes whose program file lies in the install folder and
; leaves the count on the stack. With TERMINATE 1 each one is closed first
; and waited for. The uninstaller's own file is left out: Windows starts it
; from the install folder and it hands over to a copy of itself.
!macro openHeadersAppProcesses TERMINATE
  Push $0
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6
  Push $R7
  Push $R8
  Push $R9

  StrCpy $R7 0
  ; The folder and each program path are compared in their long form: a
  ; process started through a short (8.3) path reports that path.
  System::Call 'kernel32::GetLongPathNameW(w "$INSTDIR", w .R8, i ${NSIS_MAX_STRLEN}) i .r0'
  ${if} $0 = 0
    StrCpy $R8 "$INSTDIR"
  ${endif}
  StrCpy $R8 "$R8\"
  System::Call 'kernel32::GetCurrentProcessId() i .R6'
  ; TH32CS_SNAPPROCESS
  System::Call 'kernel32::CreateToolhelp32Snapshot(i 2, i 0) i .R0'
  ${if} $R0 <> -1
    ; PROCESSENTRY32W as a 32-bit program sees it, the installer's own kind
    System::Alloc 556
    Pop $R1
    System::Call '*$R1(i 556)'
    System::Call 'kernel32::Process32FirstW(i R0, i R1) i .R2'
    ${while} $R2 <> 0
      System::Call '*$R1(i, i, i .R3)'
      ${if} $R3 <> $R6
        ; PROCESS_QUERY_LIMITED_INFORMATION: enough to read the path, and
        ; granted for a process this user cannot close
        System::Call 'kernel32::OpenProcess(i 0x1000, i 0, i R3) i .R4'
        ${if} $R4 <> 0
          System::Call 'kernel32::QueryFullProcessImageNameW(i R4, i 0, w .R5, *i ${NSIS_MAX_STRLEN}) i .r0'
          System::Call 'kernel32::CloseHandle(i R4)'
          ${if} $0 <> 0
            System::Call 'kernel32::GetLongPathNameW(w R5, w .R9, i ${NSIS_MAX_STRLEN}) i .r0'
            ${if} $0 <> 0
              StrCpy $R5 $R9
            ${endif}
            StrLen $0 $R8
            StrCpy $R9 $R5 $0
            ${if} $R9 == $R8
            ${andif} $R5 != "$R8${UNINSTALL_FILENAME}"
              IntOp $R7 $R7 + 1
              !if "${TERMINATE}" == "1"
                ; SYNCHRONIZE | PROCESS_TERMINATE
                System::Call 'kernel32::OpenProcess(i 0x100001, i 0, i R3) i .R4'
                ${if} $R4 <> 0
                  System::Call 'kernel32::TerminateProcess(i R4, i 1)'
                  System::Call 'kernel32::WaitForSingleObject(i R4, i 3000)'
                  System::Call 'kernel32::CloseHandle(i R4)'
                ${endif}
              !endif
            ${endif}
          ${endif}
        ${endif}
      ${endif}
      System::Call 'kernel32::Process32NextW(i R0, i R1) i .R2'
    ${endwhile}
    System::Free $R1
    System::Call 'kernel32::CloseHandle(i R0)'
  ${endif}

  StrCpy $0 $R7
  Pop $R9
  Pop $R8
  Pop $R7
  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
  Exch $0
!macroend

; The installer and the uninstaller both ask whether the app is running
; before they touch its files. The builder's own answer starts PowerShell
; three times per ask, and an update asks twice: most of an update's wait.
; This one reads the process list directly and starts nothing.
!macro customCheckAppRunning
  Push $R0
  Push $R1
  !insertmacro openHeadersAppProcesses 0
  Pop $R0
  ${if} $R0 > 0
    ${if} ${isUpdated}
      ; The app that started this update is leaving by itself, and gives
      ; itself two seconds before it forces its own exit.
      ${for} $R1 1 10
        Sleep 200
        !insertmacro openHeadersAppProcesses 0
        Pop $R0
        ${if} $R0 = 0
          ${exitfor}
        ${endif}
      ${next}
    ${else}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$(appRunning)" /SD IDOK IDOK +2
      Quit
    ${endif}
  ${endif}
  ${if} $R0 > 0
    DetailPrint "$(appClosing)"
    ${do}
      !insertmacro openHeadersAppProcesses 1
      Pop $R0
      !insertmacro openHeadersAppProcesses 0
      Pop $R0
      ${if} $R0 = 0
        ${exitdo}
      ${endif}
      ; Still there: a process this user may not close, an elevated one.
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY +2
      Quit
    ${loop}
  ${endif}
  Pop $R1
  Pop $R0
!macroend

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

  ; Final cleanup
  DetailPrint "Completing uninstallation..."
!macroend