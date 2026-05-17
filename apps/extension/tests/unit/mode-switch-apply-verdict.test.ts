/**
 * Phase C M2c — pins the verdict→side-effect dispatch table that the
 * BackendPane calls on every dropdown change. Each ModeSwitchVerdict
 * kind has exactly one branch; this is the table that says which
 * handler each branch invokes.
 */

import type { DataPresenceSummary, ModeSwitchVerdict } from '@openheaders/core/sync';
import { applyModeSwitchVerdict, type ModeSwitchVerdictHandlers } from '@openheaders/ui/shared/mode-switch';
import { describe, expect, it, vi } from 'vitest';

function makeHandlers(): ModeSwitchVerdictHandlers & {
  __commit: ReturnType<typeof vi.fn>;
  __warn: ReturnType<typeof vi.fn>;
  __open: ReturnType<typeof vi.fn>;
} {
  const __commit = vi.fn();
  const __warn = vi.fn();
  const __open = vi.fn();
  return {
    commitMode: __commit,
    warnPeerUnreachable: __warn,
    openDialog: __open,
    __commit,
    __warn,
    __open,
  };
}

function summary(total: number): DataPresenceSummary {
  return {
    workspaceCount: total === 0 ? 0 : 1,
    hasUserContent: total > 0,
    totalEntityCount: total,
    workspaces: [],
  };
}

describe('applyModeSwitchVerdict', () => {
  it('is a no-op for no-change', () => {
    const h = makeHandlers();
    applyModeSwitchVerdict({ kind: 'no-change' }, h);
    expect(h.__commit).not.toHaveBeenCalled();
    expect(h.__warn).not.toHaveBeenCalled();
    expect(h.__open).not.toHaveBeenCalled();
  });

  it('commits on both-empty', () => {
    const h = makeHandlers();
    applyModeSwitchVerdict({ kind: 'both-empty' }, h);
    expect(h.__commit).toHaveBeenCalledTimes(1);
  });

  it('commits on silent-use-target', () => {
    const h = makeHandlers();
    applyModeSwitchVerdict({ kind: 'silent-use-target' }, h);
    expect(h.__commit).toHaveBeenCalledTimes(1);
  });

  it('commits on silent-import-source', () => {
    const h = makeHandlers();
    applyModeSwitchVerdict({ kind: 'silent-import-source' }, h);
    expect(h.__commit).toHaveBeenCalledTimes(1);
  });

  it('routes peer-unreachable to the warning handler', () => {
    const h = makeHandlers();
    applyModeSwitchVerdict({ kind: 'peer-unreachable' }, h);
    expect(h.__warn).toHaveBeenCalledTimes(1);
    expect(h.__commit).not.toHaveBeenCalled();
    expect(h.__open).not.toHaveBeenCalled();
  });

  it('forwards the show-dialog verdict to openDialog with source + target intact', () => {
    const h = makeHandlers();
    const verdict: ModeSwitchVerdict = {
      kind: 'show-dialog',
      source: summary(12),
      target: summary(4),
      nameCollisions: [],
    };
    applyModeSwitchVerdict(verdict, h);
    expect(h.__open).toHaveBeenCalledTimes(1);
    const arg = h.__open.mock.calls[0][0];
    expect(arg.kind).toBe('show-dialog');
    expect(arg.source.totalEntityCount).toBe(12);
    expect(arg.target.totalEntityCount).toBe(4);
    expect(h.__commit).not.toHaveBeenCalled();
    expect(h.__warn).not.toHaveBeenCalled();
  });
});
