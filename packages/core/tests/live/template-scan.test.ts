import { describe, expect, it } from 'vitest';
import { scanTemplateReferences, scanTemplateReferencesMany } from '../../src/live/template-scan';

describe('scanTemplateReferences', () => {
  it('returns empty result for a template with no references', () => {
    expect(scanTemplateReferences('no variables here')).toEqual({ live: [], step: [], other: [] });
  });

  it('extracts {{live.X}} references', () => {
    const r = scanTemplateReferences('Bearer {{live.token}}');
    expect(r.live).toEqual(['token']);
    expect(r.step).toEqual([]);
    expect(r.other).toEqual([]);
  });

  it('extracts {{step.X.Y}} references, parsed into stepId + captureName', () => {
    const r = scanTemplateReferences('Cookie: session={{step.login.sessionId}}');
    expect(r.step).toEqual([{ stepId: 'login', captureName: 'sessionId' }]);
    expect(r.live).toEqual([]);
  });

  it('deduplicates repeated {{live.X}} references in first-seen order', () => {
    const r = scanTemplateReferences('{{live.a}} {{live.b}} {{live.a}}');
    expect(r.live).toEqual(['a', 'b']);
  });

  it('deduplicates repeated {{step.X.Y}} references by composite key', () => {
    const r = scanTemplateReferences('{{step.s.a}} {{step.s.a}} {{step.s.b}} {{step.t.a}}');
    expect(r.step).toEqual([
      { stepId: 's', captureName: 'a' },
      { stepId: 's', captureName: 'b' },
      { stepId: 't', captureName: 'a' },
    ]);
  });

  it('returns non-live/step refs in `other`', () => {
    const r = scanTemplateReferences('{{env.API}} {{vault.TOKEN}} {{live.x}}');
    expect(r.live).toEqual(['x']);
    expect(r.other.map((o) => `${o.namespace}.${o.name}`).sort()).toEqual(['env.API', 'vault.TOKEN']);
  });

  it('ignores malformed {{}} blocks', () => {
    const r = scanTemplateReferences('{{}} {{env.}} {{foo.X}} {{live.valid}}');
    expect(r.live).toEqual(['valid']);
  });

  it('ignores malformed step refs (missing capture name)', () => {
    // `step.login` parses via outer parser (namespace=step, name=login)
    // but `parseStepRefName` rejects single-segment names, so we drop it.
    const r = scanTemplateReferences('{{step.login}}');
    expect(r.step).toEqual([]);
  });

  it('handles flat {{X}} refs (no namespace) in `other`', () => {
    const r = scanTemplateReferences('{{API_URL}}');
    expect(r.other).toHaveLength(1);
    expect(r.other[0]).toMatchObject({ namespace: null, name: 'API_URL' });
  });
});

describe('scanTemplateReferencesMany', () => {
  it('aggregates across templates with global dedupe', () => {
    const r = scanTemplateReferencesMany([
      '{{live.token}} {{live.csrf}}',
      'Bearer {{live.token}}',
      '{{step.login.sid}}',
      '{{step.login.sid}}',
    ]);
    expect(r.live).toEqual(['token', 'csrf']);
    expect(r.step).toEqual([{ stepId: 'login', captureName: 'sid' }]);
  });

  it('preserves first-seen order across templates', () => {
    const r = scanTemplateReferencesMany(['{{live.b}}', '{{live.a}}', '{{live.b}}']);
    expect(r.live).toEqual(['b', 'a']);
  });

  it('collects non-namespaced refs in `other` across many templates', () => {
    const r = scanTemplateReferencesMany(['{{env.A}}', '{{env.B}}', '{{vault.C}}']);
    expect(r.other.map((o) => `${o.namespace}.${o.name}`)).toEqual(['env.A', 'env.B', 'vault.C']);
  });
});
