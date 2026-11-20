/**
 * The desktop's process reader by platform (the activity monitor plan
 * §7, fork 3; §6, law 9): the addon's reading on macOS, a process's own
 * files on Linux, none on Windows — and none where the reader cannot
 * read this very process, so a host never trades its figures for a
 * reader that answers nothing. The platform and every source are
 * arguments, so each case runs on every OS.
 */

import type { DarwinProcessBinding, LinuxProcSource } from '@openheaders/oracle-host-node/process-reader';
import { describe, expect, it } from 'vitest';
import { createProcessReaderFor, type ProcessReaderSources } from '@/main/process-reader';

const SELF_PID = 4312;

const darwinBinding: DarwinProcessBinding = {
  timebase: () => ({ numer: 125, denom: 3 }),
  info: (pid) =>
    pid === SELF_PID
      ? { parentPid: 1, startedAtMs: 1_763_625_600_000, executableName: 'Open Headers', terminal: -1 }
      : null,
  usage: () => null,
  childPids: () => [],
  terminalPids: () => [],
};

/** `pid (comm) state ppid pgrp session tty_nr …` — the twentieth field after the name is the start, in ticks. */
const SELF_STAT = `${SELF_PID} (openheaders) S 1 ${SELF_PID} ${SELF_PID} 0 -1 4194304 100 0 0 0 250 50 0 0 20 0 12 0 5000 1000000 2000 18446744073709551615`;

function procSource(files: Record<string, string>): LinuxProcSource {
  return {
    readFile: (path) => files[path] ?? null,
    readDir: () => null,
    readLink: () => null,
  };
}

const LINUX_FILES = {
  '/proc/stat': 'cpu  1 2 3 4\nbtime 1763625000\n',
  [`/proc/${SELF_PID}/stat`]: SELF_STAT,
};

function makeSources(overrides: Partial<ProcessReaderSources> = {}): ProcessReaderSources {
  return {
    loadDarwinBinding: () => darwinBinding,
    procSource: () => procSource(LINUX_FILES),
    selfPid: SELF_PID,
    ...overrides,
  };
}

describe('createProcessReaderFor', () => {
  it('reads through the addon on macOS — the footprint', () => {
    expect(createProcessReaderFor('darwin', makeSources())?.memoryKind).toBe('footprint');
  });

  it('has no reader on macOS where the addon is not built or will not load', () => {
    expect(createProcessReaderFor('darwin', makeSources({ loadDarwinBinding: () => null }))).toBeNull();
  });

  it('reads a process’s own files on Linux — the resident size — and never asks for the addon', () => {
    const reader = createProcessReaderFor(
      'linux',
      makeSources({
        loadDarwinBinding: () => {
          throw new Error('the addon is macOS-only');
        },
      }),
    );
    expect(reader?.memoryKind).toBe('resident');
    expect(reader?.read(SELF_PID)?.cost?.cpuSeconds).toBe(3);
  });

  it('has no reader on Windows', () => {
    expect(createProcessReaderFor('win32', makeSources())).toBeNull();
  });

  it('has no reader where the platform’s one cannot read this very process', () => {
    expect(createProcessReaderFor('linux', makeSources({ procSource: () => procSource({}) }))).toBeNull();
    expect(createProcessReaderFor('darwin', makeSources({ selfPid: 999_999 }))).toBeNull();
  });
});
