/**
 * Drift signal for spec-linked collections (API_SPECS_PLAN.md Phase F).
 *
 * Drift is judged at read time, never cached in the model: a link has
 * drifted when `hashImportSource(saved root content)` no longer equals
 * its `specLink.sourceHash`. Hashing is async (WebCrypto sha256), so
 * both hooks derive through effect + state — never render-inline — and
 * memoize by content string: a spec only rehashes when its saved
 * source actually changes, and sidebar-wide judgment skips specs with
 * no links at all.
 */

import { hashImportSource } from '@openheaders/core/import';
import type { Collection, Spec } from '@openheaders/core/types';
import { useEffect, useMemo, useRef, useState } from 'react';

const EMPTY_SET: ReadonlySet<string> = new Set();

function specRootContent(spec: Spec): string | null {
  const root = spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0];
  return root ? root.content : null;
}

/** sha256 of one saved source — `null` while unavailable or hashing. */
export function useSpecSourceHash(content: string | null): string | null {
  const [state, setState] = useState<{ content: string; hash: string } | null>(null);
  useEffect(() => {
    if (content === null) return;
    let alive = true;
    void hashImportSource(content).then((hash) => {
      if (alive) setState({ content, hash });
    });
    return () => {
      alive = false;
    };
  }, [content]);
  return content !== null && state?.content === content ? state.hash : null;
}

/**
 * Spec uids with at least one drifted linked collection — the sidebar
 * row badge signal. Content hashes live in a content-keyed cache so a
 * collection edit re-judges links without rehashing any spec.
 */
export function useDriftedSpecUids(specs: readonly Spec[], collections: readonly Collection[]): ReadonlySet<string> {
  const cacheRef = useRef(new Map<string, string>());
  const [cacheVersion, setCacheVersion] = useState(0);

  const linkedSpecUids = useMemo(() => {
    const uids = new Set<string>();
    for (const c of collections) {
      if (c.specLink) uids.add(c.specLink.specUid);
    }
    return uids;
  }, [collections]);

  // Contents needing a hash — only specs something actually links to.
  const pendingContents = useMemo(() => {
    const pending: string[] = [];
    for (const spec of specs) {
      if (!linkedSpecUids.has(spec.uid)) continue;
      const content = specRootContent(spec);
      if (content !== null && !cacheRef.current.has(content)) pending.push(content);
    }
    return pending;
  }, [specs, linkedSpecUids]);

  useEffect(() => {
    if (pendingContents.length === 0) return;
    let alive = true;
    void Promise.all(
      pendingContents.map(async (content) => {
        const hash = await hashImportSource(content);
        cacheRef.current.set(content, hash);
      }),
    ).then(() => {
      if (alive) setCacheVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [pendingContents]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: cacheVersion invalidates the memo when async hashes land in the ref cache
  return useMemo(() => {
    if (linkedSpecUids.size === 0) return EMPTY_SET;
    const hashBySpecUid = new Map<string, string>();
    for (const spec of specs) {
      if (!linkedSpecUids.has(spec.uid)) continue;
      const content = specRootContent(spec);
      const hash = content !== null ? cacheRef.current.get(content) : undefined;
      if (hash !== undefined) hashBySpecUid.set(spec.uid, hash);
    }
    const drifted = new Set<string>();
    for (const c of collections) {
      if (!c.specLink) continue;
      const hash = hashBySpecUid.get(c.specLink.specUid);
      if (hash !== undefined && hash !== c.specLink.sourceHash) drifted.add(c.specLink.specUid);
    }
    return drifted;
  }, [specs, collections, linkedSpecUids, cacheVersion]);
}
