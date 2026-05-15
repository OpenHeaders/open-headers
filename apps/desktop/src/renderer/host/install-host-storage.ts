/**
 * Boot-time wiring: register the IPC-proxied {@link HostStorage} adapter
 * as the global adapter for the desktop renderer.
 *
 * Every consumer in `packages/ui` (and elsewhere) reaches storage through
 * `@openheaders/core/storage`'s `hostStorage` proxy — that proxy
 * forwards to whichever adapter was installed here. The desktop
 * renderer's adapter is a thin IPC client of the main-process
 * {@link FileBackedHostStorage}; sensitive slots are encrypted at rest
 * via Electron `safeStorage` transparently to UI code.
 */

import { setHostStorage } from '@openheaders/core/storage';
import { ipcHostStorage } from './ipc-host-storage';

setHostStorage(ipcHostStorage);
