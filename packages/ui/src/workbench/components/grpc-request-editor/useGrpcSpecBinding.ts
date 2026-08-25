/**
 * useGrpcSpecBinding — the editor's Protobuf spec binding in one hook:
 * the workspace's protobuf specs, the ids-only specLink resolved to
 * its live spec object, the method derivation over it (nothing
 * cached — `deriveGrpcMethods` tracks the live spec), and the manual
 * refresh nonce behind the two refresh affordances (the method
 * select's popup footer and the spec footer).
 */

import type { GrpcSpecLink } from '@openheaders/core/types';
import { useSpecs } from '@openheaders/ui/shared/hooks/readers/useSpecs';
import { useCallback, useMemo, useState } from 'react';
import { deriveGrpcMethods, type GrpcMethodDerivation } from './method-selector';

export interface GrpcSpecBinding {
  protobufSpecs: ReturnType<typeof useSpecs>;
  linkedSpec: ReturnType<typeof useSpecs>[number] | null;
  derivation: GrpcMethodDerivation | null;
  /** Parse failures + reference issues — the spec footer's count. */
  issueCount: number;
  /** Force a recompute — derivation already tracks the live spec
   *  object, so this is peace of mind only. */
  refreshDerivation: () => void;
}

export function useGrpcSpecBinding(specLink: GrpcSpecLink | undefined, workspaceId: string | null): GrpcSpecBinding {
  const specs = useSpecs(workspaceId);
  const protobufSpecs = useMemo(() => specs.filter((s) => s.format === 'protobuf'), [specs]);
  const linkedSpec = useMemo(
    () => (specLink ? (protobufSpecs.find((s) => s.uid === specLink.specUid) ?? null) : null),
    [protobufSpecs, specLink],
  );
  const [derivationNonce, setDerivationNonce] = useState(0);
  const derivation = useMemo(() => {
    void derivationNonce;
    return linkedSpec ? deriveGrpcMethods(linkedSpec) : null;
  }, [linkedSpec, derivationNonce]);
  const refreshDerivation = useCallback(() => setDerivationNonce((n) => n + 1), []);

  const issueCount = (derivation?.issues.length ?? 0) + (derivation?.parseFailures.length ?? 0);

  return { protobufSpecs, linkedSpec, derivation, issueCount, refreshDerivation };
}
