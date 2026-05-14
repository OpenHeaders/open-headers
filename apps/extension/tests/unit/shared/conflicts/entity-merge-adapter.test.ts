import { describe, expect, it, vi } from 'vitest';
import { buildEntityMergeSession } from '@openheaders/ui/shared/conflicts/entity-merge-adapter';

const baseArgs = {
  fileId: 'rule-abcd1234',
  label: 'Rule · openheaders.io / X-Auth',
  title: 'Resolve external changes — Rule',
  theirsText: 'kind: header\nname: X-Auth\n',
  mineText: 'kind: header\nname: X-Auth-Local\n',
  initialResult: 'kind: header\nname: X-Auth-Local\n',
  onApply: vi.fn(),
  onCancel: vi.fn(),
} as const;

describe('buildEntityMergeSession', () => {
  it('projects single file with provided text revisions', () => {
    const session = buildEntityMergeSession({ ...baseArgs });
    expect(session.title).toBe('Resolve external changes — Rule');
    expect(session.files).toHaveLength(1);
    const file = session.files[0];
    expect(file.id).toBe('rule-abcd1234');
    expect(file.kind).toBe('modify');
    expect(file.language).toBe('yaml');
    expect(file.theirs).toBe(baseArgs.theirsText);
    expect(file.mine).toBe(baseArgs.mineText);
    expect(file.initialResult).toBe(baseArgs.initialResult);
    expect(file.base).toBeUndefined();
  });

  it('passes baseText through when supplied (3-pane render)', () => {
    const session = buildEntityMergeSession({
      ...baseArgs,
      baseText: 'kind: header\nname: X-Auth-Base\n',
    });
    expect(session.files[0].base).toBe('kind: header\nname: X-Auth-Base\n');
  });

  it('Apply with a result text reports resolved + invokes onApply with the text', async () => {
    const onApply = vi.fn();
    const session = buildEntityMergeSession({ ...baseArgs, onApply });
    const results = new Map([[baseArgs.fileId, 'kind: header\nname: X-Auth-Final\n']]);
    const outcomes = await session.onApply(session.files, results);
    expect(onApply).toHaveBeenCalledWith('kind: header\nname: X-Auth-Final\n');
    expect(outcomes).toEqual([{ fileId: baseArgs.fileId, ok: true, status: 'resolved' }]);
  });

  it('Apply without a result for the file reports unresolved + does NOT invoke onApply', async () => {
    const onApply = vi.fn();
    const session = buildEntityMergeSession({ ...baseArgs, onApply });
    const outcomes = await session.onApply(session.files, new Map());
    expect(onApply).not.toHaveBeenCalled();
    expect(outcomes).toEqual([{ fileId: baseArgs.fileId, ok: true, status: 'unresolved' }]);
  });

  it('Apply surfaces onApply errors as ok=false outcomes with the message', async () => {
    const onApply = vi.fn().mockRejectedValue(new Error('parse failed: line 4'));
    const session = buildEntityMergeSession({ ...baseArgs, onApply });
    const results = new Map([[baseArgs.fileId, 'broken: yaml: :: :']]);
    const outcomes = await session.onApply(session.files, results);
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].ok).toBe(false);
    expect(outcomes[0].status).toBe('resolved');
    expect(outcomes[0].error).toBe('parse failed: line 4');
  });

  it('Apply coerces non-Error throws to string error messages', async () => {
    const onApply = vi.fn().mockImplementation(() => {
      throw 'string-only failure';
    });
    const session = buildEntityMergeSession({ ...baseArgs, onApply });
    const outcomes = await session.onApply(session.files, new Map([[baseArgs.fileId, 'x']]));
    expect(outcomes[0].ok).toBe(false);
    expect(outcomes[0].error).toBe('string-only failure');
  });

  it('onCancel passthrough is a stable reference', () => {
    const onCancel = vi.fn();
    const session = buildEntityMergeSession({ ...baseArgs, onCancel });
    session.onCancel();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('respects an explicit language override (e.g. json)', () => {
    const session = buildEntityMergeSession({ ...baseArgs, language: 'json' });
    expect(session.files[0].language).toBe('json');
  });
});
