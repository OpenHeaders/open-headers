/**
 * Coverage for the audit-emit default sink's log-level routing.
 *
 * Pinned invariant: a routine `allow` on a read-only capability
 * (`workspace.read` / `workspace.list`) logs at `debug` (the high-volume,
 * low-signal hydration case); denials AND mutations (`workspace.write` /
 * `daemon.admin`) stay at `info` so the audit signal survives the default
 * log level. A custom sink installed via `setAuditSink` bypasses this
 * entirely.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Capability, CapabilityDecision } from '../../src/identity';
import { emitAuditEntry, resetAuditSink, setAuditSink } from '../../src/identity';
import { logger } from '../../src/utils/logger';

function emit(capability: Capability, decision: CapabilityDecision): void {
  emitAuditEntry({
    actorUserId: 'user-1',
    capability,
    workspaceId: 'ws-1',
    decision,
    orgId: 'org-1',
    occurredAt: '2026-06-01T00:00:00.000Z',
  });
}

describe('audit default sink — log-level routing', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetAuditSink();
    debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAuditSink();
  });

  it('demotes allow on read-only capabilities to debug', () => {
    emit('workspace.read', { allow: true });
    emit('workspace.list', { allow: true });
    expect(debugSpy).toHaveBeenCalledTimes(2);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('keeps allow on mutating/sensitive capabilities at info', () => {
    emit('workspace.write', { allow: true });
    emit('daemon.admin', { allow: true });
    expect(infoSpy).toHaveBeenCalledTimes(2);
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('keeps denials at info even on a read-only capability', () => {
    emit('workspace.read', { allow: false, reason: 'no-workspace-role-assignment' });
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[1]).toContain('deny(no-workspace-role-assignment)');
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('a custom sink bypasses the default level routing', () => {
    const sink = vi.fn();
    setAuditSink(sink);
    emit('workspace.read', { allow: true });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });
});
