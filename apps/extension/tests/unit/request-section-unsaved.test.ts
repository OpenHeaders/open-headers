/**
 * Per-section unsaved-vs-saved comparison (section-unsaved.ts) — the
 * saved side of the tab labels' dirty (salmon) tones. Sections slice
 * the same projection the derived-dirty fingerprint uses, so a
 * flagged section is exactly a reason the Save button is dirty.
 */

import type { AuthConfig } from '@openheaders/core/types';
import { buildRequestUpdates, type Draft, emptyDraft } from '@openheaders/ui/workbench/components/request-editor/draft';
import { makeKvRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import { unsavedSections } from '@openheaders/ui/workbench/components/request-editor/section-unsaved';
import { describe, expect, it } from 'vitest';

const updates = (overrides: Partial<Draft> = {}) => buildRequestUpdates({ ...emptyDraft(), ...overrides });

const CLEAN = {
  docs: false,
  params: false,
  auth: false,
  headers: false,
  body: false,
  preRequestScript: false,
  postResponseScript: false,
};

describe('unsavedSections', () => {
  it('reports all sections clean while draft and saved agree', () => {
    expect(unsavedSections(updates(), updates())).toEqual(CLEAN);
    const rich: Partial<Draft> = {
      description: 'notes',
      body: { type: 'json', content: '{"page": 2}' },
      preRequestScript: 'oh.log(1)',
    };
    expect(unsavedSections(updates(rich), updates(rich))).toEqual(CLEAN);
  });

  it('flags only the section that changed', () => {
    expect(unsavedSections(updates({ description: 'notes' }), updates())).toEqual({ ...CLEAN, docs: true });
    expect(unsavedSections(updates({ auth: { type: 'bearer', token: 't' } as AuthConfig }), updates())).toEqual({
      ...CLEAN,
      auth: true,
    });
    expect(unsavedSections(updates({ body: { type: 'json', content: '{}' } }), updates())).toEqual({
      ...CLEAN,
      body: true,
    });
  });

  it('flags headers and params on row edits, including row removal', () => {
    const row = makeKvRow({ key: 'X-Trace', value: '1', description: '', enabled: true });
    const withHeader = updates({ headers: [row] });
    expect(unsavedSections(withHeader, updates())).toEqual({ ...CLEAN, headers: true });
    // Removal is unsaved too — the section can be dirty with zero rows.
    expect(unsavedSections(updates(), withHeader)).toEqual({ ...CLEAN, headers: true });

    const param = makeKvRow({ key: 'page', value: '2', description: '', enabled: true });
    expect(unsavedSections(updates({ params: [param] }), updates())).toEqual({ ...CLEAN, params: true });
  });

  it('flags each script hook independently', () => {
    expect(unsavedSections(updates({ preRequestScript: 'oh.log(1)' }), updates())).toEqual({
      ...CLEAN,
      preRequestScript: true,
    });
    expect(unsavedSections(updates(), updates({ postResponseScript: 'oh.log(2)' }))).toEqual({
      ...CLEAN,
      postResponseScript: true,
    });
  });
});
