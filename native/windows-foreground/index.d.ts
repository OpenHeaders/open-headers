/**
 * Allow a process to set the foreground window
 * @param pid Process ID to allow foreground window access (optional, defaults to all processes)
 * @returns true if successful, false otherwise
 */
export function allowSetForegroundWindow(pid?: number): boolean;

/**
 * Force a window to the foreground using multiple strategies
 * @param pid Process ID of the window to bring to foreground
 * @returns true if successful, false otherwise
 */
export function setForegroundWindow(pid: number): boolean;

/**
 * Force a window to the foreground using a window handle
 * @param handle Window handle (HWND) as number or BigInt
 * @returns true if successful, false otherwise
 */
export function setForegroundWindowByHandle(handle: number | bigint): boolean;

/**
 * Get the window handle (HWND) for a process
 * @param pid Process ID to get window handle for
 * @returns Window handle as BigInt, or null if not found
 */
export function getWindowHandleByPID(pid: number): bigint | null;

/**
 * Flash a window in the taskbar to notify the user
 * @param pid Process ID of the window to flash
 * @param count Number of times to flash (1-10, defaults to 3)
 * @returns true if successful, false otherwise
 */
export function flashWindow(pid: number, count?: number): boolean;

/**
 * Send a mocked keystroke to satisfy Windows foreground activation requirements
 * Useful when app is started from Windows notification activation
 * @returns true if successful, false otherwise
 */
export function sendMockedKeystroke(): boolean;

/**
 * Enhanced method that tries multiple strategies to force a window to foreground
 * Combines sendMockedKeystroke, allowSetForegroundWindow, and setForegroundWindow
 * Falls back to flashing the window if all else fails
 * @param pid Process ID of the window to bring to foreground
 * @returns true if successful, false otherwise
 */
export function forceForegroundWindow(pid: number): boolean;