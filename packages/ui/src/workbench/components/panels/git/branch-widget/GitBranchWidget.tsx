/**
 * GitBranchWidget — the top bar's branch widget (the "⑂ main ↙ ˅"
 * control beside the workspace switcher), shown
 * only on git hosts for a bound workspace: the branch glyph, the
 * checked-out branch (the detached head's short sha, or the unborn
 * branch), the incoming / outgoing counts against the upstream, and
 * the caret. While one of the widget's own transfer verbs is at the
 * host the glyph gives way to a spinner — the popup has closed by then
 * and nothing else says the verb is running. Click opens
 * `GitBranchPopup`. Reads the shared git status
 * store; the verbs are the shared `useGitBranchActions`, whose dialogs
 * mount beside the trigger. Every observed HEAD change feeds the
 * workspace's Recent ring.
 */

import { DownOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Dropdown, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { BranchIcon } from '@openheaders/ui/shared/icons';
import { postGitPanelReveal } from '../../../../data/git-panel-reveal';
import { useWorkspaceGitSnapshot } from '../../../../stores/git-status-store';
import { useGitBranchActions } from '../branch-actions/use-git-branch-actions';
import { getGitPanelWorkbench } from '../git-panel-view-store';
import { branchTriggerCounts, branchTriggerLabel } from './branch-widget-model';
import { recordRecentBranch } from './branch-widget-prefs';
import GitBranchPopup from './GitBranchPopup';

export interface GitBranchWidgetProps {
  workspaceId: string | null;
  /** Reveal the Commit tool window (the popup's Commit… row). */
  onOpenCommit: () => void;
}

const GitBranchWidget: React.FC<GitBranchWidgetProps> = ({ workspaceId, onOpenCommit }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [open, setOpen] = useState(false);
  const snapshot = useWorkspaceGitSnapshot(workspaceId);
  const { status, refs, current } = snapshot;
  const branch = status?.bound === true ? status.branch : null;

  useEffect(() => {
    if (workspaceId !== null && branch !== null) recordRecentBranch(workspaceId, branch);
  }, [workspaceId, branch]);

  // Escape closes the popup wherever focus sits (a row menu that just
  // closed leaves focus on the body, outside the popup's own handler).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      // Escape inside an open row menu closes that menu alone (the
      // reference design steps back to the popup, not out of it).
      if (event.target instanceof Element && event.target.closest('.commit-tool-row-menu') !== null) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const actions = useGitBranchActions({
    workspaceId: workspaceId ?? '',
    currentRef: current,
    refs,
    container: null,
  });

  if (workspaceId === null || status === null || !status.bound) return null;

  const label = branchTriggerLabel(status);
  if (label.kind === 'none') return null;
  const counts = branchTriggerCounts(status);
  const name = label.kind === 'branch' ? label.name : t('workbench.gitBranch.widget.detached', { sha: label.sha });

  const openCompare = (ref: string): void => {
    getGitPanelWorkbench(workspaceId).registry.openCompare(ref);
    postGitPanelReveal();
  };

  return (
    <>
      <Dropdown
        open={open}
        onOpenChange={setOpen}
        trigger={['click']}
        placement="bottomLeft"
        // Mounted fresh on every open, so the search field's autoFocus
        // lands each time (a kept popup mounts once and focuses once).
        destroyOnHidden
        popupRender={() => (
          <GitBranchPopup
            workspaceId={workspaceId}
            status={status}
            refs={refs}
            currentRef={current}
            actions={actions}
            onOpenCompare={openCompare}
            onOpenCommit={onOpenCommit}
            onClose={() => setOpen(false)}
          />
        )}
      >
        <Button
          type="text"
          size="small"
          aria-label={t('workbench.gitBranch.widget.aria', { branch: name })}
          aria-busy={actions.busy.working}
          data-testid="git-branch-widget"
          style={{
            padding: '0 8px',
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: token.colorText,
          }}
        >
          {actions.busy.working ? (
            <LoadingOutlined
              style={{ fontSize: 13, color: token.colorTextSecondary }}
              data-testid="git-branch-widget-working"
            />
          ) : (
            <BranchIcon style={{ fontSize: 13, color: token.colorTextSecondary }} />
          )}
          <span
            style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            data-testid="git-branch-widget-name"
          >
            {name}
          </span>
          {counts.incoming > 0 && (
            <span
              style={{ fontSize: 12, color: token.colorPrimary }}
              data-testid="git-branch-widget-incoming"
              data-count={counts.incoming}
            >
              ↙ {counts.incoming}
            </span>
          )}
          {counts.outgoing > 0 && (
            <span
              style={{ fontSize: 12, color: token.colorSuccessText }}
              data-testid="git-branch-widget-outgoing"
              data-count={counts.outgoing}
            >
              ↗ {counts.outgoing}
            </span>
          )}
          <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
        </Button>
      </Dropdown>
      {actions.dialogs}
    </>
  );
};

export default GitBranchWidget;
