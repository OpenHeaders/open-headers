/**
 * Boot-time wiring: register the stub {@link HostBridge} for the
 * desktop renderer's first-cut mount.
 *
 * Real IPC-backed transport (renderer → main-process engine host) lands
 * with the Stage-2 orchestration lift; the contract on the UI side
 * stays identical when it swaps in.
 */

import { setHostBridge } from '@openheaders/core/bridge';
import { stubBridge } from './stub-bridge';

setHostBridge(stubBridge);
