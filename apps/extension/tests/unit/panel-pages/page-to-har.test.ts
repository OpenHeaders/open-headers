/**
 * `pageToHar` projector — converts the page-stream `Page` primitive into
 * the HAR 1.2 `log.pages[i]` wire shape.
 */

import type { Page } from '@openheaders/core/page-stream';
import type { InspectorHarPage } from '@openheaders/core/types';
import { pagesToHarForRefs, pageToHar } from '@openheaders/ui/panel/data/page-to-har';
import { describe, expect, it } from 'vitest';

function page(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page_1',
    startedAtMs: Date.UTC(2026, 0, 1, 12, 0, 0),
    url: 'https://openheaders.io/',
    ...overrides,
  };
}

function hostPage(overrides: Partial<InspectorHarPage> = {}): InspectorHarPage {
  return {
    id: 'page_1',
    startedDateTime: '2026-01-01T12:00:00.123Z',
    title: 'https://openheaders.io/',
    pageTimings: { onContentLoad: 696.9859999990149, onLoad: 1622.4739999997837 },
    ...overrides,
  };
}

describe('pageToHar', () => {
  it('projects all fields with nav-timing present', () => {
    const result = pageToHar(page({ dclMs: 120, loadMs: 480 }));
    expect(result).toEqual({
      id: 'page_1',
      startedDateTime: new Date(Date.UTC(2026, 0, 1, 12, 0, 0)).toISOString(),
      title: 'https://openheaders.io/',
      pageTimings: { onContentLoad: 120, onLoad: 480 },
    });
  });

  it('emits -1 for absent nav-timing milestones (HAR spec)', () => {
    const result = pageToHar(page());
    expect(result.pageTimings).toEqual({ onContentLoad: -1, onLoad: -1 });
  });

  it('substitutes empty string for null url so HAR viewers do not reject', () => {
    const result = pageToHar(page({ url: null }));
    expect(result.title).toBe('');
  });
});

describe('pagesToHarForRefs', () => {
  it('returns empty when no pages match', () => {
    expect(pagesToHarForRefs([page({ id: 'page_1' })], new Set(['page_99']))).toEqual([]);
  });

  it('filters to referenced pages only and preserves arrival order', () => {
    const a = page({ id: 'page_1', url: 'https://openheaders.io/' });
    const b = page({ id: 'page_2', url: 'https://docs.openheaders.io/' });
    const c = page({ id: 'page_3', url: 'https://api.openheaders.io/' });
    const refs = new Set(['page_1', 'page_3']);
    const out = pagesToHarForRefs([a, b, c], refs);
    expect(out.map((p) => p.id)).toEqual(['page_1', 'page_3']);
  });

  describe('host-page adoption (CDP mode)', () => {
    it('adopts the host page block verbatim when its id matches a referenced page', () => {
      const host = hostPage({ id: 'page_1' });
      const out = pagesToHarForRefs([page({ id: 'page_1', dclMs: 120, loadMs: 480 })], new Set(['page_1']), undefined, [
        host,
      ]);
      // The exact host object — its sub-ms pageTimings floats, not the
      // CDP-projected dclMs/loadMs — is what lands in the export (byte parity).
      expect(out).toEqual([host]);
      expect(out[0]).toBe(host);
    });

    it('falls back to the CDP projection for a referenced page with no host page', () => {
      const a = page({ id: 'page_1', dclMs: 120, loadMs: 480 });
      const b = page({ id: 'page_2', url: 'https://docs.openheaders.io/', dclMs: 90, loadMs: 300 });
      const host = hostPage({ id: 'page_1' });
      const out = pagesToHarForRefs([a, b], new Set(['page_1', 'page_2']), undefined, [host]);
      // page_1 adopts the host block; page_2 (no host page) keeps CDP synthesis.
      expect(out[0]).toBe(host);
      expect(out[1]).toEqual(pageToHar(b));
    });

    it('keeps the CDP projection when no host pages are supplied', () => {
      const a = page({ id: 'page_1', dclMs: 120, loadMs: 480 });
      const out = pagesToHarForRefs([a], new Set(['page_1']));
      expect(out).toEqual([pageToHar(a)]);
    });

    it('ignores an empty host-page list (heuristic mode) and keeps CDP synthesis', () => {
      const a = page({ id: 'page_1', dclMs: 120, loadMs: 480 });
      const out = pagesToHarForRefs([a], new Set(['page_1']), undefined, []);
      expect(out).toEqual([pageToHar(a)]);
    });
  });
});
