import { setHostLogger } from '@openheaders/core/logger';
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
