/**
 * BackgroundTasksIndicator — footer slot for in-flight background work.
 *
 * Renders the newest task inline (title + slim progress + a circled ✕
 * that hides the inline display without touching the work), and opens
 * the "Processes" popover listing every task. When the last task
 * settles while the popover is open, the popover shows its completed
 * state instead of vanishing mid-glance; with it closed, the slot
 * renders nothing.
 */

import { CheckCircleFilled, CloseOutlined } from '@ant-design/icons';
import { Popover, Progress, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { type BackgroundTask, useBackgroundTasks } from './store';

function taskProgress(task: BackgroundTask, width?: number): React.ReactNode {
  return (
    <Progress
      // Indeterminate work renders as a full pulsing bar — antd has no
      // dedicated indeterminate mode.
      percent={task.percent ?? 100}
      status="active"
      showInfo={false}
      size="small"
      style={{ width, margin: 0, flex: width === undefined ? 1 : undefined, lineHeight: 1 }}
    />
  );
}

const BackgroundTasksIndicator: React.FC = () => {
  const { token } = theme.useToken();
  const tasks = useBackgroundTasks();
  const [popoverOpen, setPopoverOpen] = useState(false);
  // Inline-dismissed task ids: hidden from the footer, still listed in
  // the popover. Pruned when the task leaves the store so a later run
  // with the same id shows again.
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setHiddenIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set([...prev].filter((id) => tasks.some((t) => t.id === id)));
      return alive.size === prev.size ? prev : alive;
    });
  }, [tasks]);

  const visible = tasks.filter((t) => !hiddenIds.has(t.id));
  const anchor = visible[visible.length - 1];
  if (!anchor && !popoverOpen) return null;

  // The ✕ sits in a small grey disc, vertically centered on the row it
  // dismisses.
  const circleClose = (onClick: (e: React.MouseEvent) => void, label: string): React.ReactNode => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 14,
        height: 14,
        flex: 'none',
        padding: 0,
        border: 'none',
        borderRadius: '50%',
        background: token.colorFillSecondary,
        color: token.colorTextSecondary,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <CloseOutlined style={{ fontSize: 8 }} />
    </button>
  );

  const content = (
    <div style={{ width: 280 }}>
      <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>Processes</div>
      {tasks.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 12 }} />
          <span style={{ color: token.colorTextSecondary }}>All background tasks completed</span>
        </div>
      ) : (
        tasks.map((task) => (
          <div key={task.id} style={{ padding: '2px 0' }}>
            <div style={{ fontSize: 12, color: token.colorText }}>{task.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {taskProgress(task)}
              {circleClose((e) => {
                e.stopPropagation();
                setHiddenIds((prev) => new Set(prev).add(task.id));
              }, 'Hide background task')}
            </div>
            {task.detail && <div style={{ fontSize: 11, color: token.colorTextTertiary }}>{task.detail}</div>}
          </div>
        ))
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      trigger={['click']}
      placement="topRight"
      arrow={false}
      align={{ offset: [0, -2] }}
      overlayInnerStyle={{ padding: '8px 12px' }}
    >
      <div
        className="rules-statusbar-item"
        role="button"
        tabIndex={0}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 0 }}
      >
        {anchor ? (
          <>
            <span
              style={{
                fontSize: 10,
                color: token.colorTextSecondary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 220,
              }}
            >
              {anchor.title}
            </span>
            {taskProgress(anchor, 80)}
            {circleClose((e) => {
              e.stopPropagation();
              setHiddenIds((prev) => new Set(prev).add(anchor.id));
            }, 'Hide background task')}
          </>
        ) : (
          <span style={{ fontSize: 10, color: token.colorTextTertiary }}>Processes</span>
        )}
      </div>
    </Popover>
  );
};

export default BackgroundTasksIndicator;
