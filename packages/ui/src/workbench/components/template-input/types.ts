/**
 * Public props for {@link TemplateInput}. Kept in its own module so the
 * (large) contract is separable from the component implementation and can
 * be re-exported from the package index without pulling in the component.
 */

import type { SuggestionContext } from '@openheaders/core/variables';
import type React from 'react';

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
  /** Controlled override for `expandOnFocus`'s expanded state. When set,
   *  it drives the collapsed/expanded display instead of the field's own
   *  focus — lets a parent expand a whole group of fields together (e.g.
   *  every cell in a table row expands when any one of them is focused).
   *  Undefined → falls back to the field's own focus. */
  expanded?: boolean;
  /** Row cap for `expandOnFocus`'s grown editor before it inner-scrolls.
   *  Default 5. */
  maxRows?: number;
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
  /** Forwarded to the editable element. Applied AFTER the base styles
   *  so callers can override padding / color / flex / width. */
  style?: React.CSSProperties;
  /** Additional class forwarded to the root wrapper. */
  className?: string;
  /** `onPressEnter` parity with AntD Input — fires when Enter is
   *  pressed and the popover is not handling it. */
  onPressEnter?: () => void;
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
  /** When true, show a small red dot at the field's right end whenever
   *  its value contains an UNRESOLVED `{{ref}}` (reserved namespaces
   *  excluded). Lets a row flag a missing variable without the user
   *  expanding it to hunt for the highlighted ref. */
  flagUnresolved?: boolean;
}
