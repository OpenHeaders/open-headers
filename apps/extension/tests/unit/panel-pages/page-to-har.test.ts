/**
 * `pageToHar` projector — converts the page-stream `Page` primitive into
 * the HAR 1.2 `log.pages[i]` wire shape.
 */

import type { Page } from '@openheaders/core/page-stream';
import { describe, expect, it } from 'vitest';

import { pagesToHarForRefs, pageToHar } from '@openheaders/ui/panel/data/page-to-har';

function page(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page_1',
    startedAtMs: Date.UTC(2026, 0, 1, 12, 0, 0),
    url: 'https://openheaders.io/',
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
});
