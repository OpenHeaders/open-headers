// @vitest-environment jsdom
/**
 * Per-section `{{ref}}` resolvability (useSectionUnresolved.ts) — the
 * Params tab's red dot covers the Path Parameters VALUES: a template
 * field like the query rows', on the same tab. A literal value never
 * dots; the keys are identifiers and are never walked.
 */

import type { Draft } from '@openheaders/ui/workbench/components/request-editor/draft';
import { emptyDraft } from '@openheaders/ui/workbench/components/request-editor/draft';
import { makeKvRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import { useSectionUnresolved } from '@openheaders/ui/workbench/components/request-editor/useSectionUnresolved';
// Side-effect import — the resolver's inputs read workbench settings
// via `useSyncExternalStore`; the schema barrel registers defaults.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});

function draftWithPathValue(value: string): Draft {
  return {
    ...emptyDraft(),
    url: 'https://api.openheaders.io/users/:userId',
    pathParams: [makeKvRow({ uid: 'pth00001', key: 'userId', value, enabled: true })],
  };
}

describe('useSectionUnresolved — path parameter values', () => {
  it('a literal path value leaves the Params dot off', () => {
    const { result } = renderHook(() => useSectionUnresolved(draftWithPathValue('7'), undefined));
    expect(result.current.sectionUnresolved.params).toBe(false);
    expect(result.current.hasUnresolvedRefs).toBe(false);
  });

  it('an unresolved {{ref}} in a path value dots the Params tab and gates Send', () => {
    const { result } = renderHook(() =>
      useSectionUnresolved(draftWithPathValue('{{env.NO_SUCH_VARIABLE_FOR_THIS_TEST}}'), undefined),
    );
    expect(result.current.sectionUnresolved.params).toBe(true);
    expect(result.current.sectionUnresolved.url).toBe(false);
    expect(result.current.hasUnresolvedRefs).toBe(true);
  });
});
