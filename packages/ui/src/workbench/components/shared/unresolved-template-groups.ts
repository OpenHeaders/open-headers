/**
 * Per-group `{{ref}}` resolvability — the session-kind editors' and the
 * GraphQL editor's twin of the HTTP editor's `useSectionUnresolved`,
 * over the template groups a core scan hands back
 * (`collectMqttTemplateGroups` and its siblings) instead of a hand-
 * written per-tab walk: the core scan IS the executor's field list, so
 * the editor's dots and lifecycle flag can never flag a field the wire
 * never resolves, nor miss one it does. The editor maps the entity
 * field groups onto its own tabs.
 *
 * One resolver pass per group, memoized on the groups' identity; the
 * caller derives the groups from the same save projection its dirty
 * fingerprint reads, so a keystroke re-walks once.
 */

import { resolveTemplate } from '@openheaders/core/variables';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/variables/useVariableResolver';
import { useMemo } from 'react';

export interface UnresolvedTemplateGroups<G extends string> {
  /** The groups with at least one `{{ref}}` that fails to resolve in the active scope. */
  unresolvedGroups: ReadonlySet<G>;
  /** The OR aggregate — the editor shell's lifecycle flag. */
  hasUnresolvedRefs: boolean;
}

export function useUnresolvedTemplateGroups<G extends string>(
  groups: Readonly<Record<G, readonly string[]>>,
  collectionId: string | undefined,
): UnresolvedTemplateGroups<G> {
  const resolver = useVariableResolver();
  return useMemo(() => {
    const context = collectionId ? { collectionId } : undefined;
    const flat = (name: string) => resolver.resolve(name, context);
    const scoped = (name: string, ns: Parameters<typeof resolver.resolveScopedWithDiagnostics>[1]) =>
      resolver.resolveScopedWithDiagnostics(name, ns, context);
    const unresolvedGroups = new Set<G>();
    for (const group in groups) {
      for (const s of groups[group]) {
        if (!s) continue;
        if (resolveTemplate(s, flat, scoped).errors.length > 0) {
          unresolvedGroups.add(group);
          break;
        }
      }
    }
    return { unresolvedGroups, hasUnresolvedRefs: unresolvedGroups.size > 0 };
  }, [groups, collectionId, resolver]);
}
