/**
 * BackgroundTasksIndicator — footer slot for in-flight background work.
 *
 * Renders the newest task inline (title + slim progress + a dismiss ✕
 * that hides the inline display without touching the work), and opens
 * the "Processes" popover listing every task. When the last task
 * settles while the popover is open, the popover shows its completed
 * state instead of vanishing mid-glance; with it closed, the slot
 * renders nothing.
 */

import { CheckCircleFilled, CloseOutlined } from '@ant-design/icons';
import { Button, Popover, Progress, theme } from 'antd';
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
      style={{ width, margin: 0 }}
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

  const content = (
    <div style={{ width: 320 }}>
      {tasks.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px', fontSize: 12 }}>
          <CheckCircleFilled style={{ color: token.colorSuccess }} />
          <span style={{ color: token.colorTextSecondary }}>All background tasks completed</span>
        </div>
      ) : (
        tasks.map((task) => (
          <div key={task.id} style={{ padding: '4px 2px' }}>
            <div style={{ fontSize: 13, color: token.colorText }}>{task.title}</div>
            {taskProgress(task)}
            {task.detail && <div style={{ fontSize: 12, color: token.colorTextTertiary }}>{task.detail}</div>}
          </div>
        ))
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      title="Processes"
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
      trigger={['click']}
      placement="topRight"
      arrow={false}
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
            {taskProgress(anchor, 90)}
            <Button
              type="text"
              size="small"
              aria-label="Hide background task"
              icon={<CloseOutlined style={{ fontSize: 9 }} />}
              style={{ width: 16, height: 16, minWidth: 16, color: token.colorTextTertiary }}
              onClick={(e) => {
                e.stopPropagation();
                setHiddenIds((prev) => new Set(prev).add(anchor.id));
              }}
            />
          </>
        ) : (
          <span style={{ fontSize: 10, color: token.colorTextTertiary }}>Processes</span>
        )}
      </div>
    </Popover>
  );
};

export default BackgroundTasksIndicator;
