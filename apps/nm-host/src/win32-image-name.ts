/**
 * Win32 image-name probe — `QueryFullProcessImageNameW` over a
 * `PROCESS_QUERY_LIMITED_INFORMATION` handle, called in-process via
 * `bun:ffi` (the shipped host is always the Bun-compiled binary).
 *
 * LIMITED access is the whole point: Windows mandatory-integrity
 * policy lets a lower-integrity caller open a higher-integrity process
 * with QUERY_LIMITED only. Firefox deliberately de-elevates the NM
 * hosts it spawns, so when the desktop app runs elevated the host's
 * PowerShell probes (WMI `Win32_Process.ExecutablePath`, .NET
 * `MainModule`) come back empty — they need QUERY_INFORMATION — while
 * this call still answers. Chromium hosts inherit the browser's
 * integrity and never hit the gap.
 */

import { dlopen, ptr } from 'bun:ffi';

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
/** NT paths cap at 32767 wide chars; the DWORD in/out size is in chars. */
const IMAGE_NAME_CAPACITY = 32767;

type Kernel32 = ReturnType<typeof dlopen>;

let kernel32: Kernel32 | null = null;

function lib(): Kernel32 {
  if (kernel32 === null) {
    kernel32 = dlopen('kernel32.dll', {
      OpenProcess: { args: ['u32', 'i32', 'u32'], returns: 'ptr' },
      QueryFullProcessImageNameW: { args: ['ptr', 'u32', 'ptr', 'ptr'], returns: 'i32' },
      CloseHandle: { args: ['ptr'], returns: 'i32' },
    });
  }
  return kernel32;
}

/**
 * Full image path of `pid`, or null when the process is gone or even a
 * QUERY_LIMITED open is denied. win32-only by construction — the
 * composition root wires it on that platform alone.
 */
export async function win32ImageNamePath(pid: number): Promise<string | null> {
  const { symbols } = lib();
  const handle = symbols.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
  if (handle === 0 || handle === 0n) return null;
  try {
    const chars = new Uint16Array(IMAGE_NAME_CAPACITY);
    const size = new Uint32Array([IMAGE_NAME_CAPACITY]);
    const ok = symbols.QueryFullProcessImageNameW(handle, 0, ptr(chars), ptr(size));
    if (ok === 0) return null;
    const length = size[0];
    if (length === 0) return null;
    return String.fromCharCode(...chars.subarray(0, length));
  } finally {
    symbols.CloseHandle(handle);
  }
}
