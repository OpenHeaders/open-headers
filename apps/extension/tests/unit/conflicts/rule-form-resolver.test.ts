/**
 * `applyResolutionToForm` per-rule-type write coverage.
 *
 * Path → form-name mapping is rule-type-aware (header rows live as
 * indexed Form.List entries, scalar fields live at top level, mock
 * `responseHeaders` is a Record so write is skipped). Tests assert
 * each branch's behavior + that unsupported paths return false without
 * mutating the form.
 */

import type { Rule } from '@openheaders/core/types';
import {
  applyResolutionToForm,
  applyResolutionToRule,
} from '@openheaders/ui/workbench/components/rule-fields/rule-form-resolver';
import type { FormInstance } from 'antd';
import { describe, expect, it, vi } from 'vitest';

function makeForm(): FormInstance {
  const writes: Array<[unknown, unknown]> = [];
  const fake = {
    setFieldValue: vi.fn((name, value) => {
      writes.push([name, value]);
    }),
  } as unknown as FormInstance & { setFieldValue: ReturnType<typeof vi.fn> };
  return fake;
}

const RULE_HEADER: Rule = {
  uid: 'r-1',
  path: 'rules/r-1.yaml',
  name: 'h',
  enabled: true,
  type: 'header',
  schemaVersion: 5,
  conditions: [],
  action: {
    requestHeaders: [{ uid: 'aaaaaaaa', operation: 'override', headerName: 'X-A', value: 'v0' }],
    responseHeaders: [{ uid: 'cccccccc', operation: 'override', headerName: 'X-R', value: 'v1' }],
  },
} as unknown as Rule;

const RULE_REDIRECT: Rule = {
  uid: 'r-2',
  path: 'rules/r-2.yaml',
  name: 'r',
  enabled: true,
  type: 'redirect',
  schemaVersion: 5,
  conditions: [],
  action: { redirectTo: 'https://openheaders.io/old' },
} as unknown as Rule;

function leafConflict(theirs: string): import('@openheaders/ui/shared/conflicts/types').PathConflict {
  return { kind: 'leaf', base: '(prev)', theirs };
}

