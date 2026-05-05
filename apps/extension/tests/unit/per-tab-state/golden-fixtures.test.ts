/**
 * Golden snapshot fixtures (design § 8.3 + R4 enforcement).
 *
 * Walks `tests/__fixtures__/per-tab-state/<surface>/v<N>.json` per
 * surface; current version's fixture must round-trip through the
 * donor-record loader (returns the validated record), and every older
 * version's fixture must be rejected with version-mismatch and fall
 * through to `null` (the loader's "no record" answer).
 *
 * Old fixtures are kept FOREVER on every subsequent version bump —
 * that's the structural enforcement of the bump-version-when-you-
 * change-the-type discipline.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined),
}));

vi.mock('@/shared/storage', async () => {
  const real = await vi.importActual<typeof import('@/shared/storage')>('@/shared/storage');
  return {
    ...real,
    extensionStorage: {
      get: mockGet,
      set: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      subscribe: vi.fn(() => () => undefined),
    },
  };
});

import { readDonorRecord } from '@/shared/per-tab-state/donor-record';
import type { SurfaceType } from '@/shared/per-tab-state/types';

const FIXTURE_ROOT = path.resolve(__dirname, '../../__fixtures__/per-tab-state');

const CURRENT_VERSION_BY_SURFACE: Record<SurfaceType, number> = {
  workbench: 1,
  panel: 1,
};

interface FixtureEntry {
  surface: SurfaceType;
  version: number;
  filePath: string;
  payload: Record<string, unknown>;
}

function loadFixtures(surface: SurfaceType): FixtureEntry[] {
  const dir = path.join(FIXTURE_ROOT, surface);
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: FixtureEntry[] = [];
  for (const name of entries) {
    const full = path.join(dir, name);
    if (!statSync(full).isFile()) continue;
    const match = /^v(\d+)\.json$/.exec(name);
    if (!match) continue;
    const version = Number(match[1]);
    const raw = readFileSync(full, 'utf8');
    const payload = JSON.parse(raw) as Record<string, unknown>;
    out.push({ surface, version, filePath: full, payload });
  }
  return out;
}

beforeEach(() => {
  mockGet.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('per-tab-state golden fixtures', () => {
  for (const surface of ['workbench', 'panel'] satisfies SurfaceType[]) {
    describe(`${surface} fixtures`, () => {
      const fixtures = loadFixtures(surface);

      it('has at least one fixture (v1 should never be deleted)', () => {
        expect(fixtures.length).toBeGreaterThan(0);
      });

      it('contains a fixture for the current schema version', () => {
        const current = CURRENT_VERSION_BY_SURFACE[surface];
        const matching = fixtures.find((f) => f.version === current);
        expect(matching).toBeDefined();
      });

      for (const fixture of fixtures) {
        const isCurrent = fixture.version === CURRENT_VERSION_BY_SURFACE[surface];

        it(
          isCurrent
            ? `v${fixture.version}: current — round-trips through readDonorRecord`
            : `v${fixture.version}: stale — rejected with version-mismatch`,
          async () => {
            mockGet.mockResolvedValueOnce(fixture.payload);
            const result = await readDonorRecord(surface, CURRENT_VERSION_BY_SURFACE[surface]);
            if (isCurrent) {
              expect(result).not.toBeNull();
              expect(result?.schemaVersion).toBe(fixture.version);
              expect(result?.snapshot).toEqual(fixture.payload.snapshot);
            } else {
              // Loader rejects mismatched versions silently — falls
              // through to factory defaults at the consumer.
              expect(result).toBeNull();
            }
          },
        );
      }

      it('rejects malformed JSON shapes (missing donorTabUid)', async () => {
        mockGet.mockResolvedValueOnce({ schemaVersion: 1, snapshot: {}, publishedAt: 0 });
        const result = await readDonorRecord(surface, 1);
        expect(result).toBeNull();
      });

      it('rejects payload with null snapshot', async () => {
        mockGet.mockResolvedValueOnce({
          donorTabUid: 't',
          schemaVersion: 1,
          snapshot: null,
          publishedAt: 0,
        });
        const result = await readDonorRecord(surface, 1);
        expect(result).toBeNull();
      });

      it('returns null on empty slot', async () => {
        mockGet.mockResolvedValueOnce(undefined);
        const result = await readDonorRecord(surface, 1);
        expect(result).toBeNull();
      });
    });
  }
});
