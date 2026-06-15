/**
 * `ActionPathsProvider` — entity-bound action-path bundle for shared
 * per-type field components (`rule-fields/*`).
 *
 * RuleEditor and TemplateEditor reuse the same per-rule-type field
 * components (`HeaderRuleFields`, `RequestBodyRuleFields`, …) but persist
 * action data under different schema roots:
 *
 *   - Rule:     `action.requestHeaders.<uid>.value` etc.
 *   - Template: `formValues.requestHeaders.<uid>.value` etc.
 *
 * Each editor wraps its rule-fields subtree with this provider passing
 * the appropriate bundle (`RULE_ACTION_PATHS` or `TEMPLATE_ACTION_PATHS`).
 * The shared field components call `useActionPaths()` to compose the
 * canonical path string for `<EntityField path={…}>` and conflict
 * tracker lookups, so a single body of code emits the right paths for
 * either entity.
 *
 * Default = `RULE_ACTION_PATHS` so existing rule-only callers (and
 * test renderers) compile unchanged. Future entities that reuse
 * rule-fields/* MUST mount the provider explicitly with their own
 * bundle.
 */

import { createContext, type ReactNode, useContext } from 'react';
import { type ActionPathBundle, RULE_ACTION_PATHS } from './rule-paths';

const Ctx = createContext<ActionPathBundle>(RULE_ACTION_PATHS);

export interface ActionPathsProviderProps {
  value: ActionPathBundle;
  children: ReactNode;
}

export function ActionPathsProvider({ value, children }: ActionPathsProviderProps): ReactNode {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useActionPaths(): ActionPathBundle {
  return useContext(Ctx);
}
