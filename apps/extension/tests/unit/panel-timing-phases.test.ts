import type { InspectorHarEntry } from '@openheaders/core/types';
import { computeTimingPhases } from '@openheaders/ui/panel/data/timing-phases';
import type { TimingPhase } from '@openheaders/ui/panel/data/timing-phases';
import { describe, expect, it } from 'vitest';

function har(timings: InspectorHarEntry['timings'], time?: number): InspectorHarEntry {
  return {
    startedDateTime: '2026-01-01T00:00:00.000Z',
    time: time ?? -1,
    request: { method: 'GET', url: 'https://openheaders.io/', headers: [], cookies: [], queryString: [], headersSize: -1, bodySize: -1, httpVersion: 'HTTP/1.1' },
    response: { status: 200, statusText: 'OK', httpVersion: 'HTTP/1.1', headers: [], cookies: [], content: { size: 0, mimeType: 'text/plain' }, redirectURL: '', headersSize: -1, bodySize: 0 },
    cache: {},
    timings,
  } as unknown as InspectorHarEntry;
}

describe('computeTimingPhases', () => {
  it('returns null when timings field is missing', () => {
    const out = computeTimingPhases({ ...har({}), timings: undefined } as InspectorHarEntry);
    expect(out).toBeNull();
  });

  it('returns null when every phase is zero (e.g. memory-cached entry)', () => {
    expect(computeTimingPhases(har({ blocked: 0, dns: 0, connect: 0, ssl: 0, send: 0, wait: 0, receive: 0 }))).toBeNull();
  });

  it('subtracts SSL from connect for the displayed Initial connection', () => {
    const data = computeTimingPhases(har({ connect: 400, ssl: 130 }));
    expect(data).not.toBeNull();
    const connect = data!.phases.find((p: TimingPhase) => p.key === 'connect');
    const ssl = data!.phases.find((p: TimingPhase) => p.key === 'ssl');
    expect(connect?.ms).toBe(270);
    expect(ssl?.ms).toBe(130);
  });

  it('clamps Initial connection to zero when ssl > connect (defensive)', () => {
    const data = computeTimingPhases(har({ connect: 100, ssl: 150 }));
    expect(data!.phases.find((p: TimingPhase) => p.key === 'connect')).toBeUndefined();
    expect(data!.phases.find((p: TimingPhase) => p.key === 'ssl')?.ms).toBe(150);
  });

  it('splits blocked into queueing + stalled via _blocked_queueing', () => {
    const data = computeTimingPhases(har({ blocked: 10, _blocked_queueing: 3 }));
    expect(data!.phases.find((p: TimingPhase) => p.key === 'queueing')?.ms).toBe(3);
    expect(data!.phases.find((p: TimingPhase) => p.key === 'stalled')?.ms).toBe(7);
  });

  it('treats all of blocked as Stalled when _blocked_queueing is absent', () => {
    const data = computeTimingPhases(har({ blocked: 5 }));
    expect(data!.phases.find((p: TimingPhase) => p.key === 'queueing')).toBeUndefined();
    expect(data!.phases.find((p: TimingPhase) => p.key === 'stalled')?.ms).toBe(5);
  });

  it('drops phases with zero or negative durations', () => {
    const data = computeTimingPhases(har({ blocked: -1, dns: 0, connect: 10, ssl: 5, send: 0, wait: 100, receive: 200 }));
    const keys = data!.phases.map((p: TimingPhase) => p.key);
    expect(keys).toEqual(['connect', 'ssl', 'wait', 'receive']);
  });

  it('groups phases for sectioned rendering', () => {
    const data = computeTimingPhases(
      har({ blocked: 10, _blocked_queueing: 3, dns: 25, connect: 200, ssl: 100, send: 1, wait: 50, receive: 80 }),
    );
    expect(data!.byGroup.scheduling.map((p: TimingPhase) => p.key)).toEqual(['queueing']);
    expect(data!.byGroup.connection.map((p: TimingPhase) => p.key)).toEqual(['stalled', 'dns', 'connect', 'ssl']);
    expect(data!.byGroup.transfer.map((p: TimingPhase) => p.key)).toEqual(['send', 'wait', 'receive']);
  });

  it('derives totalMs from the non-overlapping phases, ignoring the DNS-inflated HAR `time`', () => {
    // HAR `time` (815.23) is deliberately inconsistent with the phases to
    // prove totalMs is the phase sum, not the exporter's `time` (which
    // double-counts DNS by adding it on top of a connect that contains it).
    const data = computeTimingPhases(har({ connect: 100, ssl: 30, wait: 50, receive: 100 }, 815.23));
    // (100 connect − 30 ssl) + 30 ssl + 50 wait + 100 receive = 250
    expect(data!.totalMs).toBe(250);
  });

  it('peels DNS out of connect so it is counted once', () => {
    // HAR `connect` (200) spans both dns (25) and ssl (100); the TCP-only
    // Initial connection is 200 − 100 − 25 = 75, and the total counts the
    // connection once: blocked 5 + connect 200 + send 1 + wait 50 + receive 80.
    const data = computeTimingPhases(har({ blocked: 5, dns: 25, connect: 200, ssl: 100, send: 1, wait: 50, receive: 80 }));
    expect(data!.phases.find((p: TimingPhase) => p.key === 'connect')?.ms).toBe(75);
    expect(data!.phases.find((p: TimingPhase) => p.key === 'dns')?.ms).toBe(25);
    expect(data!.totalMs).toBe(336);
  });
});
