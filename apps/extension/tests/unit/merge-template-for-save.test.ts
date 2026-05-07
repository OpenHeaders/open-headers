import type { V5 } from '@openheaders/core/types';
import { describe, expect, it } from 'vitest';
import {
  mergeTemplateForSave,
  type TemplateSaveBatch,
} from '@/workbench/components/merge-template-for-save';

const hmod = (uid: string, headerName: string, value: string): V5.HeaderModification => ({
  uid,
  operation: 'override',
  headerName,
  value,
});

function makeTpl(overrides: Partial<V5.Template> = {}): V5.Template {
  return {
    schemaVersion: 5,
    uid: 'tpl-aaaa',
    path: 'templates/tpl-aaaa',
    name: 'Bearer',
    ruleType: 'header',
    icon: '',
    description: '',
    includes: { conditions: true, formValues: true },
    conditions: [],
    formValues: { requestHeaders: [], responseHeaders: [] },
    createdAt: '2026-04-19T00:00:00.000Z',
    updatedAt: '2026-04-19T00:00:00.000Z',
    ...overrides,
  };
}

function batchOf(t: V5.Template): TemplateSaveBatch {
  return {
    name: t.name,
    icon: t.icon,
    description: t.description,
    includes: t.includes,
    conditions: t.conditions,
    formValues: t.formValues,
  };
}

describe('mergeTemplateForSave', () => {
  it('passes form through when baseline/live missing', () => {
    const form = batchOf(makeTpl({ name: 'Foo' }));
    expect(mergeTemplateForSave(form, null, null)).toEqual(form);
  });

  it('adopts live name for untouched name', () => {
    const baseline = makeTpl({ name: 'Foo' });
    const live = makeTpl({ name: 'Renamed' });
    const form = batchOf(baseline);
    const merged = mergeTemplateForSave(form, baseline, live);
    expect(merged.name).toBe('Renamed');
  });

  it('keeps form name for touched name', () => {
    const baseline = makeTpl({ name: 'Foo' });
    const live = makeTpl({ name: 'Renamed' });
    const form = batchOf(makeTpl({ name: 'Mine' }));
    const merged = mergeTemplateForSave(form, baseline, live);
    expect(merged.name).toBe('Mine');
  });

  it('per-row merges formValues.requestHeaders by uid', () => {
    const baseline = makeTpl({
      formValues: {
        requestHeaders: [hmod('a', 'X-A', 'b1'), hmod('b', 'X-B', 'b2')],
        responseHeaders: [],
      },
    });
    const live = makeTpl({
      formValues: {
        requestHeaders: [hmod('a', 'X-A', 'live1'), hmod('b', 'X-B', 'b2')],
        responseHeaders: [],
      },
    });
    const form = batchOf(
      makeTpl({
        formValues: {
          requestHeaders: [hmod('a', 'X-A', 'b1'), hmod('b', 'X-B', 'mine2')],
          responseHeaders: [],
        },
      }),
    );
    const merged = mergeTemplateForSave(form, baseline, live);
    expect(merged.formValues.requestHeaders).toEqual([
      hmod('a', 'X-A', 'live1'),
      hmod('b', 'X-B', 'mine2'),
    ]);
  });

  it('per-row merges conditions by uid', () => {
    const c = (uid: string, value: string): V5.RuleCondition => ({
      uid,
      type: 'request-domains',
      values: [value],
    });
    const baseline = makeTpl({ conditions: [c('a', 'b1'), c('b', 'b2')] });
    const live = makeTpl({ conditions: [c('a', 'live1'), c('b', 'b2')] });
    const form = batchOf(makeTpl({ conditions: [c('a', 'b1'), c('b', 'mine2')] }));
    const merged = mergeTemplateForSave(form, baseline, live);
    expect(merged.conditions).toEqual([c('a', 'live1'), c('b', 'mine2')]);
  });
});
