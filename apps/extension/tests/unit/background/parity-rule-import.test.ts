/**
 * Parity rule import — the SW-global seam the fire-evidence probe seeds
 * rules through.
 *
 * Pins:
 *   - inert without the parity-hook flag (refuses, no oracle write);
 *   - completes a V5-shaped spec: nested uids minted (conditions +
 *     header mods), `published` forced true, `enabled` respected;
 *   - validates against RuleSchema before any write — a malformed spec
 *     fails the whole batch with no partial import;
 *   - rules land via `addRule` under the default collection's path.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const addRuleMock = vi.fn();
const ensureDefaultCollectionMock = vi.fn();

vi.mock('@openheaders/oracle/entity/rule-store', () => ({
  addRule: (...args: unknown[]) => addRuleMock(...args),
  ensureDefaultCollection: () => ensureDefaultCollectionMock(),
}));

import { installParityRuleImport, type ParityImportResult } from '@/background/modules/parity-rule-import';

function headerSpec(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Auth · inject valid bearer (override)',
    type: 'header',
    enabled: true,
    conditions: [{ type: 'url-filter', values: ['*://127.0.0.1:3000/api/secure/*'] }],
    action: {
      requestHeaders: [{ operation: 'override', headerName: 'Authorization', value: 'Bearer t' }],
      responseHeaders: [],
    },
    ...overrides,
  };
}

function setParityFlag(enabled: boolean): void {
  vi.mocked(chrome.storage.local.get).mockImplementation(
    () => Promise.resolve(enabled ? { __oh_parity_hook__: true } : {}) as never,
  );
}

async function importSpecs(specs: unknown[]): Promise<ParityImportResult> {
  installParityRuleImport();
  const fn = globalThis.__OH_PARITY_IMPORT_RULES__;
  if (!fn) throw new Error('global not installed');
  return fn(specs);
}

beforeEach(() => {
  addRuleMock.mockReset();
  ensureDefaultCollectionMock.mockReset();
  ensureDefaultCollectionMock.mockReturnValue({ uid: 'col00001', path: 'rules/my-rules-col00001', name: 'My Rules' });
  addRuleMock.mockImplementation(async (rule: Record<string, unknown>) => ({
    ...rule,
    schemaVersion: 5,
    uid: 'ru000001',
    path: `rules/my-rules-col00001/x-ru000001`,
  }));
});

describe('parity rule import — gating', () => {
  it('refuses when the parity-hook flag is not set', async () => {
    setParityFlag(false);
    const result = await importSpecs([headerSpec()]);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('parity hook') });
    expect(addRuleMock).not.toHaveBeenCalled();
  });
});

describe('parity rule import — spec completion', () => {
  beforeEach(() => setParityFlag(true));

  it('mints nested uids, forces published, and writes under the default collection', async () => {
    const result = await importSpecs([headerSpec()]);
    expect(result.ok).toBe(true);
    expect(addRuleMock).toHaveBeenCalledTimes(1);
    const [rule, parentPath] = addRuleMock.mock.calls[0] as [Record<string, unknown>, string];
    expect(parentPath).toBe('rules/my-rules-col00001');
    expect(rule.published).toBe(true);
    expect(rule.enabled).toBe(true);
    const conditions = rule.conditions as Array<{ uid: string }>;
    expect(conditions[0].uid).toMatch(/^[a-z0-9]{8}$/);
    const action = rule.action as { requestHeaders: Array<{ uid: string }> };
    expect(action.requestHeaders[0].uid).toMatch(/^[a-z0-9]{8}$/);
  });

  it('respects enabled:false (the disabled-rule negative is seedable)', async () => {
    const result = await importSpecs([headerSpec({ enabled: false })]);
    expect(result.ok).toBe(true);
    const [rule] = addRuleMock.mock.calls[0] as [Record<string, unknown>];
    expect(rule.enabled).toBe(false);
    expect(rule.published).toBe(true);
  });

  it('returns the created uid + name + completeness per imported rule', async () => {
    const result = await importSpecs([headerSpec()]);
    expect(result).toEqual({
      ok: true,
      rules: [{ uid: 'ru000001', name: 'Auth · inject valid bearer (override)', complete: true }],
    });
  });

  it('flags a schema-valid but never-compiling spec as incomplete (non-allowlisted append)', async () => {
    const spec = headerSpec({
      action: {
        requestHeaders: [],
        responseHeaders: [{ operation: 'add', headerName: 'X-OH-Custom', value: 'x-oh-added' }],
      },
    });
    const result = await importSpecs([spec]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rules[0].complete).toBe(false);
  });

  it('a malformed spec fails the whole batch before any write', async () => {
    const bad = headerSpec({ action: { requestHeaders: 'not-an-array', responseHeaders: [] } });
    const result = await importSpecs([headerSpec(), bad]);
    expect(result.ok).toBe(false);
    expect(addRuleMock).not.toHaveBeenCalled();
  });

  it('rejects non-object entries', async () => {
    const result = await importSpecs(['nope']);
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('spec[0]') });
  });
});
