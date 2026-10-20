/**
 * `oh.logs.*` — the renderer's way at `main.log`: read the log files'
 * text for the diagnostic bundle. Backs a renderer capability; sends
 * nothing anywhere.
 */

import type { DiagnosticsLogFile } from '@openheaders/core/diagnostics';
import { ipcRenderer } from 'electron';

const READ_CHANNEL = 'oh:logs:read';

export const logs = {
  read(): Promise<DiagnosticsLogFile[]> {
    return ipcRenderer.invoke(READ_CHANNEL) as Promise<DiagnosticsLogFile[]>;
  },
};