describe('applyResolutionToForm', () => {
  it('writes header-row leaf via Form.List index lookup', () => {
    const form = makeForm();
    const ok = applyResolutionToForm(
      form,
      RULE_HEADER,
      'action.requestHeaders.aaaaaaaa.value',
      leafConflict('v-saved'),
    );
    expect(ok).toBe(true);
    expect((form.setFieldValue as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      ['requestHeaders', 0, 'value'],
      'v-saved',
    ]);
  });

  it('writes response-header row at the right index', () => {
    const form = makeForm();
    const ok = applyResolutionToForm(
      form,
      RULE_HEADER,
      'action.responseHeaders.cccccccc.headerName',
      leafConflict('X-R-Saved'),
    );
    expect(ok).toBe(true);
    expect((form.setFieldValue as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      ['responseHeaders', 0, 'headerName'],
      'X-R-Saved',
    ]);
  });

  it('writes top-level scalar (redirectTo) for redirect rule', () => {
    const form = makeForm();
    const ok = applyResolutionToForm(
      form,
      RULE_REDIRECT,
      'action.redirectTo',
      leafConflict('https://openheaders.io/new'),
    );
    expect(ok).toBe(true);
    expect((form.setFieldValue as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      'redirectTo',
      'https://openheaders.io/new',
    ]);
  });

  it('skips name (lives on entity, not form) and conditions (imperative state)', () => {
    const form = makeForm();
    expect(applyResolutionToForm(form, RULE_HEADER, 'name', leafConflict('new'))).toBe(false);
    expect(applyResolutionToForm(form, RULE_HEADER, 'conditions.aaaaaaaa.values', leafConflict('x'))).toBe(false);
    expect(form.setFieldValue as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('returns false when the row uid is not in the rule any more', () => {
    const form = makeForm();
    expect(applyResolutionToForm(form, RULE_HEADER, 'action.requestHeaders.deadbeef.value', leafConflict('x'))).toBe(
      false,
    );
    expect(form.setFieldValue as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
  });

  it('returns false for mock Record-keyed responseHeaders (out of scope)', () => {
    const mockRule = { ...RULE_HEADER, type: 'mock', action: { responseHeaders: { 'X-A': 'v' } } } as unknown as Rule;
    const form = makeForm();
    expect(applyResolutionToForm(form, mockRule, 'action.responseHeaders.X-A.value', leafConflict('x'))).toBe(false);
  });

  it('set-add: appends saved row payload to form array', () => {
    const fake: Record<string, unknown> = {
      requestHeaders: [{ uid: 'aaaaaaaa', operation: 'override', headerName: 'X-A', value: 'v0' }],
    };
    const form = {
      getFieldValue: (n: string) => fake[n],
      setFieldValue: vi.fn((n: string, v: unknown) => {
        fake[n] = v;
      }),
    } as unknown as import('antd').FormInstance;
    const newRow = { uid: 'newrow12', operation: 'override', headerName: 'X-B', value: '7' };
    const ok = applyResolutionToForm(form, RULE_HEADER, 'set:action.requestHeaders.newrow12', {
      kind: 'set-add',
      base: '',
      theirs: 'X-B: 7',
      rowPayload: newRow,
    });
    expect(ok).toBe(true);
    expect(fake.requestHeaders as Array<{ uid: string }>).toHaveLength(2);
    expect((fake.requestHeaders as Array<{ uid: string }>)[1].uid).toBe('newrow12');
  });

  it('set-reorder: sorts the form array to match saved-side uid order', () => {
    const fake: Record<string, unknown> = {
      requestHeaders: [
        { uid: 'aaaaaaaa', headerName: 'X-A' },
        { uid: 'bbbbbbbb', headerName: 'X-B' },
        { uid: 'cccccccc', headerName: 'X-C' },
      ],
    };
    const form = {
      getFieldValue: (n: string) => fake[n],
      setFieldValue: vi.fn((n: string, v: unknown) => {
        fake[n] = v;
      }),
    } as unknown as import('antd').FormInstance;
    const ok = applyResolutionToForm(form, RULE_HEADER, 'reorder:action.requestHeaders', {
      kind: 'set-reorder',
      base: 'X-A → X-B → X-C',
      theirs: 'X-C → X-A → X-B',
      rowPayload: { savedOrder: ['cccccccc', 'aaaaaaaa', 'bbbbbbbb'] },
    });
    expect(ok).toBe(true);
    expect((fake.requestHeaders as Array<{ uid: string }>).map((r) => r.uid)).toEqual([
      'cccccccc',
      'aaaaaaaa',
      'bbbbbbbb',
    ]);
  });

  it('set-reorder: keeps locally-added rows (not in saved order) on the tail', () => {
    const fake: Record<string, unknown> = {
      requestHeaders: [
        { uid: 'aaaaaaaa' },
        { uid: 'bbbbbbbb' },
        { uid: 'localnew' }, // user added locally; not in savedOrder
      ],
    };
    const form = {
      getFieldValue: (n: string) => fake[n],
      setFieldValue: vi.fn((n: string, v: unknown) => {
        fake[n] = v;
      }),
    } as unknown as import('antd').FormInstance;
    const ok = applyResolutionToForm(form, RULE_HEADER, 'reorder:action.requestHeaders', {
      kind: 'set-reorder',
      base: '',
      theirs: '',
      rowPayload: { savedOrder: ['bbbbbbbb', 'aaaaaaaa'] },
    });
    expect(ok).toBe(true);
    expect((fake.requestHeaders as Array<{ uid: string }>).map((r) => r.uid)).toEqual([
      'bbbbbbbb',
      'aaaaaaaa',
      'localnew',
    ]);
  });

  it('set-remove: drops the matching row from the form array', () => {
    const fake: Record<string, unknown> = {
      requestHeaders: [
        { uid: 'aaaaaaaa', operation: 'override', headerName: 'X-A', value: 'v0' },
        { uid: 'bbbbbbbb', operation: 'override', headerName: 'X-B', value: 'v1' },
      ],
    };
    const form = {
      getFieldValue: (n: string) => fake[n],
      setFieldValue: vi.fn((n: string, v: unknown) => {
        fake[n] = v;
      }),
    } as unknown as import('antd').FormInstance;
    const ok = applyResolutionToForm(form, RULE_HEADER, 'set:action.requestHeaders.bbbbbbbb', {
      kind: 'set-remove',
      base: 'X-B: v1',
      theirs: '',
    });
    expect(ok).toBe(true);
    expect(fake.requestHeaders as Array<{ uid: string }>).toHaveLength(1);
    expect((fake.requestHeaders as Array<{ uid: string }>)[0].uid).toBe('aaaaaaaa');
  });
});

describe('applyResolutionToRule', () => {
  it('mutates header-row leaf in place', () => {
    const rule = JSON.parse(JSON.stringify(RULE_HEADER)) as Rule;
    const ok = applyResolutionToRule(rule, 'action.requestHeaders.aaaaaaaa.value', leafConflict('v-saved'));
    expect(ok).toBe(true);
    if (rule.type !== 'header') throw new Error('expected header');
    expect(rule.action.requestHeaders[0].value).toBe('v-saved');
  });

  it('mutates top-level scalar', () => {
    const rule = JSON.parse(JSON.stringify(RULE_REDIRECT)) as Rule;
    const ok = applyResolutionToRule(rule, 'action.redirectTo', leafConflict('https://openheaders.io/new'));
    expect(ok).toBe(true);
    if (rule.type !== 'redirect') throw new Error('expected redirect');
    expect(rule.action.redirectTo).toBe('https://openheaders.io/new');
  });

  it('mutates rule.name', () => {
    const rule = JSON.parse(JSON.stringify(RULE_HEADER)) as Rule;
    const ok = applyResolutionToRule(rule, 'name', leafConflict('renamed'));
    expect(ok).toBe(true);
    expect(rule.name).toBe('renamed');
  });

  it('returns false for unknown rows', () => {
    const rule = JSON.parse(JSON.stringify(RULE_HEADER)) as Rule;
    expect(applyResolutionToRule(rule, 'action.requestHeaders.deadbeef.value', leafConflict('x'))).toBe(false);
  });

  it('set-add inserts the row into the rule array', () => {
    const rule = JSON.parse(JSON.stringify(RULE_HEADER)) as Rule;
    if (rule.type !== 'header') throw new Error('expected header');
    const newRow = { uid: 'newrow12', operation: 'override', headerName: 'X-B', value: '7' };
    const ok = applyResolutionToRule(rule, 'set:action.requestHeaders.newrow12', {
      kind: 'set-add',
      base: '',
      theirs: 'X-B: 7',
      rowPayload: newRow,
    });
    expect(ok).toBe(true);
    expect(rule.action.requestHeaders).toHaveLength(2);
  });

  it('set-remove drops the row from the rule array', () => {
    const rule = JSON.parse(JSON.stringify(RULE_HEADER)) as Rule;
    if (rule.type !== 'header') throw new Error('expected header');
    const ok = applyResolutionToRule(rule, 'set:action.requestHeaders.aaaaaaaa', {
      kind: 'set-remove',
      base: 'X-A: v0',
      theirs: '',
    });
    expect(ok).toBe(true);
    expect(rule.action.requestHeaders).toHaveLength(0);
  });
});
