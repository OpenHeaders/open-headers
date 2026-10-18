/**
 * useRefClassifier — one `{{ref}}` → resolved / unresolved reading for
 * every host that paints references: the line input's highlighted
 * spans and the Monaco buffers' inline decorations. Delegates to the
 * live renderer resolver, so the dress follows the variables as they
 * change; memoised by (resolver, collectionId) so a repaint never
 * builds a new closure.
 */

import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { useCallback } from 'react';
import type { RefState } from './highlight';

export type RefClassifier = (inner: string) => RefState;

export function useRefClassifier(collectionId: string | undefined): RefClassifier {
  const resolver = useVariableResolver();
  return useCallback(
    (inner: string): RefState => {
      const context = collectionId ? { collectionId } : undefined;
      const { errors } = resolver.resolveTemplate(`{{${inner}}}`, context);
      return errors.length === 0 ? 'resolved' : 'unresolved';
    },
    [resolver, collectionId],
  );
}
