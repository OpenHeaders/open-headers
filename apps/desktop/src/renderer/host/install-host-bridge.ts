/**
 * Boot-time wiring: register the IPC-backed {@link HostBridge} that
 * talks to the desktop main-process engine host through the preload
 * contextBridge surface (`window.oh.*`).
 */

import { setHostBridge } from '@openheaders/core/bridge';
import { ipcBridge } from './ipc-bridge';

setHostBridge(ipcBridge);
