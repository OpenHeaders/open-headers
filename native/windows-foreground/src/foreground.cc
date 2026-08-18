#include <node_api.h>

#if _WIN32
#include <windows.h>
#include <tlhelp32.h>
#endif

#include "common.h"

namespace open_headers_foreground {

#if _WIN32
// Helper function to get window handle from process ID
HWND GetWindowHandleFromPID(DWORD processId) {
  HWND hwnd = NULL;
  HWND currentHwnd = GetTopWindow(NULL);
  
  while (currentHwnd) {
    DWORD windowProcessId;
    GetWindowThreadProcessId(currentHwnd, &windowProcessId);
    
    if (windowProcessId == processId && IsWindowVisible(currentHwnd)) {
      hwnd = currentHwnd;
      break;
    }
    
    currentHwnd = GetNextWindow(currentHwnd, GW_HWNDNEXT);
  }
  
  return hwnd;
}

// Enhanced method to force window to foreground using multiple strategies
BOOL ForceSetForegroundWindow(HWND hWnd) {
  if (!hWnd || !IsWindow(hWnd)) {
    return FALSE;
  }

  // Get current foreground window
  HWND hForeground = GetForegroundWindow();
  if (hForeground == hWnd) {
    return TRUE; // Already foreground
  }

  // Strategy 1: Direct SetForegroundWindow (works if we have permission)
  if (SetForegroundWindow(hWnd)) {
    return TRUE;
  }

  // Strategy 2: AttachThreadInput to gain permission
  DWORD currentThreadId = GetCurrentThreadId();
  DWORD foregroundThreadId = GetWindowThreadProcessId(hForeground, NULL);
  DWORD targetThreadId = GetWindowThreadProcessId(hWnd, NULL);
  
  BOOL attached = FALSE;
  BOOL attachedToTarget = FALSE;
  
  // Attach to foreground thread
  if (currentThreadId != foregroundThreadId) {
    attached = AttachThreadInput(currentThreadId, foregroundThreadId, TRUE);
  }
  
  // Attach to target thread
  if (currentThreadId != targetThreadId) {
    attachedToTarget = AttachThreadInput(currentThreadId, targetThreadId, TRUE);
  }

  // Try various methods to bring window to front
  BOOL result = FALSE;
  
  // Method 1: SetForegroundWindow after attachment
  if (!result) {
    result = SetForegroundWindow(hWnd);
  }
  
  // Method 2: Use BringWindowToTop
  if (!result) {
    BringWindowToTop(hWnd);
    result = (GetForegroundWindow() == hWnd);
  }
  
  // Method 3: Use SetWindowPos with HWND_TOP
  if (!result) {
    SetWindowPos(hWnd, HWND_TOP, 0, 0, 0, 0, 
                 SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    result = (GetForegroundWindow() == hWnd);
  }

  // Method 4: Show window if minimized
  if (!result) {
    if (IsIconic(hWnd)) {
      ShowWindow(hWnd, SW_RESTORE);
    } else {
      ShowWindow(hWnd, SW_SHOW);
    }
    result = SetForegroundWindow(hWnd);
  }

  // Detach thread inputs
  if (attached) {
    AttachThreadInput(currentThreadId, foregroundThreadId, FALSE);
  }
  if (attachedToTarget) {
    AttachThreadInput(currentThreadId, targetThreadId, FALSE);
  }

  // Strategy 3: Send mocked keystroke using SendInput (more reliable than keybd_event)
  if (!result) {
    // This is a known workaround for Windows notification activation scenarios
    // Based on Chromium's solution: https://bugs.chromium.org/p/chromium/issues/detail?id=837796
    INPUT inputs[2] = {};
    
    // Use a null virtual key (0x00) to minimize side effects
    inputs[0].type = INPUT_KEYBOARD;
    inputs[0].ki.wVk = 0;
    inputs[0].ki.dwFlags = KEYEVENTF_UNICODE;
    inputs[0].ki.wScan = 0;
    
    inputs[1] = inputs[0];
    inputs[1].ki.dwFlags |= KEYEVENTF_KEYUP;
    
    // Send the mocked keystroke
    UINT sent = SendInput(2, inputs, sizeof(INPUT));
    
    if (sent == 2) {
      // Now try SetForegroundWindow again - this should work after SendInput
      result = SetForegroundWindow(hWnd);
    }
  }
  
  // Strategy 3b: Simulate Alt key as fallback (older method)
  if (!result) {
    // Save current state
    BYTE keyState[256];
    GetKeyboardState(keyState);
    
    // Simulate Alt key press and release
    keybd_event(VK_MENU, 0, 0, 0);
    keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
    
    // Try SetForegroundWindow again
    result = SetForegroundWindow(hWnd);
    
    // Restore keyboard state
    SetKeyboardState(keyState);
  }

  // Strategy 4: Use SwitchToThisWindow (undocumented but effective)
  if (!result) {
    SwitchToThisWindow(hWnd, TRUE);
    result = (GetForegroundWindow() == hWnd);
  }

  // Strategy 5: Flash window if all else fails (at least notify user)
  if (!result) {
    FLASHWINFO flash = {0};
    flash.cbSize = sizeof(FLASHWINFO);
    flash.hwnd = hWnd;
    flash.dwFlags = FLASHW_ALL | FLASHW_TIMERNOFG;
    flash.uCount = 3;
    flash.dwTimeout = 0;
    FlashWindowEx(&flash);
  }

  return result;
}
#endif

napi_value AllowSetForegroundWindow(napi_env env, napi_callback_info info) {
#if _WIN32
  napi_value argv[1];
  size_t argc = 1;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));

