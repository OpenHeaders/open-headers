/**
 * Boot-time wiring: register the in-memory {@link HostStorage} stub as
 * the global adapter for the desktop renderer.
 *
 * Resets on every renderer reload — durable persistence lands with the
 * engine-host milestone (an electron-store-backed adapter owned by the
 * main process, proxied to the renderer via IPC). The contract on the
 * UI side is identical now and after the swap.
 */

import { setHostStorage } from '@openheaders/core/storage';
import { inMemoryHostStorage } from './in-memory-storage';

setHostStorage(inMemoryHostStorage);
