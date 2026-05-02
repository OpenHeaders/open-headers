/**
 * `<RuleField>` — back-compat alias for the entity-agnostic
 * `<EntityField>` (lives in `@/shared/awareness`).
 *
 * Original session-57 RuleField was rule-specific: it owned its own
 * `RuleAwarenessContext` + `FocusedFieldContext`. The followup refactor
 * generalized those to `EntityScope` + `ActiveFieldFocus` so sidebar
 * inline-rename + breadcrumb inline-rename + every other entity's editor
 * can plug into the same primitives. RuleField is preserved as a
 * one-line alias so the existing rule-fields/* call sites keep working
 * without churn — new code is encouraged to use `<EntityField>`
 * directly.
 *
 * `FocusedFieldProvider` + `RuleAwarenessProvider` are also aliased
 * (the former no-ops, the latter forwards to `EntityScopeProvider`)
 * because RuleEditor still imports them. Once RuleEditor migrates to
 * the new providers, both aliases can disappear.
 */

import { EntityField, EntityScopeProvider } from '@/shared/awareness';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { ReactNode } from 'react';

export interface RuleFieldProps {
  path: string;
  /** Reserved for future positioning variants — `'none'` suppresses the chip. */
  chipPosition?: 'inline' | 'none';
  children: ReactNode;
}

export function RuleField({ path, chipPosition = 'inline', children }: RuleFieldProps): ReactNode {
  return (
    <EntityField path={path} hideChip={chipPosition === 'none'}>
      {children}
    </EntityField>
  );
}

// ── Legacy provider aliases ───────────────────────────────────────

/**
 * No-op alias retained for back-compat with RuleEditor's existing
 * `<FocusedFieldProvider value={setFocusedFieldPath}>` mount. The
 * underlying focus state now lives in `ActiveFieldFocusContext` at the
 * workspace level — RuleEditor's local setter is no longer the source
 * of truth. Future cleanup: delete this alias and the prop from
 * RuleEditor in the same diff.
 */
export function FocusedFieldProvider({ children }: { value: unknown; children: ReactNode }): ReactNode {
  return <>{children}</>;
}

/**
 * Alias forwarding to `<EntityScopeProvider>`. Keeps RuleEditor's
 * existing `<RuleAwarenessProvider value={{ruleUid, excludeInstanceId}}>`
 * mount call working without a manual rewrite. excludeInstanceId is no
 * longer needed at this layer (EntityField reads it from
 * `useLocalInstanceId`); we accept it in the prop shape and ignore it.
 */
export function RuleAwarenessProvider({
  value,
  children,
}: {
  value: { ruleUid: string | null; excludeInstanceId: string };
  children: ReactNode;
}): ReactNode {
  return (
    <EntityScopeProvider entityType={RULE_ENTITY_TYPE} entityId={value.ruleUid}>
      {children}
    </EntityScopeProvider>
  );
}
