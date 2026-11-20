/**
 * The desktop's process reader (the activity monitor plan §7, fork 3):
 * ONE reader for the host, shared by its two consumers — the activity
 * monitor and the terminal's close-confirm. macOS reads through
 * `@openheaders/process-reader`, an addon of our own; Linux reads a
 * process's own files; Windows has none until its reader lands.
 *
 * pnpm materializes the addon only on macOS, so a static import would
 * fail module resolution on every other platform. This module owns the
 * single guarded require.
 */

import { createRequire } from 'node:module';
import { hostLogger as logger } from '@openheaders/core/logger';
import {
  createDarwinProcessReader,
  createLinuxProcessReader,
  createNodeProcSource,
  type DarwinProcessBinding,
  type LinuxProcSource,
  type ProcessReader,
} from '@openheaders/oracle-host-node/process-reader';

const SCOPE = 'ProcessReader';

export interface ProcessReaderSources {
  /** The macOS addon's binding; null where it is not built or will not load. */
  loadDarwinBinding(): DarwinProcessBinding | null;
  procSource(): LinuxProcSource;
  /** This process — a reader that cannot read it is no reader. */
  selfPid: number;
}

function platformReader(platform: NodeJS.Platform, sources: ProcessReaderSources): ProcessReader | null {
  if (platform === 'darwin') {
    const binding = sources.loadDarwinBinding();
    return binding === null ? null : createDarwinProcessReader(binding);
  }
  if (platform === 'linux') return createLinuxProcessReader(sources.procSource());
  return null;
}

/** The platform's reader, or null where there is none or it cannot read this very process. */
export function createProcessReaderFor(platform: NodeJS.Platform, sources: ProcessReaderSources): ProcessReader | null {
  const reader = platformReader(platform, sources);
  return reader !== null && reader.read(sources.selfPid) !== null ? reader : null;
}

type ProcessReaderModule = { load(): DarwinProcessBinding | null };

function loadDarwinBinding(): DarwinProcessBinding | null {
  try {
    return (createRequire(__filename)('@openheaders/process-reader') as ProcessReaderModule).load();
  } catch {
    return null;
  }
}

/** `undefined` = not yet composed; `null` = this host has no reader. */
let cached: ProcessReader | null | undefined;

export function desktopProcessReader(): ProcessReader | null {
  if (cached === undefined) {
    cached = createProcessReaderFor(process.platform, {
      loadDarwinBinding,
      procSource: createNodeProcSource,
      selfPid: process.pid,
    });
    if (cached === null && process.platform !== 'win32') {
      logger.warn(SCOPE, 'no process reader on this host — the runtime’s own figures stand in');
    }
  }
  return cached;
}
