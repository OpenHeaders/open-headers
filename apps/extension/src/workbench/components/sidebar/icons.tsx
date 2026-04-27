import type { StopOutlined } from '@ant-design/icons';
import type React from 'react';
import { createElement } from 'react';

export function iconEl(Icon: typeof StopOutlined, color: string, size = 12): React.ReactNode {
  return createElement(Icon, { style: { color, fontSize: size } });
}

export const METHOD_COLORS: Record<string, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  PATCH: '#50e3c2',
  DELETE: '#f93e3e',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

/** Compact method tag used as the leaf "icon" in the API Requests
 *  tree — colored GET / POST / PUT label next to each request.
 *  `muted` greys the tag to signal an incomplete (draft) request. */
export function methodTag(method: string, muted = false): React.ReactNode {
  const color = muted ? 'var(--ant-color-text-tertiary, #999)' : (METHOD_COLORS[method] ?? '#999');
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

/** Small orange dot — visual twin of the tab-bar dirty indicator. */
export function dirtyDot(): React.ReactNode {
  return createElement('span', {
    key: 'dirty-dot',
    style: { width: 6, height: 6, borderRadius: '50%', background: '#ff7875', flexShrink: 0 },
    'aria-label': 'unsaved changes',
  });
}

/** Build a sidebar row badge that combines an optional text label
 *  (paused / draft / unresolved / off) with an optional dirty dot.
 *  `extras` appends additional small text labels (e.g. post-import
 *  "scripts" review reminder) before the dirty dot. */
export function composeBadge(
  text: { label: string; color: string } | null,
  isDirty: boolean,
  extras?: ReadonlyArray<{ label: string; color: string; title?: string }>,
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
  if (isDirty) children.push(dirtyDot());
  return createElement(
    'span',
    { style: { marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' } },
    ...children,
  );
}
