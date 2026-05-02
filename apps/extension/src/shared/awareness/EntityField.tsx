/**
 * `<EntityField>` — entity-agnostic per-field awareness wrapper.
 *
 * One primitive used by every editor, sidebar row, breadcrumb, popover,
 * and devpanel surface that lets the user interact with a specific
 * `(entity, fieldPath)`. Two responsibilities:
 *
 *   1. **Publish focus.** On focus inside the wrapper, write the
 *      canonical `{entityType, entityId, path}` triple to
 *      `ActiveFieldFocusContext`. The workspace-level
 *      `<WorkbenchAwarenessSlot>` reads from there and pushes it to the
 *      SW awareness store. On blur out, clear the focus.
 *
 *   2. **Render the presence chip.** Mount `<FieldPresenceChip>` inline
 *      after the wrapped child, scoped to the same triple, so peers
 *      focused on this same `(entity, path)` show up beside the input
 *      regardless of which surface they're using to edit.
 *
 * Entity identity comes from `EntityScope` context by default (so a
 * RuleEditor / RequestEditor / etc. only declares the scope once) and
 * can be overridden per-call via `entityType` / `entityId` props (used
 * by sidebar rows whose surrounding scope differs from the row's
 * entity, and by the breadcrumb whose entity comes from the active
 * tab).
 *
 * Adding a new entity type does NOT require touching this file. Define
 * a `<entity>-paths.ts` with `RULE_FIELD`-shape generators, mount an
 * `<EntityScopeProvider>` at your editor root, wrap fields with
 * `<EntityField path={…}>`. The publish + chip rendering plumbing
 * already covers it.
 */

import { useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSetActiveFieldFocus } from './ActiveFieldFocus';
import { useEntityScope } from './EntityScope';
import FieldPresenceChip from './FieldPresenceChip';
import { useLocalInstanceId } from './IdentityContext';

export interface EntityFieldProps {
  /** Canonical field path inside the entity (e.g. `'name'`,
   *  `'action.requestHeaders.<uid>.value'`). The same string the SW
   *  awareness store keys per-field presence by — peers must agree on
   *  it for chips to render. */
  path: string;
  /** Override the surrounding `EntityScope`. Required for sidebar rows
   *  + breadcrumb (whose scope is the workspace, not the row's entity). */
  entityType?: string;
  entityId?: string | null;
  /** Suppress the inline chip slot — use when the chip is rendered
   *  somewhere else for layout reasons (e.g. the chip lives in a
   *  sibling column of a grid). Focus publishing still fires. */
  hideChip?: boolean;
  children: ReactNode;
}

export function EntityField({
  path,
  entityType,
  entityId,
  hideChip,
  children,
}: EntityFieldProps): ReactNode {
  const scope = useEntityScope();
  const eType = entityType ?? scope.entityType;
  const eId = entityId !== undefined ? entityId : scope.entityId;
  const setFocus = useSetActiveFieldFocus();
  const localInstanceId = useLocalInstanceId();

  const handleFocus = useCallback(() => {
    if (!eId || !eType) return;
    setFocus({ entityType: eType, entityId: eId, path });
  }, [eType, eId, path, setFocus]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLSpanElement>) => {
      // Only clear when focus leaves the wrapper entirely; intra-wrapper
      // focus shifts (sub-input → sub-input) get a new focus event that
      // re-publishes the same path with no flicker.
      const next = e.relatedTarget as HTMLElement | null;
      if (next && e.currentTarget.contains(next)) return;
      setFocus(null);
    },
    [setFocus],
  );

  const showChip = !hideChip && eId !== null && eId !== undefined && eType !== '' && localInstanceId !== '';

  return (
    <span onFocusCapture={handleFocus} onBlurCapture={handleBlur} style={{ display: 'contents' }}>
      {children}
      {showChip && (
        <FieldPresenceChip
          entityType={eType}
          entityId={eId}
          fieldPath={path}
          excludeInstanceId={localInstanceId}
          style={{ marginLeft: 4 }}
        />
      )}
    </span>
  );
}
