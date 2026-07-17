/**
 * BackgroundTasksIndicator — footer slot for in-flight background work.
 *
 * Renders the newest task inline (title + slim progress + a circled ✕
 * that clears the item from the footer AND the panel without touching
 * the underlying work). Clicking anywhere on the slot — title included —
 * toggles the standalone "Processes" panel — a card pinned to the
 * window's bottom-right corner above the status bar. The panel is
 * deliberately NOT a click-away popover: it stays up while the user
 * works and only the − button (or clicking the slot again) hides it.
 * While the panel is up the slot reads "Hide processes (n)" instead of
 * echoing the task the panel already shows.
 * When the last task settles while the panel is up, it shows its
 * completed state instead of vanishing mid-glance; a task's follow-up
 * (e.g. "View report") renders there as a button under its row.
 */

import { CheckCircleFilled, CloseOutlined, InfoCircleOutlined, MinusOutlined } from '@ant-design/icons';
import { Button, Popconfirm, Progress, Tooltip, theme } from 'antd';
import type React from 'react';
import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  type BackgroundTask,
  setBackgroundTasksPanelOpen,
  useBackgroundTasks,
  useBackgroundTasksPanelOpen,
} from './store';

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
  const t = useT();
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

  // A cancelable task's ✕ stops the actual work behind a confirm; a
  // plain task's ✕ only hides the entry (the work, if any, continues).
  const taskClose = (task: BackgroundTask): React.ReactNode =>
    task.cancel ? (
      <Popconfirm
        title={task.cancel.confirm}
        okText={t('shared.chrome.tasks.stop')}
        okButtonProps={{ danger: true }}
        cancelText={t('shared.chrome.tasks.keepRunning')}
        onConfirm={() => task.cancel?.run()}
        placement="topRight"
      >
        {circleClose((e) => e.stopPropagation(), t('shared.chrome.tasks.stopTaskAria'))}
      </Popconfirm>
    ) : (
      circleClose((e) => {
        e.stopPropagation();
        setHiddenIds((prev) => new Set(prev).add(task.id));
      }, t('shared.chrome.tasks.hideTaskAria'))
    );

  const panel = panelOpen
    ? createPortal(
        <div
          role="dialog"
          aria-label={t('shared.chrome.tasks.processes')}
          style={{
            position: 'fixed',
            right: 10,
            // Clears the 24 px status bar.
            bottom: 30,
            width: 480,
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
            <div style={{ fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              {t('shared.chrome.tasks.processes')}
            </div>
            <button
              type="button"
              aria-label={t('shared.chrome.tasks.hidePanelAria')}
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
              <span style={{ color: token.colorTextSecondary }}>{t('shared.chrome.tasks.allCompleted')}</span>
            </div>
          ) : (
            visible.map((task) => (
              <div key={task.id} style={{ padding: '4px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  {task.done && !task.error && (
                    <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 13 }} />
                  )}
                  <div style={{ fontSize: 13, fontWeight: 600, color: token.colorText }}>{task.title}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {taskProgress(task)}
                  {taskClose(task)}
                </div>
                {task.detail && (
                  <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 2, whiteSpace: 'pre-line' }}>
                    {task.detail}
                  </div>
                )}
                {task.stats && task.stats.length > 0 && (
                  <div
                    style={{
                      display: 'grid',
                      // Three count/label pairs per row; longer summaries
                      // wrap onto further rows with the columns aligned.
                      gridTemplateColumns: 'repeat(3, max-content max-content)',
                      columnGap: 5,
                      rowGap: 1,
                      marginTop: 2,
                      fontSize: 12,
                      color: token.colorTextTertiary,
                    }}
                  >
                    {task.stats.map((stat) => (
                      <Fragment key={stat.label}>
                        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{stat.value}</span>
                        <span style={{ marginRight: 10 }}>{stat.label}</span>
                      </Fragment>
                    ))}
                  </div>
                )}
                {task.footnote && (
                  <div
                    style={{
                      fontSize: 12,
                      color: token.colorTextTertiary,
                      marginTop: 2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span>{task.footnote.text}</span>
                    {task.footnote.hint && (
                      <Tooltip title={task.footnote.hint}>
                        <InfoCircleOutlined
                          aria-label={t('shared.chrome.tasks.aboutNoteAria')}
                          style={{ fontSize: 11, color: token.colorTextTertiary, cursor: 'help' }}
                        />
                      </Tooltip>
                    )}
                  </div>
                )}
                {task.action && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Button size="small" onClick={task.action.run} style={{ fontSize: 12 }}>
                      {task.action.label}
                    </Button>
                    {task.action.note && (
                      <span style={{ fontSize: 12, color: token.colorTextTertiary }}>{task.action.note}</span>
                    )}
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
        {panelOpen ? (
          // While the panel is up, the slot becomes its dismiss affordance
          // instead of echoing the task the panel already shows.
          <span style={{ fontSize: 10, color: token.colorTextSecondary }}>
            {visible.length > 0
              ? t('shared.chrome.tasks.hideProcessesCount', { count: visible.length })
              : t('shared.chrome.tasks.hideProcesses')}
          </span>
        ) : anchor ? (
          <>
            {anchor.done && !anchor.error && (
              <CheckCircleFilled style={{ color: token.colorSuccess, fontSize: 10 }} />
            )}
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
            {taskClose(anchor)}
          </>
        ) : (
          <span style={{ fontSize: 10, color: token.colorTextTertiary }}>{t('shared.chrome.tasks.processes')}</span>
        )}
      </div>
      {panel}
    </>
  );
};

export default BackgroundTasksIndicator;