  int pid = 0;

  if (argc != 0) {
    napi_valuetype valuetype0;
    NAPI_CALL(env, napi_typeof(env, argv[0], &valuetype0));

    if (valuetype0 != napi_undefined) {
      napi_status status = napi_get_value_int32(env, argv[0], &pid);

      if (status != napi_ok) {
        NAPI_CALL(env, napi_throw_type_error(env, NULL, "Invalid number was passed as argument."));
        return NULL;
      }
    }
  }

  BOOL result;
  if (pid != 0) {
    result = ::AllowSetForegroundWindow(pid);
  } else {
    // Grant foreground permission to all processes
    result = ::AllowSetForegroundWindow(ASFW_ANY);
  }

  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, result, &napi_result));
#else
  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, false, &napi_result));
#endif

  return napi_result;
}

napi_value SetForegroundWindow(napi_env env, napi_callback_info info) {
#if _WIN32
  napi_value argv[1];
  size_t argc = 1;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));

  if (argc < 1) {
    NAPI_CALL(env, napi_throw_type_error(env, NULL, "Process ID is required."));
    return NULL;
  }

  int pid = 0;
  napi_status status = napi_get_value_int32(env, argv[0], &pid);

  if (status != napi_ok || pid <= 0) {
    NAPI_CALL(env, napi_throw_type_error(env, NULL, "Invalid process ID was passed."));
    return NULL;
  }

  // Find window handle for the process
  HWND hwnd = GetWindowHandleFromPID(pid);
  BOOL result = FALSE;
  
  if (hwnd) {
    result = ForceSetForegroundWindow(hwnd);
  }

  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, result, &napi_result));
#else
  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, false, &napi_result));
#endif

  return napi_result;
}

napi_value SetForegroundWindowByHandle(napi_env env, napi_callback_info info) {
#if _WIN32
  napi_value argv[1];
  size_t argc = 1;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));

  if (argc < 1) {
    NAPI_CALL(env, napi_throw_type_error(env, NULL, "Window handle is required."));
    return NULL;
  }

  // Get window handle as number (can be larger than int32)
  int64_t handle64 = 0;
  napi_status status = napi_get_value_int64(env, argv[0], &handle64);

  if (status != napi_ok) {
    // Try getting as BigInt if int64 fails
    bool lossless;
    status = napi_get_value_bigint_int64(env, argv[0], &handle64, &lossless);
    
    if (status != napi_ok || !lossless) {
      NAPI_CALL(env, napi_throw_type_error(env, NULL, "Invalid window handle was passed."));
      return NULL;
    }
  }

  HWND hwnd = (HWND)(intptr_t)handle64;
  BOOL result = ForceSetForegroundWindow(hwnd);

  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, result, &napi_result));
#else
  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, false, &napi_result));
#endif

  return napi_result;
}

napi_value GetWindowHandleByPID(napi_env env, napi_callback_info info) {
#if _WIN32
  napi_value argv[1];
  size_t argc = 1;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));

  if (argc < 1) {
    NAPI_CALL(env, napi_throw_type_error(env, NULL, "Process ID is required."));
    return NULL;
  }

  int pid = 0;
  napi_status status = napi_get_value_int32(env, argv[0], &pid);

  if (status != napi_ok || pid <= 0) {
    NAPI_CALL(env, napi_throw_type_error(env, NULL, "Invalid process ID was passed."));
    return NULL;
  }

  HWND hwnd = GetWindowHandleFromPID(pid);
  
  napi_value napi_result;
  if (hwnd) {
    // Return handle as BigInt to handle large pointer values
    NAPI_CALL(env, napi_create_bigint_int64(env, (int64_t)(intptr_t)hwnd, &napi_result));
  } else {
    NAPI_CALL(env, napi_get_null(env, &napi_result));
  }
#else
  napi_value napi_result;
  NAPI_CALL(env, napi_get_null(env, &napi_result));
#endif

  return napi_result;
}

