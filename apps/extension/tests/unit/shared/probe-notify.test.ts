/**
 * Probe-result → notification copy. The mapping both "Test connection"
 * (ApplyBar) and the back-end Switch gate share, so a reachable-but-
 * auth-required back-end reads the same on either surface.
 */

import type { ProbeConnectionResult } from '@openheaders/ui/shared/backend';
import { describeProbeResult, humanizeProbeFailure, probeWarningTitle } from '@openheaders/ui/shared/backend';
import { describe, expect, it } from 'vitest';

describe('describeProbeResult', () => {
  it('maps a successful probe to a success notice naming the back-end', () => {
    const ok: ProbeConnectionResult = {
      ok: true,
      latencyMs: 12,
      protocolVersion: 1,
      role: 'extension',
      agent: 'test',
    };
    const notice = describeProbeResult(ok, 'Desktop Application');
    expect(notice.level).toBe('success');
    expect(notice.description).toContain('Desktop Application');
  });

  it('maps a reachable-but-not-ready failure to a warning', () => {
    const notice = describeProbeResult(
      { ok: false, reason: 'handshake-rejected', rejectReason: 'auth-required' },
      'Local / LAN',
    );
    expect(notice.level).toBe('warning');
    expect(notice.message).toBe('Reachable, but auth required');
  });

  it('maps a protocol mismatch to a "version mismatch" warning', () => {
    const notice = describeProbeResult({ ok: false, reason: 'protocol-mismatch' }, 'Remote / WAN');
    expect(notice.level).toBe('warning');
    expect(notice.message).toBe('Reachable, but version mismatch');
  });

  it('maps an unreachable failure to a hard error', () => {
    const notice = describeProbeResult({ ok: false, reason: 'timeout' }, 'Desktop Application');
    expect(notice.level).toBe('error');
    expect(notice.message).toBe('Not reachable');
  });
});

describe('probeWarningTitle / humanizeProbeFailure', () => {
  it('titles workspace-unknown as a not-shared warning', () => {
    expect(probeWarningTitle({ ok: false, reason: 'handshake-rejected', rejectReason: 'workspace-unknown' })).toBe(
      'Reachable, but workspace not shared',
    );
  });

  it('explains an auth-required rejection with a next step', () => {
    const copy = humanizeProbeFailure({ ok: false, reason: 'handshake-rejected', rejectReason: 'auth-required' });
    expect(copy).toContain('Pair');
  });

  it('explains a timeout', () => {
    expect(humanizeProbeFailure({ ok: false, reason: 'timeout' })).toContain('Timed out');
  });
});
