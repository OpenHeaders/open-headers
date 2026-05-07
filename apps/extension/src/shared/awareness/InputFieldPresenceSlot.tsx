/**
 * `<InputFieldPresenceSlot>` — overlay the per-field presence chip
 * inside a bordered input.
 *
 * Default `EntityField` chip rendering uses `display: contents` so the
 * chip becomes a flex sibling of the wrapped child. That's exactly
 * right for variable-table cells where the cell border surrounds
 * input + chip uniformly, and the input itself is borderless. For
 * antd-style outlined inputs (every rule editor input, plus the
 * scalar inputs in Request / Live editors) the chip ends up OUTSIDE
 * the input border, eating row width and reading as "next to" rather
 * than "in" the field.
 *
 * This wrapper takes over chip positioning: relative-positioned outer
 * box around the input; chip absolute-positioned at the right edge of
 * the input border so it visually sits inside the field. Width-stable
 * — the chip never affects the input's allotted flex width.
 *
 * Pair with `<EntityField hideChip>` (which still publishes focus) so
 * focus + chip rendering stay logically together but layout is
 * deterministic.
 */

import type { ReactNode } from 'react';
import FieldPresenceChip from './FieldPresenceChip';
import { useFieldPresence } from './use-entity-presence';

export interface InputFieldPresenceSlotProps {
  entityType: string;
  entityId: string | null | undefined;
  fieldPath: string;
  excludeInstanceId: string;
  /** The input (or input wrapper) to overlay the chip on top of. */
  children: ReactNode;
  /** Optional outer style (e.g. `flex: 1` for inline layout). */
  style?: React.CSSProperties;
}

/** Width reserved on the right when a peer is focused on this field.
 *  The chip itself is ≤16×~20–28px depending on count + dot density;
 *  28px buys a single chip + a small breathing gap before the input's
 *  border. Reservation is conditional — when no peer is focused on
 *  this exact field, the input gets its full width. Same shape the
 *  variable table uses (chip is a flex sibling that adds width only
 *  when mounted). */
const RESERVED_RIGHT_PX = 28;

const InputFieldPresenceSlot: React.FC<InputFieldPresenceSlotProps> = ({
  entityType,
  entityId,
  fieldPath,
  excludeInstanceId,
  children,
  style,
}) => {
  // Subscribe to the same presence the chip will render. When the list
  // is empty, skip the padding reservation so the input takes its
  // natural width. When a peer is focused, reserve so long text never
  // collides with the overlaid chip.
  const fieldRef = entityId ? { type: entityType, id: entityId, path: fieldPath } : null;
  const presence = useFieldPresence(fieldRef, { excludeInstanceId, enabled: !!entityId });
  const hasPresence = presence.length > 0;
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        minWidth: 0,
        paddingRight: hasPresence ? RESERVED_RIGHT_PX : 0,
        ...style,
      }}
    >
      {children}
      {hasPresence && (
        <span
          style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            // Don't intercept clicks on the underlying input — the chip
            // re-enables pointer events on itself so the popover still works.
            pointerEvents: 'none',
          }}
        >
          <span style={{ pointerEvents: 'auto' }}>
            <FieldPresenceChip
              entityType={entityType}
              entityId={entityId}
              fieldPath={fieldPath}
              excludeInstanceId={excludeInstanceId}
            />
          </span>
        </span>
      )}
    </span>
  );
};

export default InputFieldPresenceSlot;
