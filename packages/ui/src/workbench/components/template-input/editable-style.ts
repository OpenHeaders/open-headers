/**
 * Pure style derivations for {@link TemplateInput} — the caller-style
 * layout/surface split and the editable element's inline style.
 */

import type { GlobalToken } from 'antd';
import type React from 'react';

// The editable's unitless line-height, in every display mode. Exported
// so callers that vertically center the collapsed line inside a taller
// cell can do it with symmetric padding computed from the same metrics
// — a taller caller `line-height` would snap back to this value on
// expand and visibly shift the text.
export const TEMPLATE_INPUT_LINE_HEIGHT = 1.5714;

// Split the caller's `style` between the two elements. Layout keys
// (flex sizing, width) belong on the WRAPPER — the element that
// participates in the parent's flex/grid layout — while surface
// keys (padding, fonts, heights) belong on the editable, which
// fills the wrapper. Without the split the wrapper stays at its
// `width: 100%` default while e.g. `width: 180` lands on the
// editable, so the two disagree about the field's box — and the
// absolutely-positioned chrome (clear ✕, resize grip) anchors to
// the phantom full-row wrapper, painting over neighboring fields.
export function splitLayoutSurfaceStyle(
  style: React.CSSProperties | undefined,
): [React.CSSProperties, React.CSSProperties] {
  const layoutKeys = new Set([
    'flex',
    'flexGrow',
    'flexShrink',
    'flexBasis',
    'width',
    'minWidth',
    'maxWidth',
    'alignSelf',
  ]);
  const layout: Record<string, unknown> = {};
  const surface: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(style ?? {})) {
    (layoutKeys.has(key) ? layout : surface)[key] = val;
  }
  return [layout as React.CSSProperties, surface as React.CSSProperties];
}

interface EditableStyleParams {
  size: 'small' | 'middle' | 'large';
  variant: 'outlined' | 'borderless';
  status?: 'error';
  isFocused: boolean;
  token: GlobalToken;
  /** Number of icons in the right-edge action rail (✕, eye, …). */
  iconCount: number;
  displayExpanded: boolean;
  displayCollapsed: boolean;
  resizable: boolean;
  manualHeight: number | null;
  maxRows: number;
  /** Masked field — the collapsed line clips without an ellipsis (a
   *  `…` after the discs reads as noise, not truncation). */
  secret: boolean;
  surfaceStyle: React.CSSProperties;
}

export function buildEditableStyle({
  size,
  variant,
  status,
  isFocused,
  token,
  iconCount,
  displayExpanded,
  displayCollapsed,
  resizable,
  manualHeight,
  maxRows,
  secret,
  surfaceStyle,
}: EditableStyleParams): React.CSSProperties {
  // Derive paddings from `size` — match AntD defaults so we visually
  // line up with sibling AntD inputs. Caller styles override via
  // `style` prop (applied last).
  const sizePadding = size === 'small' ? '0 7px' : size === 'large' ? '6.5px 11px' : '4px 11px';
  const sizeMinHeight = size === 'small' ? 24 : size === 'large' ? 40 : 32;

  // `status === 'error'` wins regardless of focus so the error
  // colour doesn't flicker back to primary-blue when the field is
  // active — matches AntD Input's behaviour.
  const borderColor = status === 'error' ? token.colorError : isFocused ? token.colorPrimary : token.colorBorder;
  const focusShadow =
    status === 'error' ? `0 0 0 2px ${token.colorErrorBorderHover}` : `0 0 0 2px ${token.controlOutline}`;

  // Room reserved for the right-edge action rail (16px per icon: 12px
  // glyph + 4px gap) — also the clip inset for masked collapsed lines.
  const railInset = iconCount > 0 ? (displayExpanded || resizable ? 10 : 6) + 16 * iconCount : 0;

  return {
    minHeight: sizeMinHeight,
    padding: sizePadding,
    // Reserve just enough room that the last characters don't slide
    // under the action rail. A resizable field uses the wider inset in
    // BOTH display modes — its rail sits left of the grip column even
    // when collapsed (see TemplateInput). Masked collapsed lines get
    // 4px extra so the content-box clip below cuts the discs with a
    // visible gap before the first icon.
    ...(railInset > 0 ? { paddingRight: railInset + (displayCollapsed && secret ? 4 : 0) } : null),
    lineHeight: TEMPLATE_INPUT_LINE_HEIGHT,
    fontSize: size === 'small' ? 12 : size === 'large' ? 16 : 14,
    fontFamily: 'inherit',
    color: token.colorText,
    background: variant === 'borderless' ? 'transparent' : token.colorBgContainer,
    border: variant === 'borderless' ? 'none' : `1px solid ${borderColor}`,
    borderRadius: variant === 'borderless' ? 0 : token.borderRadius,
    outline: 'none',
    cursor: 'text',
    width: '100%',
    boxSizing: 'border-box',
    // Display mode (separate from `multiline` newline SEMANTICS):
    //   - expanded → word-wrap + vertical scroll (multiline surface,
    //     or an expand-on-focus field while it has focus)
    //   - collapsed-ellipsis → one line, clipped with an ellipsis
    //     (an expand-on-focus field while blurred)
    //   - default single-line → one line, horizontal caret-scroll
    whiteSpace: displayExpanded ? 'pre-wrap' : displayCollapsed ? 'nowrap' : 'pre',
    overflowX: displayExpanded || displayCollapsed ? 'hidden' : 'auto',
    overflowY: displayExpanded ? 'auto' : 'hidden',
    // Masked values clip WITHOUT the ellipsis — a `…` after the discs
    // reads as noise. But plain overflow clipping happens at the
    // padding box, so the discs would run under the ✕ / grip; and a
    // clip-path/mask would clip the element's own border off with
    // them. `overflow: clip` scoped to the content box cuts exactly
    // the discs while the border keeps painting.
    textOverflow: displayCollapsed && !secret ? 'ellipsis' : undefined,
    ...(displayCollapsed && secret ? { overflow: 'clip', overflowClipMargin: 'content-box' } : null),
    // Auto-grow cap for the wrapped editor (`multiline`, `wrap`, or an
    // expand-on-focus field while active): ~maxRows lines (lineHeight
    // 1.5714) + a little padding allowance; past it the surface
    // inner-scrolls. A grip-dragged manual height replaces the cap
    // entirely — the user's chosen size wins. (Callers can still
    // override via `style.maxHeight`, applied after this block.)
    height: displayExpanded && resizable && manualHeight != null ? manualHeight : undefined,
    maxHeight:
      displayExpanded && resizable && manualHeight != null
        ? 'none'
        : displayExpanded
          ? `${(maxRows * TEMPLATE_INPUT_LINE_HEIGHT + 0.9).toFixed(2)}em`
          : undefined,
    wordBreak: displayExpanded ? 'break-word' : 'normal',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxShadow: isFocused && variant !== 'borderless' ? focusShadow : undefined,
    ...surfaceStyle,
  };
}
