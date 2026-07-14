/**
 * BackgroundTasksIndicator — footer slot for in-flight background work.
 *
 * Renders the newest task inline (title + slim progress + a circled ✕
 * that clears the item from the footer AND the panel without touching
 * the underlying work). Clicking
 * the slot toggles the standalone "Processes" panel — a card pinned to
 * the window's bottom-right corner above the status bar. The panel is
 * deliberately NOT a click-away popover: it stays up while the user
 * works and only the − button (or clicking the slot again) hides it.
 * When the last task settles while the panel is up, it shows its
 * completed state instead of vanishing mid-glance.
 */

import { CheckCircleFilled, CloseOutlined, MinusOutlined } from '@ant-design/icons';
import { Progress, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  type BackgroundTask,
  setBackgroundTasksPanelOpen,
  useBackgroundTasks,
  useBackgroundTasksPanelOpen,
} from './store';

/**
 * A settled task's click-through title. Hover underlines it so it reads
 * as actionable — state-driven because this shared component renders
 * under several host stylesheets.
 */
const ActivateTitle: React.FC<{
  title: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  onActivate: () => void;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ title, fontSize, color, bold = false, onActivate, onClick }) => {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick ?? onActivate}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        padding: 0,
        border: 'none',
        background: 'transparent',
        fontSize,
        color,
        fontWeight: bold ? 600 : undefined,
        cursor: 'pointer',
        textAlign: 'left',
        textDecoration: hover ? 'underline' : 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 220,
      }}
    >
      {title}
    </button>
  );
};

function taskProgress(task: BackgroundTask, width?: number): React.ReactNode {
  return (
    <Progress
      // Indeterminate work renders as a full pulsing bar — antd has no
      // dedicated indeterminate mode. Settled work goes green ('success')
      // so it stops reading as in-flight.
      percent={task.percent ?? 100}
      status={task.error ? 'exception' : task.done ? 'success' : 'active'}
      showInfo={false}
      size="small"
      style={{ width, margin: 0, flex: width === undefined ? 1 : undefined, lineHeight: 1 }}
    />
  );
}

const BackgroundTasksIndicator: React.FC = () => {
  const { token } = theme.useToken();
  const tasks = useBackgroundTasks();
  const panelOpen = useBackgroundTasksPanelOpen();
  const setPanelOpen = setBackgroundTasksPanelOpen;
  // Dismissed task ids: cleared from the footer and the panel alike
  // (display only — the work continues). Pruned when the task leaves
  // the store so a later run with the same id shows again.
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    setHiddenIds((prev) => {
      if (prev.size === 0) return prev;
      const alive = new Set([...prev].filter((id) => tasks.some((t) => t.id === id)));
      return alive.size === prev.size ? prev : alive;
    });
  }, [tasks]);

  const visible = tasks.filter((t) => !hiddenIds.has(t.id));
  // The slot is permanent: with no task in flight it renders the plain
  // "Processes" label so the panel is reachable at any time.
  const anchor = visible[visible.length - 1];

  // The ✕ sits in a small grey disc, vertically centered on the row it
  // dismisses.
  const circleClose = (onClick: (e: React.MouseEvent) => void, label: string): React.ReactNode => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 16,
        height: 16,
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
      <CloseOutlined style={{ fontSize: 9 }} />
    </button>
  );

  const panel = panelOpen
    ? createPortal(
        <div
          role="dialog"
          aria-label="Processes"
          style={{
            position: 'fixed',
            right: 10,
            // Clears the 24 px status bar.
            bottom: 30,
            width: 380,
            // Roomy fixed-feel body — the panel keeps its size as tasks
            // come and go instead of collapsing around one row.
            minHeight: 200,
            padding: '10px 14px',
            borderRadius: token.borderRadiusLG,
            background: token.colorBgElevated,
            boxShadow: token.boxShadowSecondary,
            border: `1px solid ${token.colorBorderSecondary}`,
            zIndex: token.zIndexPopupBase,
          }}
        >
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>Processes</div>
            <button
              type="button"
              aria-label="Hide processes panel"
              onClick={() => setPanelOpen(false)}
              style={{
                position: 'absolute',
                top: 0,
                right: -4,
                width: 16,
                height: 16,
                padding: 0,
                border: 'none',
                background: 'transparent',
                color: token.colorTextSecondary,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <MinusOutlined style={{ fontSize: 10 }} />
            </button>
          </div>
          {visible.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 13 }} />
              <span style={{ color: token.colorTextSecondary }}>All background tasks completed</span>
            </div>
          ) : (
            visible.map((task) => (
              <div key={task.id} style={{ padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {task.done && !task.error && (
                    <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 13 }} />
                  )}
                  {task.onActivate ? (
                    <ActivateTitle
                      title={task.title}
                      fontSize={13}
                      color={token.colorText}
                      bold
                      onActivate={task.onActivate}
                    />
                  ) : (
                    <div style={{ fontSize: 13, color: token.colorText }}>{task.title}</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {taskProgress(task)}
                  {circleClose((e) => {
                    e.stopPropagation();
                    setHiddenIds((prev) => new Set(prev).add(task.id));
                  }, 'Hide background task')}
                </div>
                {task.detail && (
                  <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 2, whiteSpace: 'pre-line' }}>
                    {task.detail}
                  </div>
                )}
              </div>
            ))
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        className="rules-statusbar-item"
        role="button"
        tabIndex={0}
        onClick={() => setPanelOpen(!panelOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setPanelOpen(!panelOpen);
          }
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 0 }}
      >
        {anchor ? (
          <>
            {anchor.done && !anchor.error && (
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 10 }} />
            )}
            {anchor.onActivate ? (
              // A settled task's title is its click-through ("view
              // report"); the rest of the slot still toggles the panel.
              <ActivateTitle
                title={anchor.title}
                fontSize={11}
                color={token.colorTextSecondary}
                onActivate={anchor.onActivate}
                onClick={(e) => {
                  e.stopPropagation();
                  anchor.onActivate?.();
                }}
              />
            ) : (
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
            )}
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
      {panel}
    </>
  );
};

export default BackgroundTasksIndicator;
