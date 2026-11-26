/**
 * The desktop's process reader (the activity monitor plan §7, fork 3):
 * ONE reader for the host, shared by its two consumers — the activity
 * monitor and the terminal's close-confirm. macOS reads through
 * `@openheaders/process-reader` and Windows through
 * `@openheaders/windows-process-reader`, each an addon of our own;
 * Linux reads a process's own files.
 *
 * pnpm materializes each addon only on its own platform, so a static
 * import would fail module resolution on every other one. This module
 * owns the guarded requires.
 *
 * The reader is composed before the engine boots, so what it says goes
 * to the main process's own logger: the engine's is not installed yet.
 */

import { createRequire } from 'node:module';
import {
  createDarwinProcessReader,
  createLinuxProcessReader,
  createNodeProcSource,
  createWin32ProcessReader,
  type DarwinProcessBinding,
  type LinuxProcSource,
  type ProcessReader,
  type Win32ProcessBinding,
} from '@openheaders/oracle-host-node/process-reader';
import { createLogger } from './bootstrap/logger';

const logger = createLogger('ProcessReader');

export interface ProcessReaderSources {
  /** The macOS addon's binding; null where it is not built or will not load. */
  loadDarwinBinding(): DarwinProcessBinding | null;
  /** The Windows addon's binding; null where it is not built or will not load. */
  loadWin32Binding(): Win32ProcessBinding | null;
  procSource(): LinuxProcSource;
  /** This process — a reader that cannot read it is no reader. */
  selfPid: number;
}

function platformReader(platform: NodeJS.Platform, sources: ProcessReaderSources): ProcessReader | null {
  if (platform === 'darwin') {
    const binding = sources.loadDarwinBinding();
    return binding === null ? null : createDarwinProcessReader(binding);
  }
  if (platform === 'win32') {
    const binding = sources.loadWin32Binding();
    return binding === null ? null : createWin32ProcessReader(binding, sources.selfPid);
  }
  if (platform === 'linux') return createLinuxProcessReader(sources.procSource());
  return null;
}

/** The platform's reader, or null where there is none or it cannot read this very process. */
export function createProcessReaderFor(platform: NodeJS.Platform, sources: ProcessReaderSources): ProcessReader | null {
  const reader = platformReader(platform, sources);
  return reader !== null && reader.read(sources.selfPid) !== null ? reader : null;
}

type AddonModule<Binding> = { load(): Binding | null };

function loadAddonBinding<Binding>(addon: string): Binding | null {
  try {
    return (createRequire(__filename)(addon) as AddonModule<Binding>).load();
  } catch {
    return null;
  }
}

/** `undefined` = not yet composed; `null` = this host has no reader. */
let cached: ProcessReader | null | undefined;

export function desktopProcessReader(): ProcessReader | null {
  if (cached === undefined) {
    cached = createProcessReaderFor(process.platform, {
      loadDarwinBinding: () => loadAddonBinding<DarwinProcessBinding>('@openheaders/process-reader'),
      loadWin32Binding: () => loadAddonBinding<Win32ProcessBinding>('@openheaders/windows-process-reader'),
      procSource: createNodeProcSource,
      selfPid: process.pid,
    });
    if (cached === null) {
      logger.warn('no process reader on this host — the runtime’s own figures stand in');
    }
  }
  return cached;
}
