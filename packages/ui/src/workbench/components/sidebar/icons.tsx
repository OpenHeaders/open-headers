import type { StopOutlined } from '@ant-design/icons';
import type React from 'react';
import { createElement } from 'react';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import { ExampleChip } from '../shared/ExampleChip';

export function iconEl(Icon: typeof StopOutlined, color: string, size = 12): React.ReactNode {
  return createElement(Icon, { style: { color, fontSize: size } });
}

/**
 * Method tint per HTTP verb. CSS variables so the hue can flip per
 * theme: the fallbacks are the light-theme values — dark, saturated
 * hues that hold contrast on white — and `[data-theme='dark']` in
 * rules.less overrides them with brighter variants that read on dark.
 */
export const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--oh-method-get, #0a7d33)',
  POST: 'var(--oh-method-post, #9c6f00)',
  PUT: 'var(--oh-method-put, #0b5cad)',
  PATCH: 'var(--oh-method-patch, #623497)',
  DELETE: 'var(--oh-method-delete, #a4271c)',
  HEAD: 'var(--oh-method-head, #0f766e)',
  OPTIONS: 'var(--oh-method-options, #a12363)',
};

/** Compact method tag used as the leaf "icon" in the API Requests
 *  tree — colored GET / POST / PUT label next to each request.
 *  `muted` greys the tag to signal an incomplete (draft) request. */
export function methodTag(method: string, muted = false): React.ReactNode {
  // Custom methods fall back to the full text color — NOT grey, which
  // would read as the muted draft/unresolved state.
  const color = muted
    ? 'var(--ant-color-text-tertiary, #999)'
    : (METHOD_COLORS[method] ?? 'var(--ant-color-text, #1a1a1a)');
  return createElement(
    'span',
    {
      key: 'method',
      style: {
        display: 'inline-block',
        minWidth: 44,
        fontSize: 9,
        fontWeight: 700,
        color,
        fontFamily: "'SF Mono', monospace",
        textAlign: 'right',
        opacity: muted ? 0.7 : 1,
        flexShrink: 0,
      },
    },
    method,
  );
}

/** Compact gRPC tag used as the leaf "icon" for gRPC request rows —
 *  same footprint as {@link methodTag} so both kinds align in the tree.
 *  `muted` greys the tag to signal an incomplete (draft) request. */
export function grpcTag(muted = false): React.ReactNode {
  const color = muted ? 'var(--ant-color-text-tertiary, #999)' : 'var(--oh-method-grpc, #0b5cad)';
  return createElement(
    'span',
    {
      key: 'grpc',
      style: {
        display: 'inline-block',
        minWidth: 44,
        fontSize: 9,
        fontWeight: 700,
        color,
        fontFamily: "'SF Mono', monospace",
        textAlign: 'right',
        opacity: muted ? 0.7 : 1,
        flexShrink: 0,
      },
    },
    'gRPC',
  );
}

/** Compact WebSocket tag used as the leaf "icon" for WebSocket request
 *  rows — same footprint as {@link methodTag} so all kinds align in
 *  the tree. The label follows the flavor (WS / SIO — the Postman
 *  request-family anatomy). `muted` greys the tag to signal an
 *  incomplete (draft) request. */
export function websocketTag(flavor: 'raw' | 'socketio', muted = false): React.ReactNode {
  const color = muted ? 'var(--ant-color-text-tertiary, #999)' : 'var(--oh-method-ws, #0f766e)';
  return createElement(
    'span',
    {
      key: 'websocket',
      style: {
        display: 'inline-block',
        minWidth: 44,
        fontSize: 9,
        fontWeight: 700,
        color,
        fontFamily: "'SF Mono', monospace",
        textAlign: 'right',
        opacity: muted ? 0.7 : 1,
        flexShrink: 0,
      },
    },
    flavor === 'socketio' ? 'SIO' : 'WS',
  );
}

/** The shared "e.g." chip, right-aligned inside the {@link methodTag}
 *  footprint so example labels align with sibling request labels. */
export function exampleTag(): React.ReactNode {
  return createElement(
    'span',
    {
      key: 'example',
      style: {
        display: 'inline-flex',
        minWidth: 44,
        justifyContent: 'flex-end',
        flexShrink: 0,
      },
    },
    createElement(ExampleChip),
  );
}

/** Small orange dot — visual twin of the tab-bar dirty indicator. */
export function dirtyDot(t: Translate): React.ReactNode {
  return createElement('span', {
    key: 'dirty-dot',
    style: { width: 6, height: 6, borderRadius: '50%', background: '#ff7875', flexShrink: 0 },
    'aria-label': t('workbench.sidebar.badge.dirtyAria'),
  });
}

/** Build a sidebar row badge that combines an optional text label
 *  (paused / draft / unresolved / off) with an optional dirty dot.
 *  `extras` appends additional small text labels (e.g. post-import
 *  "scripts" review reminder) before the dirty dot. */
export function composeBadge(
  text: { label: string; color: string } | null,
  isDirty: boolean,
  extras: ReadonlyArray<{ label: string; color: string; title?: string }> | undefined,
  t: Translate,
): React.ReactNode {
  const hasExtras = !!extras && extras.length > 0;
  if (!text && !isDirty && !hasExtras) return undefined;
  const children: React.ReactNode[] = [];
  if (text) {
    children.push(createElement('span', { key: 'text', style: { fontSize: 9, color: text.color } }, text.label));
  }
  if (hasExtras) {
    for (const e of extras) {
      children.push(
        createElement(
          'span',
          { key: `extra-${e.label}`, title: e.title, style: { fontSize: 9, color: e.color } },
          e.label,
        ),
      );
    }
  }
  if (isDirty) children.push(dirtyDot(t));
  return createElement(
    'span',
    { style: { marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' } },
    ...children,
  );
}
