/**
 * `oh.logs.*` — the renderer's way at `main.log`: read the log text for
 * the diagnostic bundle, and the folders main knows about itself for
 * the bundle's redaction. Backs two renderer capabilities; sends
 * nothing anywhere.
 */

import type { DiagnosticsLogFile, DiagnosticsRoot } from '@openheaders/core/diagnostics';
import { ipcRenderer } from 'electron';

const READ_CHANNEL = 'oh:logs:read';
const ROOTS_CHANNEL = 'oh:logs:roots';

export const logs = {
  read(): Promise<DiagnosticsLogFile[]> {
    return ipcRenderer.invoke(READ_CHANNEL) as Promise<DiagnosticsLogFile[]>;
  },
  roots(): Promise<DiagnosticsRoot[]> {
    return ipcRenderer.invoke(ROOTS_CHANNEL) as Promise<DiagnosticsRoot[]>;
  },
};
