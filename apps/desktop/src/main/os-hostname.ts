/**
 * Best-effort machine name — the private home Org's descriptive name on
 * first boot, and the device label the server's approval page names
 * this app by. The trailing `.local` macOS appends is stripped so a
 * joined peer reads `Daniels-MacBook-Pro`, not `Daniels-MacBook-Pro.local`.
 * Falls back to `'Local'` when `os.hostname` throws or is empty.
 */

import os from 'node:os';

export function safeOsHostname(): string {
  try {
    return os.hostname().replace(/\.local$/, '') || 'Local';
  } catch {
    return 'Local';
  }
}
