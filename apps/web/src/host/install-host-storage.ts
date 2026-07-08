/**
 * Boot-time wiring: register the web tab's storage adapter as the
 * global host-storage implementation. Phase 4a ships the tab-memory
 * stub; Phase 4b swaps in the tab-oracle's origin-scoped IDB
 * persistence behind the same seam.
 */

import { setHostStorage } from '@openheaders/core/storage';
import { memoryHostStorage } from './memory-host-storage';

setHostStorage(memoryHostStorage);
