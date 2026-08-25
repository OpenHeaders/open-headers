/**
 * Boot-time wiring: register the web tab's origin-scoped IDB adapter
 * as the global host-storage implementation. Everything the Workbench
 * persists through this seam (settings, workspaces, identity) survives
 * reloads in the tab's own origin storage.
 *
 * The anonymous public viewer (F5b) is the one exception: it hydrates
 * a published snapshot into a throwaway oracle, and MUST NOT share the
 * origin's IDB with a signed-in session's replica — a memory adapter
 * keeps the two worlds structurally apart.
 */

import { setHostStorage } from '@openheaders/core/storage';
import { idbHostStorage } from './idb-host-storage';
import { MemoryHostStorage } from './memory-host-storage';
import { isPublicView } from './public-view';

setHostStorage(isPublicView() ? new MemoryHostStorage() : idbHostStorage);
