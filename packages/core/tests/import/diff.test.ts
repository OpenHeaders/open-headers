import { describe, expect, it } from 'vitest';
import {
  createReport,
  diffImportReports,
  type FlatImportReport,
  type ImportDrop,
  type ImportTransform,
  recordDrop,
  recordTransform,
} from '../../src/import';

function seedReport(
  opts: {
    source?: FlatImportReport['source'];
    hash?: string;
    importedAt?: string;
    imported?: number;
    drops?: ImportDrop[];
    transforms?: ImportTransform[];
  } = {},
): FlatImportReport {
  const r = createReport(opts.source ?? 'postman-v2.1', opts.imported ?? 1);
  r.sourceHash = opts.hash ?? 'sha256:deadbeef';
  if (opts.importedAt) r.importedAt = opts.importedAt;
  for (const d of opts.drops ?? []) recordDrop(r, d);
  for (const t of opts.transforms ?? []) recordTransform(r, t);
  return r;
}

describe('diffImportReports', () => {
  describe('identical reports', () => {
    it('has no changes when drops + transforms + summary match', () => {
      const prev = seedReport({
        importedAt: '2026-04-18T10:00:00Z',
        drops: [{ path: 'a', reason: 'x' }],
        transforms: [{ path: 'b', from: '1', to: '2', reason: 'y' }],
      });
      const next = seedReport({
        importedAt: '2026-04-19T10:00:00Z',
        drops: [{ path: 'a', reason: 'x' }],
        transforms: [{ path: 'b', from: '1', to: '2', reason: 'y' }],
      });

      const diff = diffImportReports(prev, next);

      expect(diff.hasChanges).toBe(false);
      expect(diff.drops.added).toEqual([]);
      expect(diff.drops.resolved).toEqual([]);
      expect(diff.drops.persistent).toHaveLength(1);
      expect(diff.transforms.persistent).toHaveLength(1);
      expect(diff.summaryDelta).toEqual({ imported: 0, dropped: 0, transformed: 0 });
    });

    it('carries both timestamps for display even when unchanged', () => {
      const prev = seedReport({ importedAt: '2026-04-18T10:00:00Z' });
      const next = seedReport({ importedAt: '2026-04-19T12:34:56Z' });
      const diff = diffImportReports(prev, next);
      expect(diff.previousImportedAt).toBe('2026-04-18T10:00:00Z');
      expect(diff.nextImportedAt).toBe('2026-04-19T12:34:56Z');
    });
  });

  describe('added drops (regression)', () => {
    it('flags drops present in next but absent in previous', () => {
      const prev = seedReport({ drops: [{ path: 'a', reason: 'x' }] });
      const next = seedReport({
        drops: [
          { path: 'a', reason: 'x' },
          { path: 'b', reason: 'new fail' },
        ],
      });
      const diff = diffImportReports(prev, next);
      expect(diff.hasChanges).toBe(true);
      expect(diff.drops.added).toEqual([{ path: 'b', reason: 'new fail' }]);
      expect(diff.drops.persistent).toEqual([{ path: 'a', reason: 'x' }]);
      expect(diff.drops.resolved).toEqual([]);
    });

    it('positive summaryDelta.dropped reflects net regression', () => {
      const prev = seedReport();
      const next = seedReport({
        drops: [
          { path: 'a', reason: 'x' },
          { path: 'b', reason: 'y' },
          { path: 'c', reason: 'z' },
        ],
      });
      const diff = diffImportReports(prev, next);
      expect(diff.summaryDelta.dropped).toBe(3);
    });
  });

  describe('resolved drops (progress)', () => {
    it('flags drops present in previous but absent in next', () => {
      const prev = seedReport({
        drops: [
          { path: 'a', reason: 'x' },
          { path: 'b', reason: 'y' },
        ],
      });
      const next = seedReport({ drops: [{ path: 'a', reason: 'x' }] });
      const diff = diffImportReports(prev, next);
      expect(diff.drops.resolved).toEqual([{ path: 'b', reason: 'y' }]);
      expect(diff.drops.persistent).toEqual([{ path: 'a', reason: 'x' }]);
      expect(diff.drops.added).toEqual([]);
    });

    it('negative summaryDelta.dropped reflects net progress', () => {
      const prev = seedReport({
        drops: [
          { path: 'a', reason: 'x' },
          { path: 'b', reason: 'y' },
          { path: 'c', reason: 'z' },
        ],
      });
      const next = seedReport({ drops: [{ path: 'a', reason: 'x' }] });
      const diff = diffImportReports(prev, next);
      expect(diff.summaryDelta.dropped).toBe(-2);
    });
  });

  describe('persistent entries with changed reasons', () => {
    it('keeps the next reason in `persistent` (location churn is the signal)', () => {
      const prev = seedReport({ drops: [{ path: 'a', reason: 'version 1 reason' }] });
      const next = seedReport({ drops: [{ path: 'a', reason: 'version 2 reason (more detail)' }] });
      const diff = diffImportReports(prev, next);
      expect(diff.drops.added).toEqual([]);
      expect(diff.drops.resolved).toEqual([]);
      expect(diff.drops.persistent).toEqual([{ path: 'a', reason: 'version 2 reason (more detail)' }]);
    });
  });

  describe('transforms', () => {
    it('partitions transforms on `path` identity', () => {
      const prev = seedReport({
        transforms: [
          { path: 'x', from: 'a', to: 'b', reason: 'r1' },
          { path: 'y', from: 'c', to: 'd', reason: 'r2' },
        ],
      });
      const next = seedReport({
        transforms: [
          { path: 'x', from: 'a', to: 'b', reason: 'r1' },
          { path: 'z', from: 'e', to: 'f', reason: 'r3' },
        ],
      });
      const diff = diffImportReports(prev, next);
      expect(diff.transforms.added).toEqual([{ path: 'z', from: 'e', to: 'f', reason: 'r3' }]);
      expect(diff.transforms.resolved).toEqual([{ path: 'y', from: 'c', to: 'd', reason: 'r2' }]);
      expect(diff.transforms.persistent).toEqual([{ path: 'x', from: 'a', to: 'b', reason: 'r1' }]);
    });
  });

  describe('order preservation', () => {
    it('added follows next order; resolved follows previous order', () => {
      const prev = seedReport({
        drops: [
          { path: 'z', reason: '1' },
          { path: 'y', reason: '2' },
          { path: 'x', reason: '3' },
        ],
      });
      const next = seedReport({
        drops: [
          { path: 'w', reason: '4' },
          { path: 'v', reason: '5' },
        ],
      });
      const diff = diffImportReports(prev, next);
      expect(diff.drops.added.map((d) => d.path)).toEqual(['w', 'v']);
      expect(diff.drops.resolved.map((d) => d.path)).toEqual(['z', 'y', 'x']);
    });
  });

  describe('duplicate path within a single report', () => {
    it('dedups by keeping the first occurrence', () => {
      const prev = seedReport({ drops: [{ path: 'a', reason: 'x' }] });
      const next = seedReport({
        drops: [
          { path: 'a', reason: 'first' },
          { path: 'a', reason: 'second (should be deduped)' },
        ],
      });
      const diff = diffImportReports(prev, next);
      expect(diff.drops.persistent).toHaveLength(1);
      expect(diff.drops.persistent[0]?.reason).toBe('first');
      expect(diff.drops.added).toEqual([]);
    });
  });

  describe('summary counters', () => {
    it('surfaces imported-count delta independently of drops/transforms', () => {
      const prev = seedReport({ imported: 42 });
      const next = seedReport({ imported: 50 });
      const diff = diffImportReports(prev, next);
      expect(diff.summaryDelta.imported).toBe(8);
      expect(diff.previousSummary.imported).toBe(42);
      expect(diff.nextSummary.imported).toBe(50);
      expect(diff.hasChanges).toBe(true);
    });

    it('hasChanges is true if only summary differs', () => {
      const prev = seedReport({ imported: 5 });
      const next = seedReport({ imported: 6 });
      const diff = diffImportReports(prev, next);
      expect(diff.hasChanges).toBe(true);
    });
  });

  describe('source attribution', () => {
    it('carries the previous report source when sources match', () => {
      const prev = seedReport({ source: 'postman-v2.1' });
      const next = seedReport({ source: 'postman-v2.1' });
      const diff = diffImportReports(prev, next);
      expect(diff.source).toBe('postman-v2.1');
    });

    it('reflects the previous report source even if next differs (caller filters upstream)', () => {
      const prev = seedReport({ source: 'curl' });
      const next = seedReport({ source: 'har' });
      const diff = diffImportReports(prev, next);
      expect(diff.source).toBe('curl');
    });
  });
});
