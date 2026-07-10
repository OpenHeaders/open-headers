/**
 * Public props for {@link TemplateInput}. Kept in its own module so the
 * (large) contract is separable from the component implementation and can
 * be re-exported from the package index without pulling in the component.
 */

import type { SuggestionContext } from '@openheaders/core/variables';
import type React from 'react';

/**
 * Horizontal-axis report from the resize grip. The grip applies the
 * field's HEIGHT itself, but width belongs to the layout the field sits
 * in — so horizontal pointer travel is only reported, and the layout
 * owner (e.g. `useColumnSplit`) maps it onto its own geometry. `start`
 * fires on grab, `move` carries the travel since the grab point, `end`
 * fires on release, `reset` on double-click. `gripEl` lets the owner
 * locate the row the drag came from.
 */
export interface GripResizeXEvent {
  phase: 'start' | 'move' | 'end' | 'reset';
  /** Horizontal pointer travel since `start`, in px. 0 for start/reset. */
  deltaX: number;
  gripEl: HTMLElement;
}

export type GripResizeXHandler = (e: GripResizeXEvent) => void;

export interface TemplateInputProps {
  /** Controlled value. Optional so the component composes with AntD
   *  `<Form.Item>` (which injects value/onChange at clone time). */
  value?: string;
  /** Controlled change handler. Optional for the same reason. */
  onChange?: (next: string) => void;
  /** Scope/context override — controls which scopes are offered. When
   *  omitted, the component sources context from the nearest
   *  {@link SuggestionContextProvider} via {@link useAutoSuggestionContext}. */
  suggestionContext?: SuggestionContext;
  /** When true, render a multiline surface. Default false — single-line
   *  (Enter is swallowed, newlines are stripped from paste). */
  multiline?: boolean;
  /** When true, keep single-line SEMANTICS (no literal newlines) but
   *  switch the DISPLAY on focus: collapsed (blurred) shows one line
   *  with an ellipsis; focused word-wraps the value and auto-grows up to
   *  `maxRows` lines, then inner-scrolls. Used in dense table cells so a
   *  long value is comfortably editable without a horizontal scrollbar.
   *  Ignored when `multiline` is set. */
  expandOnFocus?: boolean;
  /** Textarea-like display with single-line SEMANTICS: always
   *  word-wrapped (focused or not), auto-grows with content up to
   *  `maxRows` lines, then inner-scrolls. Unlike `expandOnFocus` it
   *  never collapses on blur — the field keeps its size (including a
   *  `resizable` grip-dragged height) regardless of focus. Ignored
   *  when `multiline` is set; takes precedence over `expandOnFocus`. */
  wrap?: boolean;
  /** Controlled override for `expandOnFocus`'s expanded state. When set,
   *  it drives the collapsed/expanded display instead of the field's own
   *  focus — lets a parent expand a whole group of fields together (e.g.
   *  every cell in a table row expands when any one of them is focused).
   *  Undefined → falls back to the field's own focus. */
  expanded?: boolean;
  /** Row cap for the wrapped editor (`multiline`, `wrap`, or an active
   *  `expandOnFocus` field) before it inner-scrolls. Default 5. Callers
   *  can override the resulting cap via `style.maxHeight`. */
  maxRows?: number;
  /** When true, the expanded surface shows a textarea-style grip in its
   *  bottom-right corner. Dragging it sets an explicit height that
   *  overrides the `maxRows` auto-grow cap (the field inner-scrolls
   *  within whatever height the user chose); double-clicking the grip
   *  returns to auto-grow. Only meaningful with `multiline` or
   *  `expandOnFocus`. */
  resizable?: boolean;
  /** Horizontal-axis handler for the `resizable` grip. When set, the
   *  grip becomes two-dimensional (`nwse-resize` cursor): vertical drag
   *  still sets the field's own height, while horizontal travel is
   *  reported here for the surrounding layout to apply — the field
   *  never sets its own width. */
  onResizeX?: GripResizeXHandler;
  /** AntD `Input`/`TextArea` parity: when true and the field has a
   *  value, show an ✕ at the right edge that clears it (top-right on
   *  an expanded surface, vertically centered on a single line). */
  allowClear?: boolean;
  /** Placeholder. Rendered via a `::before` pseudo when the field is empty. */
  placeholder?: string;
  /** Mirrors AntD `Input` size prop — tunes the editable's padding. */
  size?: 'small' | 'middle' | 'large';
  /** Matches AntD variant — `outlined` (default) shows border + radius,
   *  `borderless` drops them (used inside table cells). */
  variant?: 'outlined' | 'borderless';
  /** When true, disable the popover entirely — the field becomes a
   *  plain editable div. Used for fields that shouldn't suggest anything
   *  (LV manualOverride, extractor paths). */
  disableSuggestions?: boolean;
  /** Caller styles, applied AFTER the base styles. Layout keys (flex
   *  sizing, width, alignSelf) land on the outer wrapper — the element
   *  that participates in the parent's flex layout — while everything
   *  else (padding, color, heights, fonts) lands on the editable, which
   *  fills the wrapper. Callers just pass one object; the split is
   *  internal. */
  style?: React.CSSProperties;
  /** Additional class forwarded to the root wrapper. */
  className?: string;
  /** `onPressEnter` parity with AntD Input — fires when Enter is
   *  pressed and the popover is not handling it. */
  onPressEnter?: () => void;
  /** Pre-insertion paste hook. Called with the clipboard's plain text
   *  before it lands in the field; returning true consumes the paste
   *  (nothing is inserted) — e.g. the URL bar routing a pasted curl
   *  command into the import flow. Return false to paste normally. */
  onPasteIntercept?: (text: string) => boolean;
  /** Forwarded to the editable. */
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  /** Forwarded to the editable. */
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  /** Forwarded to the editable. */
  autoFocus?: boolean;
  /** Forwarded to the editable. */
  id?: string;
  /** Forwarded to the editable. */
  'aria-label'?: string;
  /** AntD-compatible status override. `'error'` paints the border red
   *  regardless of focus state — use for unresolved-ref signalling. */
  status?: 'error';
  /** When true, literal characters render masked (disc) while
   *  `{{ref}}` spans stay visible. Use for password / token fields
   *  where users still need to read which variable they picked but
   *  typed-in secrets should not be drive-by-readable. */
  secret?: boolean;
  /** Renders an in-field eye toggle (just left of the `allowClear` ✕)
   *  that flips the mask: the caller owns `secret` and this callback
   *  flips it. Clicking never blurs the field, so an `expandOnFocus`
   *  surface stays expanded through the toggle. */
  onSecretToggle?: () => void;
  /** Renders an in-field edit icon (leftmost on the action rail) that
   *  opens a caller-owned value editor — e.g. the JWT modal when the
   *  caller detected a JWT in the value. Like the eye, the component
   *  stays presentation-only: detection and the editor itself live at
   *  the caller (see `useValueEditAction`). Clicking never blurs the
   *  field. */
  onValueEdit?: () => void;
  /** Tooltip + accessible label for the edit icon (e.g. "Edit as JWT").
   *  Only meaningful with `onValueEdit`. */
  editTooltip?: string;
  /** When true, show a small red dot at the field's right end whenever
   *  its value contains an UNRESOLVED `{{ref}}` (reserved namespaces
   *  excluded). Lets a row flag a missing variable without the user
   *  expanding it to hunt for the highlighted ref. */
  flagUnresolved?: boolean;
}
