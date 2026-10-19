/**
 * `oh.logs.*` — the renderer's two ways at `main.log`: reveal it in
 * the OS file manager (the root error fallback's "Open logs folder")
 * and read the log files' text for the diagnostic bundle. Both back
 * renderer capabilities; neither sends anything anywhere.
 */

import type { DiagnosticsLogFile } from '@openheaders/core/diagnostics';
import { ipcRenderer } from 'electron';

const REVEAL_CHANNEL = 'oh:logs:reveal';
const READ_CHANNEL = 'oh:logs:read';

export const logs = {
  reveal(): Promise<void> {
    return ipcRenderer.invoke(REVEAL_CHANNEL) as Promise<void>;
  },
  read(): Promise<DiagnosticsLogFile[]> {
    return ipcRenderer.invoke(READ_CHANNEL) as Promise<DiagnosticsLogFile[]>;
  },
};
