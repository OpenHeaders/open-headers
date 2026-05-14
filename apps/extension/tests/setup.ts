import { setHostBridge } from '@openheaders/core/bridge';
import { setHostLogger } from '@openheaders/core/logger';
import { setHostStorage } from '@openheaders/core/storage';
import { logger } from '@openheaders/core/utils';
import { vi } from 'vitest';
import { chrome } from './__mocks__/chrome';

// Make chrome globally available
vi.stubGlobal('chrome', chrome);

// Install the host-logger adapter once for the whole suite. The
// extension is the host; in tests it wires the same console logger its
// `install-host-logger` boot module installs, so any code reaching for
// `hostLogger` resolves identically to production.
setHostLogger(logger);

// Install the host-bridge adapter once for the whole suite — mirrors
// `install-host-bridge` at boot. Tests that need to assert on bridge
// traffic override it per-file (`vi.mock('@openheaders/core/bridge', …)`);
// everything else lands on the chrome-backed transport over the mocked
// chrome API, exactly as production does.
//
// `chromeBridge` pulls in chrome-touching modules at import time, so it
// must load *after* `vi.stubGlobal('chrome', …)` above — hence the
// dynamic import rather than a hoisted static one.
const { chromeBridge } = await import('@/utils/bridge');
setHostBridge(chromeBridge);

// Install the host-storage adapter once for the whole suite — mirrors
// `install-host-storage` at boot. The chrome-backed `extensionStorage`
// adapter runs against the mocked chrome API, so any oracle/background
// code reaching for `hostStorage` resolves exactly as production does.
// Tests that need a controllable in-memory store override it per-file
// with `setHostStorage(fake)` in `beforeEach`.
const { extensionStorage } = await import('@/host/extension-storage');
setHostStorage(extensionStorage);
