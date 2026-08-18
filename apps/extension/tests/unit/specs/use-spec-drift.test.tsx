/**
 * Drift hooks (the API-specs plan Phase F) — drift derives at read time
 * from `hashImportSource(saved root content)` vs each link's
 * `specLink.sourceHash`; nothing is ever cached in the model.
 */

import { hashImportSource } from '@openheaders/core/import';
import type { Collection, Spec } from '@openheaders/core/types';
import { useDriftedSpecUids, useSpecSourceHash } from '@openheaders/ui/workbench/components/specs/use-spec-drift';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const CONTENT = "openapi: '3.1.0'\ninfo:\n  title: OpenHeaders API\n";

function makeSpec(): Spec {
  return {
    schemaVersion: 5,
    uid: 'spc00001',
    path: 'specs/openheaders-api-spc00001',
    name: 'OpenHeaders API',
    format: 'openapi-3.1',
    rootFileUid: 'fil00001',
    files: [{ uid: 'fil00001', fileName: 'index.yaml', content: CONTENT }],
  };
}

function makeCollection(sourceHash: string): Collection {
  return {
    schemaVersion: 5,
    uid: 'col00001',
    path: 'requests/openheaders-api-col00001',
    name: 'OpenHeaders API',
    variables: [],
    pinnedEnvironmentIds: [],
    defaultEnvironmentId: null,
    specLink: { specUid: 'spc00001', sourceHash },
  };
}

describe('useSpecSourceHash', () => {
  it('derives the saved source hash, null while pending or absent', async () => {
    const { result, rerender } = renderHook(({ content }: { content: string | null }) => useSpecSourceHash(content), {
      initialProps: { content: CONTENT as string | null },
    });
    expect(result.current).toBeNull();
    const expected = await hashImportSource(CONTENT);
    await waitFor(() => expect(result.current).toBe(expected));
    rerender({ content: null });
    expect(result.current).toBeNull();
  });
});

describe('useDriftedSpecUids', () => {
  it('flags a spec whose linked collection carries a stale source hash', async () => {
    const specs = [makeSpec()];
    const { result } = renderHook(() => useDriftedSpecUids(specs, [makeCollection('sha256:stale')]));
    await waitFor(() => expect(result.current.has('spc00001')).toBe(true));
  });

  it('clears once the link matches the saved source', async () => {
    const specs = [makeSpec()];
    const currentHash = await hashImportSource(CONTENT);
    const { result, rerender } = renderHook(
      ({ collections }: { collections: Collection[] }) => useDriftedSpecUids(specs, collections),
      { initialProps: { collections: [makeCollection('sha256:stale')] } },
    );
    // Prove the hash landed via the drifted state, then converge.
    await waitFor(() => expect(result.current.has('spc00001')).toBe(true));
    rerender({ collections: [makeCollection(currentHash)] });
    await waitFor(() => expect(result.current.size).toBe(0));
  });
});
