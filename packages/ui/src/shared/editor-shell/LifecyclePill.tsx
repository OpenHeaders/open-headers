/**
 * LifecyclePill — single visual vocabulary for the entity lifecycle
 * (Scratch / Draft / Unresolved / Live). Rendered in the workbench
 * footer for whichever editor is the active tab. Same predicates feed
 * the sidebar `draft` text and the tab prefix icon, so all three
 * surfaces stay in lockstep (see `useEditorShell`).
 */

import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';
import { Popover } from 'antd';
import type { EditorLifecycleStatus } from './types';

type StatusKey = Exclude<EditorLifecycleStatus, null> | 'live';

interface StatusStyle {
  label: string;
  fg: string;
  border: string;
  bg: string;
  body: string;
}

const STATUS_STYLE: Record<StatusKey, StatusStyle> = {
  scratch: {
    label: 'Scratch',
    fg: '#7a7a7a',
    border: '#bfbfbf',
    bg: 'rgba(140,140,140,0.10)',
    body: 'Unsaved draft. Nothing is persisted until you Save.',
  },
  unresolved: {
    label: 'Unresolved',
    fg: '#cf1322',
    border: '#ffa39e',
    bg: 'rgba(255,77,79,0.10)',
    body: 'Has {{ref}}s that don’t resolve in the active scope.',
  },
  draft: {
    label: 'Draft',
    fg: '#7a7a7a',
    border: '#bfbfbf',
    bg: 'rgba(140,140,140,0.10)',
    body: 'Saved but not Live yet — missing required fields, or not yet published.',
  },
  live: {
    label: 'Live',
    fg: '#389e0d',
    border: '#b7eb8f',
    bg: 'rgba(82,196,26,0.12)',
    body: 'Published and active.',
  },
};

const STATUS_ORDER: StatusKey[] = ['scratch', 'draft', 'unresolved', 'live'];

function StatusPill({ s, active }: { s: StatusStyle; active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 8px',
        fontSize: 10,
        fontWeight: 600,
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 999,
        flexShrink: 0,
      }}
    >
      {active && <CheckCircleFilled style={{ fontSize: 9, color: s.fg }} />}
      {!active && <ExclamationCircleFilled style={{ fontSize: 9, opacity: 0.35, color: s.fg }} />}
      {s.label}
    </span>
  );
}

function LifecyclePopoverContent({ current }: { current: StatusKey }) {
  return (
    <div style={{ minWidth: 280, maxWidth: 320 }}>
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8, color: 'var(--ant-color-text-secondary)' }}>
        Lifecycle states
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STATUS_ORDER.map((key) => {
          const style = STATUS_STYLE[key];
          const active = key === current;
          return (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '4px 6px',
                background: active ? style.bg : 'transparent',
                border: `1px solid ${active ? style.border : 'transparent'}`,
                borderRadius: 6,
              }}
            >
              <StatusPill s={style} active={active} />
              <span
                style={{
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: active ? 'var(--ant-color-text)' : 'var(--ant-color-text-secondary)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {style.body}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface LifecyclePillProps {
  status: EditorLifecycleStatus;
  /** Popover anchor placement. Footer renders use `top`; default is
   *  `bottom` so legacy header consumers stay visually identical. */
  placement?: 'top' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}

export function LifecyclePill({ status, placement = 'bottom' }: LifecyclePillProps) {
  if (status === null) return null;
  const style = STATUS_STYLE[status];
  return (
    <Popover
      content={<LifecyclePopoverContent current={status} />}
      placement={placement}
      trigger={['hover', 'focus']}
      arrow={false}
      mouseEnterDelay={0.1}
    >
      <span style={{ display: 'inline-flex', cursor: 'help' }}>
        <StatusPill s={style} active />
      </span>
    </Popover>
  );
}