napi_value SendMockedKeystroke(napi_env env, napi_callback_info info) {
#if _WIN32
  // This sends a mocked keystroke to satisfy Windows foreground activation requirements
  // Useful when app is started from Windows notification activation
  INPUT inputs[2] = {};
  
  inputs[0].type = INPUT_KEYBOARD;
  inputs[0].ki.wVk = 0;
  inputs[0].ki.dwFlags = KEYEVENTF_UNICODE;
  inputs[0].ki.wScan = 0;
  
  inputs[1] = inputs[0];
  inputs[1].ki.dwFlags |= KEYEVENTF_KEYUP;
  
  UINT sent = SendInput(2, inputs, sizeof(INPUT));
  
  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, sent == 2, &napi_result));
#else
  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, false, &napi_result));
#endif

  return napi_result;
}

napi_value FlashWindow(napi_env env, napi_callback_info info) {
#if _WIN32
  napi_value argv[2];
  size_t argc = 2;

  NAPI_CALL(env, napi_get_cb_info(env, info, &argc, argv, NULL, NULL));

  if (argc < 1) {
    NAPI_CALL(env, napi_throw_type_error(env, NULL, "Process ID is required."));
    return NULL;
  }

  int pid = 0;
  napi_status status = napi_get_value_int32(env, argv[0], &pid);

  if (status != napi_ok || pid <= 0) {
    NAPI_CALL(env, napi_throw_type_error(env, NULL, "Invalid process ID was passed."));
    return NULL;
  }

  // Optional flash count parameter
  int flashCount = 3;
  if (argc >= 2) {
    napi_valuetype valuetype1;
    NAPI_CALL(env, napi_typeof(env, argv[1], &valuetype1));
    
    if (valuetype1 != napi_undefined) {
      napi_get_value_int32(env, argv[1], &flashCount);
      if (flashCount < 1) flashCount = 1;
      if (flashCount > 10) flashCount = 10;
    }
  }

  HWND hwnd = GetWindowHandleFromPID(pid);
  BOOL result = FALSE;
  
  if (hwnd) {
    FLASHWINFO flash = {0};
    flash.cbSize = sizeof(FLASHWINFO);
    flash.hwnd = hwnd;
    flash.dwFlags = FLASHW_ALL | FLASHW_TIMERNOFG;
    flash.uCount = flashCount;
    flash.dwTimeout = 0;
    result = FlashWindowEx(&flash);
  }

  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, result, &napi_result));
#else
  napi_value napi_result;
  NAPI_CALL(env, napi_get_boolean(env, false, &napi_result));
#endif

  return napi_result;
}

napi_value Init(napi_env env, napi_value exports) {
  napi_value allowSetForegroundWindow;
  NAPI_CALL(env, napi_create_function(env, "allowSetForegroundWindow", NAPI_AUTO_LENGTH, AllowSetForegroundWindow, NULL, &allowSetForegroundWindow));
  NAPI_CALL(env, napi_set_named_property(env, exports, "allowSetForegroundWindow", allowSetForegroundWindow));

  napi_value setForegroundWindow;
  NAPI_CALL(env, napi_create_function(env, "setForegroundWindow", NAPI_AUTO_LENGTH, SetForegroundWindow, NULL, &setForegroundWindow));
  NAPI_CALL(env, napi_set_named_property(env, exports, "setForegroundWindow", setForegroundWindow));

  napi_value setForegroundWindowByHandle;
  NAPI_CALL(env, napi_create_function(env, "setForegroundWindowByHandle", NAPI_AUTO_LENGTH, SetForegroundWindowByHandle, NULL, &setForegroundWindowByHandle));
  NAPI_CALL(env, napi_set_named_property(env, exports, "setForegroundWindowByHandle", setForegroundWindowByHandle));

  napi_value getWindowHandleByPID;
  NAPI_CALL(env, napi_create_function(env, "getWindowHandleByPID", NAPI_AUTO_LENGTH, GetWindowHandleByPID, NULL, &getWindowHandleByPID));
  NAPI_CALL(env, napi_set_named_property(env, exports, "getWindowHandleByPID", getWindowHandleByPID));

  napi_value flashWindow;
  NAPI_CALL(env, napi_create_function(env, "flashWindow", NAPI_AUTO_LENGTH, FlashWindow, NULL, &flashWindow));
  NAPI_CALL(env, napi_set_named_property(env, exports, "flashWindow", flashWindow));

  napi_value sendMockedKeystroke;
  NAPI_CALL(env, napi_create_function(env, "sendMockedKeystroke", NAPI_AUTO_LENGTH, SendMockedKeystroke, NULL, &sendMockedKeystroke));
  NAPI_CALL(env, napi_set_named_property(env, exports, "sendMockedKeystroke", sendMockedKeystroke));

  return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init);

} // namespace open_headers_foreground