/**
 * Boot-time wiring: register the web tab's origin-scoped IDB adapter
 * as the global host-storage implementation. Everything the Workbench
 * persists through this seam (settings, workspaces, identity) survives
 * reloads in the tab's own origin storage.
 */

import { setHostStorage } from '@openheaders/core/storage';
import { idbHostStorage } from './idb-host-storage';

setHostStorage(idbHostStorage);
