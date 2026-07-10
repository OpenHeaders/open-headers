/**
 * GridValueField — the shared Value-cell field for the editable grids:
 * user rows in Params / Headers / form bodies and the editable
 * suggestion row (the auth credential). One home for the in-field
 * action rail — allowClear, the value edit icon (JWT / base64 /
 * URL-encoding via `useValueEditAction`), the optional secret eye —
 * plus the expand-on-focus + corner-grip treatment every grid value
 * cell shares. Detection and modal state live here so `TemplateInput`
 * stays presentation-only.
 */

import type React from 'react';
import { type GripResizeXHandler, TemplateInput } from '../template-input';
import { useValueEditAction } from '../value-editors';

export interface GridValueFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Row-level expand override — forwarded to TemplateInput's
   *  `expanded` so every cell in a row expands together. */
  expanded?: boolean;
  /** Auto-grow cap for the expanded surface (TemplateInput default 5). */
  maxRows?: number;
  flagUnresolved?: boolean;
  /** Mask literal characters. Pair with `onSecretToggle` to render the
   *  eye toggle — the caller owns the reveal state. */
  secret?: boolean;
  onSecretToggle?: () => void;
  /** X-axis handler for the 2D corner grip — maps horizontal drag onto
   *  the grid's Value-column boundary. Omit to keep the grip
   *  vertical-only. */
  onResizeX?: GripResizeXHandler;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export const GridValueField: React.FC<GridValueFieldProps> = ({
  value,
  onChange,
  placeholder,
  expanded,
  maxRows,
  flagUnresolved,
  secret,
  onSecretToggle,
  onResizeX,
  ariaLabel,
  style,
}) => {
  const { editProps, editorModal } = useValueEditAction(value, onChange);
  return (
    <>
      <TemplateInput
        variant="borderless"
        expandOnFocus
        expanded={expanded}
        maxRows={maxRows}
        resizable
        onResizeX={onResizeX}
        allowClear
        flagUnresolved={flagUnresolved}
        secret={secret}
        onSecretToggle={onSecretToggle}
        {...editProps}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        style={style}
      />
      {editorModal}
    </>
  );
};
