/**
 * ResolvedHeaderValue — renders a header value with `{{ref}}` tokens
 * replaced by their resolved values. Display-only: variable *editing*
 * happens inside the rule popover's `TemplateInput` (which natively
 * opens the variable hover popover for each `{{ref}}` it contains).
 * Hovering on the resolved chunks here would race with the row-level
 * rule popover and split the affordance — not worth the complexity.
 *
 * Resolved chunks keep the `oh-template-ref-resolved` class so they
 * render with the same blue highlight workbench template editors use,
 * making it visually clear which substring came from which variable.
 */

import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import { parseReference } from '@openheaders/core/variables';

interface ResolvedHeaderValueProps {
  /** Raw value from the rule modification — may contain `{{ref}}` tokens. */
  value: string;
  /** Owning collection for `{{collection.X}}` resolution. */
  collectionId?: string;
}

const TEMPLATE_REGEX = /\{\{([^}]+)\}\}/g;

export function ResolvedHeaderValue({ value, collectionId }: ResolvedHeaderValueProps) {
  const resolver = useVariableResolver();

  const ctx = collectionId ? { collectionId } : undefined;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const match of value.matchAll(TEMPLATE_REGEX)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start > last) parts.push(value.slice(last, start));
    const inner = match[1].trim();
    // Bare `resolve(name)` only handles flat refs; namespaced refs
    // (`env.X`, `vault.X`, `collection.X`, …) need the parsed
    // namespace + `resolveScoped`. Mirrors how `resolveTemplate`
    // dispatches internally so the panel resolves identically to
    // the workbench mirror highlighter.
    const parsed = parseReference(inner);
    const resolved = parsed.ok
      ? parsed.ref.namespace === null
        ? resolver.resolve(parsed.ref.name, ctx)
        : resolver.resolveScoped(parsed.ref.name, parsed.ref.namespace, ctx)
      : null;
    const isResolved = resolved !== null && !resolved.deferred;
    const display = isResolved ? resolved.value : match[0];
    const cls = isResolved ? 'oh-template-ref oh-template-ref-resolved' : 'oh-template-ref oh-template-ref-unresolved';
    parts.push(
      <span
        key={`r-${key++}`}
        className={cls}
        data-ref={inner}
        title={isResolved ? `${match[0]} → ${resolved.value}` : `${match[0]} (unresolved)`}
      >
        {display}
      </span>,
    );
    last = end;
  }
  if (last < value.length) parts.push(value.slice(last));

  return <>{parts}</>;
}
