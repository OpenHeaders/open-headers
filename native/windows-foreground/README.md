# Windows Foreground

Enhanced API wrapper for Windows foreground window management with multiple fallback strategies to ensure reliable window activation on Windows 10/11 Enterprise.

## Installing

This package is vendored into the OpenHeaders monorepo and consumed by the desktop app as a local dependency (`file:../../native/windows-foreground`). It is Windows-only (`os: ["win32"]`); on other platforms the install is skipped entirely. On Windows, `pnpm install` compiles it from source via `node-gyp-build` — you need the Visual Studio Build Tools (the standard `node-gyp` toolchain).

## Quick Start

```javascript
const foreground = require('@openheaders/windows-foreground');

// RECOMMENDED: Use the enhanced method that tries multiple strategies
const success = foreground.forceForegroundWindow(pid);

// Or use individual methods for more control
foreground.sendMockedKeystroke();  // Satisfy Windows requirements
foreground.allowSetForegroundWindow(pid);  // Grant permission
foreground.setForegroundWindow(pid);  // Bring to foreground
```

## API Reference

### `forceForegroundWindow(pid)`
**Recommended method** - Tries multiple strategies to bring a window to foreground:
1. Sends mocked keystroke to satisfy Windows requirements
2. Grants foreground permission to the process
3. Attempts to set foreground with multiple internal strategies
4. Falls back to window flashing if all else fails

```javascript
const success = foreground.forceForegroundWindow(processId);
```

### `allowSetForegroundWindow(pid?)`
Grants a process permission to set the foreground window (original API).
```javascript
// Allow specific process
foreground.allowSetForegroundWindow(pid);

// Allow all processes
foreground.allowSetForegroundWindow();
```

### `setForegroundWindow(pid)`
Forces a window to foreground using multiple strategies including:
- Direct SetForegroundWindow
- AttachThreadInput for permission elevation
- SendInput mocked keystroke workaround
- SwitchToThisWindow as fallback
- Window restoration if minimized

```javascript
const success = foreground.setForegroundWindow(pid);
```

### `sendMockedKeystroke()`
Sends a mocked keystroke to satisfy Windows foreground activation requirements. This is especially useful when your app is started from a Windows notification.

```javascript
foreground.sendMockedKeystroke();
```

### `getWindowHandleByPID(pid)`
Gets the window handle (HWND) for a process.
```javascript
const handle = foreground.getWindowHandleByPID(pid);
if (handle) {
  foreground.setForegroundWindowByHandle(handle);
}
```

### `setForegroundWindowByHandle(handle)`
Sets foreground window using a window handle instead of PID.
```javascript
foreground.setForegroundWindowByHandle(windowHandle);
```

### `flashWindow(pid, count?)`
Flashes a window in the taskbar to notify the user.
```javascript
foreground.flashWindow(pid, 3);  // Flash 3 times
```

## Why This Works

Windows has strict rules about when applications can steal focus. This library uses multiple workarounds:

1. **SendInput Workaround**: Based on [Chromium's solution](https://bugs.chromium.org/p/chromium/issues/detail?id=837796), sending a mocked keystroke satisfies Windows' requirement that the app has recent user input.

2. **Thread Input Attachment**: By attaching to the foreground window's thread input queue, we gain permission to set foreground.

3. **Multiple Fallback Methods**: If one method fails, we try others including SwitchToThisWindow and window restoration.

## Supported Platforms
- **Windows 10/11** (all editions including Enterprise)
- **Other platforms**: Installs but returns false for all operations

## Developing
```sh
npm install -g node-gyp
npm install
npm test
```

## Resources
- [The Old New Thing: Foreground activation permission](https://blogs.msdn.microsoft.com/oldnewthing/20090220-00/?p=19083)
- [Chromium Issue 837796](https://bugs.chromium.org/p/chromium/issues/detail?id=837796)
- [AllowSetForegroundWindow documentation](https://docs.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-allowsetforegroundwindow)

## License
Apache-2.0 (see the repository root [LICENSE](../../LICENSE)). `src/common.h` embeds N-API helper macros from the Node.js project and retains their MIT notice.
