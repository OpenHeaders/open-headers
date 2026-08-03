/**
 * Capture-session sink pins (AGENT_TRAFFIC_PLAN.md §3, slice S7): one
 * session = one append-only JSONL file — header first, `record` lines
 * folding last-wins by identity, one honest `end` trailer; a tripped
 * bound STOPS the session (never a silent truncation), stop is
 * idempotent, and the projection carries the same counters the file
 * does.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { setHostLogger } from '@openheaders/core/logger';
import type { TrafficCaptureEndReason, TrafficRecordProjection } from '@openheaders/core/traffic';
import { logger as consoleLogger } from '@openheaders/core/utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startTrafficCaptureSession } from '../../src/traffic/capture';

function makeProjection(overrides: Partial<TrafficRecordProjection> = {}): TrafficRecordProjection {
  return {
    tabId: 7,
    requestId: 'req-1',
    url: 'https://api.openheaders.io/users',
    method: 'GET',
    resourceType: 'xhr',
    phase: 'completed',
    statusCode: 200,
    startedAtMs: 1_000,
    completedAtMs: 1_050,
    redirectHopCount: 0,
    provenance: 'heuristic',
    ...overrides,
  };
}

interface ParsedLine {
  kind: string;
  [key: string]: unknown;
}

function readLines(filePath: string): ParsedLine[] {
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as ParsedLine);
}

let dir: string;

beforeEach(() => {
  setHostLogger(consoleLogger);
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-traffic-capture-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function startSession(overrides: {
  name?: string;
  maxBytes?: number;
  maxDurationMs?: number;
  onAutoStop?: (reason: TrafficCaptureEndReason) => void;
}) {
  return startTrafficCaptureSession({
    dir,
    sessionId: 'cap-1',
    sourceUid: 'browser-tab:ext-node-1:7',
    sourceLabel: 'tab 7 @ ext-node-1',
    name: overrides.name ?? 'overnight repro',
    redaction: 'standard',
    bounds: {
      maxBytes: overrides.maxBytes ?? 1024 * 1024,
      maxDurationMs: overrides.maxDurationMs ?? 60 * 60 * 1000,
    },
    ...(overrides.onAutoStop !== undefined ? { onAutoStop: overrides.onAutoStop } : {}),
  });
}

describe('traffic capture session — file shape', () => {
  it('writes header → record lines (last-wins refinements) → trailer, with honest counters', () => {
    const session = startSession({});
    expect(session.active).toBe(true);

    session.append(makeProjection({ phase: 'pending', statusCode: undefined, completedAtMs: undefined }));
    // The same identity refined — appended again; readers fold last-wins.
    session.append(makeProjection());
    session.append(makeProjection({ requestId: 'req-2', url: 'https://api.openheaders.io/orders' }));
    session.stop();
    expect(session.active).toBe(false);

    const projection = session.projection();
    expect(projection.state).toBe('stopped');
    expect(projection.endReason).toBe('stopped');
    expect(projection.recordLines).toBe(3);
    expect(projection.name).toBe('overnight repro');
    expect(projection.filePath.startsWith(dir)).toBe(true);
    expect(projection.filePath.endsWith('.jsonl')).toBe(true);
    expect(path.basename(projection.filePath)).toContain('overnight-repro');
    expect(path.basename(projection.filePath)).toContain('cap-1');

    const lines = readLines(projection.filePath);
    expect(lines.map((l) => l.kind)).toEqual(['header', 'record', 'record', 'record', 'end']);
    const header = lines[0] as ParsedLine & { redaction: string; recordFold: string; sourceUid: string };
    expect(header.formatVersion).toBe(1);
    expect(header.redaction).toBe('standard');
    expect(header.sourceUid).toBe('browser-tab:ext-node-1:7');
    expect(header.recordFold).toContain('last-wins');
    const trailer = lines[4] as ParsedLine & { reason: string; recordLines: number; bytesWritten: number };
    expect(trailer.reason).toBe('stopped');
    expect(trailer.recordLines).toBe(3);
    // The projection's byte counter includes the trailer it wrote.
    expect(session.projection().bytesWritten).toBe(fs.statSync(projection.filePath).size);
  });

  it('stop is idempotent — one trailer, later stops and appends are no-ops', () => {
    const session = startSession({});
    session.append(makeProjection());
    session.stop();
    session.stop('source-disarmed');
    session.append(makeProjection({ requestId: 'late' }));

    const lines = readLines(session.projection().filePath);
    expect(lines.filter((l) => l.kind === 'end')).toHaveLength(1);
    expect(lines.filter((l) => l.kind === 'record')).toHaveLength(1);
    expect(session.projection().endReason).toBe('stopped');
  });
});

describe('traffic capture session — bounds', () => {
  it('a record that would cross the byte bound STOPS the session instead of being written', () => {
    const autoStops: TrafficCaptureEndReason[] = [];
    const session = startSession({ maxBytes: 600, onAutoStop: (reason) => autoStops.push(reason) });
    session.append(makeProjection());
    // The second record would cross the 600-byte ceiling.
    session.append(makeProjection({ requestId: 'req-overflow' }));

    expect(session.active).toBe(false);
    expect(session.projection().endReason).toBe('size-bound');
    expect(autoStops).toEqual(['size-bound']);

    const lines = readLines(session.projection().filePath);
    // The overflowing record is ABSENT — a bound trip is a stop, never
    // a silent truncate-and-continue.
    expect(lines.filter((l) => l.kind === 'record')).toHaveLength(1);
    const trailer = lines[lines.length - 1] as ParsedLine & { reason: string };
    expect(trailer.reason).toBe('size-bound');
  });

  it('the duration bound stops an idle session on its own', () => {
    vi.useFakeTimers();
    try {
      const autoStops: TrafficCaptureEndReason[] = [];
      const session = startSession({ maxDurationMs: 5_000, onAutoStop: (reason) => autoStops.push(reason) });
      vi.advanceTimersByTime(5_001);
      expect(session.active).toBe(false);
      expect(session.projection().endReason).toBe('duration-bound');
      expect(autoStops).toEqual(['duration-bound']);
      const trailer = readLines(session.projection().filePath).at(-1) as ParsedLine & { reason: string };
      expect(trailer.reason).toBe('duration-bound');
    } finally {
      vi.useRealTimers();
    }
  });

  it('an explicit stop never fires onAutoStop and clears the duration timer', () => {
    vi.useFakeTimers();
    try {
      const autoStops: TrafficCaptureEndReason[] = [];
      const session = startSession({ maxDurationMs: 5_000, onAutoStop: (reason) => autoStops.push(reason) });
      session.stop();
      vi.advanceTimersByTime(10_000);
      expect(autoStops).toEqual([]);
      expect(session.projection().endReason).toBe('stopped');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('traffic capture session — file naming', () => {
  it('slugs hostile names and never mints an empty slug', () => {
    const session = startSession({ name: '  Überwachung / später!! ' });
    const base = path.basename(session.projection().filePath);
    expect(base).toMatch(/^[0-9T-]+Z-[a-z0-9-]+-cap-1\.jsonl$/);
    session.stop();

    const symbols = startTrafficCaptureSession({
      dir,
      sessionId: 'cap-2',
      sourceUid: 'proxy',
      sourceLabel: 'Proxy capture',
      name: '###',
      redaction: 'standard',
      bounds: { maxBytes: 1024, maxDurationMs: 60_000 },
    });
    expect(path.basename(symbols.projection().filePath)).toContain('capture-cap-2');
    symbols.stop();
  });
});
