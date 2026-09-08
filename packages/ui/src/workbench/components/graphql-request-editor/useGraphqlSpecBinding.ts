/**
 * useGraphqlSpecBinding — the GraphQL request's spec binding, the HTTP
 * reader's rule: the request's own ids-only `specLink` first, its
 * collection's second (a request inside a spec-generated collection
 * reads through the collection until it links its own). ONE reader
 * for the two surfaces that consume the link — the Spec tab (the
 * picker, the collection line, the drift) and the schema plane (the
 * linked spec is the schema source). Drift is judged against the
 * collection link's `sourceHash` whenever the effective spec is the
 * one the collection was generated from — a generated request carries
 * the same link the collection does, so its provenance still reads.
 */

import type { Collection, Spec } from '@openheaders/core/types';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { useMemo } from 'react';
import { useSpecSourceHash } from '../specs/use-spec-drift';
import type { GraphqlDraft } from './draft';

/** Where the effective link lives. */
export type GraphqlSpecLinkSource = 'request' | 'collection';

export type GraphqlSpecBinding =
  | { readonly kind: 'unlinked' }
  | { readonly kind: 'missing'; readonly source: GraphqlSpecLinkSource }
  | {
      readonly kind: 'linked';
      readonly source: GraphqlSpecLinkSource;
      readonly spec: Spec;
      /** The collection whose link names this same spec — the request
       *  inherits through it, or was generated from it. */
      readonly collection: Collection | null;
      /** `null` while the saved content is still hashing; `false` when
       *  no collection link judges this spec. */
      readonly drifted: boolean | null;
    };

export interface GraphqlSpecBindingState {
  readonly binding: GraphqlSpecBinding;
  /** The workspace's `graphql` specs — the picker's options. */
  readonly graphqlSpecs: readonly Spec[];
}

const UNLINKED: GraphqlSpecBinding = { kind: 'unlinked' };

function specRootContent(spec: Spec): string | null {
  const root = spec.files.find((f) => f.uid === spec.rootFileUid) ?? spec.files[0];
  return root ? root.content : null;
}

export function useGraphqlSpecBinding(
  workspaceId: string | null,
  collection: Collection | undefined,
  draft: GraphqlDraft,
): GraphqlSpecBindingState {
  const specs = useSpecs(workspaceId);
  const graphqlSpecs = useMemo(() => specs.filter((spec) => spec.format === 'graphql'), [specs]);
  const source: GraphqlSpecLinkSource | null = draft.specLink ? 'request' : collection?.specLink ? 'collection' : null;
  const specUid = draft.specLink?.specUid ?? collection?.specLink?.specUid;
  const spec = useMemo(
    () => (specUid === undefined ? null : (graphqlSpecs.find((s) => s.uid === specUid) ?? null)),
    [graphqlSpecs, specUid],
  );
  const judging = collection?.specLink !== undefined && collection.specLink.specUid === specUid ? collection : null;
  const savedHash = useSpecSourceHash(judging !== null && spec !== null ? specRootContent(spec) : null);

  return useMemo<GraphqlSpecBindingState>(() => {
    if (source === null) return { binding: UNLINKED, graphqlSpecs };
    if (spec === null) return { binding: { kind: 'missing', source }, graphqlSpecs };
    const drifted =
      judging === null || judging.specLink === undefined
        ? false
        : savedHash === null
          ? null
          : savedHash !== judging.specLink.sourceHash;
    return { binding: { kind: 'linked', source, spec, collection: judging, drifted }, graphqlSpecs };
  }, [source, spec, judging, savedHash, graphqlSpecs]);
}
