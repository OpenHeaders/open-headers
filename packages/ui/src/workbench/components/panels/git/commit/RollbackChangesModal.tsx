/**
 * RollbackChangesModal — the Commit window's Rollback Changes dialog
 * (the reference's): the Changes group in the Commit window's own
 * checkable tree, listed as the window lists it (its eye is the
 * window's own choices) with the files
 * the gesture named checked — more can be checked or unchecked there —
 * a count of what is checked (added, modified, deleted, each in its
 * change's colour), "Delete local copies of added files", a line saying
 * that what is rolled back cannot be restored, and Close / Rollback.
 * Rollback is the whole gesture: nothing asks again.
 *
 * One host verb puts every checked file back as the last commit holds
 * it — a changed or deleted file restored, an added one back to
 * unversioned (or deleted with the checkbox), a renamed one back under
 * its old name — and the workbench follows the files. The dialog's own
 * button signs the call (`nameGitWork`). A refusal is said in the
 * dialog, which stays as it was. Window-centered, like every dialog
 * about the repository.
 */

import { EyeOutlined } from '@ant-design/icons';
import { hostBridge, type WorkspaceTreeWorkingChangeWire } from '@openheaders/core/bridge';
import { Button, Checkbox, Dropdown, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { CollapseAllIcon, ExpandAllIcon } from '@openheaders/ui/shared/icons';
import { type FilesView, filesViewMenuItems, pickFilesViewMenu } from '../toolbar/files-view-menu';
import FilesViewModeSwitch from '../toolbar/FilesViewModeSwitch';
import ToolbarIconButton from '../toolbar/ToolbarIconButton';
import { nameGitWork } from '../use-git-work';
import { useOptionMenu } from '../use-option-menu';
import CommitChangesTree, { type CommitChangesTreeHandle, type CommitChangesTreeProps } from './CommitChangesTree';
import { type ChangeGroups, type CheckedState, countChanges } from './commit-model';
import CommitWorkspaceTree from './CommitWorkspaceTree';
import { vcsPalette } from './vcs-colors';

export interface RollbackChangesModalProps {
  workspaceId: string;
  /** The paths the gesture named — checked when the dialog opens; null = closed. */
  paths: readonly string[] | null;
  /** The Changes group's rows, as the Commit window lists them. */
  rows: readonly WorkspaceTreeWorkingChangeWire[];
  /** How the Commit window lists its tree — the dialog lists the same way, and its eye flips the window's own. */
  view: FilesView;
  rootLabel: string;
  headSha: string | null;
  onClose: () => void;
  /** The host rolled the files back — the window reads its changes again. */
  onRolledBack: () => void;
}

const TREE_HEIGHT = 340;
const noMenu = (): null => null;
const noop = (): void => {};

const RollbackChangesModal: React.FC<RollbackChangesModalProps> = ({
  workspaceId,
  paths,
  rows,
  view,
  rootLabel,
  headSha,
  onClose,
  onRolledBack,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const { isDarkMode } = useTheme();
  const palette = vcsPalette(isDarkMode);
  const open = paths !== null;
  // What is checked is held by NAME: a change that appears while the dialog is open arrives unchecked.
  const [checkedPaths, setCheckedPaths] = useState<ReadonlySet<string>>(new Set());
  const [deleteAdded, setDeleteAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const treeRef = useRef<CommitChangesTreeHandle>(null);
  const viewOptionsMenu = useOptionMenu();

  // Each opening starts from the gesture: its files checked, nothing else carried over.
  useEffect(() => {
    if (paths === null) return;
    setCheckedPaths(new Set(paths));
    setDeleteAdded(false);
    setError(null);
  }, [paths]);

  const groups = useMemo<ChangeGroups>(() => ({ changes: [...rows], unversioned: [], ignored: [] }), [rows]);
  const picked = useMemo(() => rows.filter((row) => checkedPaths.has(row.path)), [rows, checkedPaths]);
  const checked = useMemo<CheckedState>(
    () => ({
      uncheckedTracked: new Set(rows.filter((row) => !checkedPaths.has(row.path)).map((row) => row.path)),
      checkedUnversioned: new Set<string>(),
    }),
    [rows, checkedPaths],
  );
  const counter = useMemo(() => countChanges(picked), [picked]);
  // The reference's order and colours: added, modified, deleted — each as the tree paints that change.
  const counted = [
    { kind: 'added', count: counter.added, text: t('workbench.commitTool.counter.added', { count: counter.added }) },
    {
      kind: 'modified',
      count: counter.modified,
      text: t('workbench.commitTool.counter.modified', { count: counter.modified }),
    },
    {
      kind: 'deleted',
      count: counter.deleted,
      text: t('workbench.commitTool.counter.deleted', { count: counter.deleted }),
    },
  ] as const;

  const rollBack = async (): Promise<void> => {
    if (busy || picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await nameGitWork(t('workbench.gitLog.working.rollback'), () =>
        hostBridge.call('oh.workspaceTree.rollbackPaths', {
          workspaceId,
          paths: picked.map((row) => row.path),
          ...(deleteAdded ? { deleteAdded: true } : {}),
        }),
      );
      if (result.ok) {
        onRolledBack();
        onClose();
      } else if (result.reason === 'index-locked') {
        setError(t('workbench.gitLog.indexLocked'));
      } else {
        setError(t('workbench.commitTool.menu.rollbackFailed', { detail: result.detail ?? result.reason }));
      }
    } catch (err) {
      setError(t('workbench.commitTool.menu.rollbackFailed', { detail: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(false);
    }
  };

  const treeProps: CommitChangesTreeProps = {
    groups,
    checked,
    onSetChecked: (target, value) =>
      setCheckedPaths((prev) => {
        const next = new Set(prev);
        for (const filePath of target) {
          if (value) next.add(filePath);
          else next.delete(filePath);
        }
        return next;
      }),
    onOpenFile: noop,
    groupByDirectory: view.groupByDirectory,
    showIgnored: false,
    rootLabel,
    rowMenu: noMenu,
  };

  return (
    <Modal
      open={open}
      title={t('workbench.commitTool.rollbackChanges.title')}
      onCancel={busy ? undefined : onClose}
      width={520}
      centered
      destroyOnHidden
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={busy} data-testid="commit-rollback-close">
            {t('workbench.commitTool.rollbackChanges.close')}
          </Button>
          <Button
            type="primary"
            onClick={() => void rollBack()}
            loading={busy}
            disabled={picked.length === 0}
            data-testid="commit-rollback-confirm"
          >
            {t('workbench.commitTool.rollbackChanges.rollback')}
          </Button>
        </div>
      }
      data-testid="commit-rollback-modal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} data-testid="commit-rollback">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: TREE_HEIGHT,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusSM,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 6px',
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <FilesViewModeSwitch mode={view.mode} onChange={view.onModeChange} testid="commit-rollback-view-mode" />
            <Dropdown
              trigger={['click']}
              placement="bottomLeft"
              open={viewOptionsMenu.open}
              onOpenChange={viewOptionsMenu.onOpenChange}
              menu={{
                selectable: false,
                items: filesViewMenuItems(t, view),
                onClick: ({ key }) => void pickFilesViewMenu(key, view),
              }}
            >
              <span style={{ display: 'inline-flex' }}>
                <ToolbarIconButton
                  icon={<EyeOutlined />}
                  title={t('workbench.gitLog.viewOptions')}
                  popoverOpen={viewOptionsMenu.open}
                  testid="commit-rollback-view-options"
                />
              </span>
            </Dropdown>
            <span style={{ flex: 1 }} />
            <ToolbarIconButton
              icon={<ExpandAllIcon />}
              title={t('workbench.gitLog.expandAll')}
              onClick={() => treeRef.current?.expandAll()}
              testid="commit-rollback-expand-all"
            />
            <ToolbarIconButton
              icon={<CollapseAllIcon />}
              title={t('workbench.gitLog.collapseAll')}
              onClick={() => treeRef.current?.collapseAll()}
              testid="commit-rollback-collapse-all"
            />
          </div>
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }} data-testid="commit-rollback-tree">
            {view.mode === 'items' ? (
              <CommitWorkspaceTree ref={treeRef} {...treeProps} workspaceId={workspaceId} headSha={headSha} />
            ) : (
              <CommitChangesTree ref={treeRef} {...treeProps} />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, minHeight: 18, fontSize: 12 }} data-testid="commit-rollback-counter">
          {counted
            .filter((part) => part.count > 0)
            .map((part) => (
              <span key={part.kind} style={{ color: palette[part.kind] }} data-kind={part.kind}>
                {part.text}
              </span>
            ))}
        </div>
        <Checkbox
          checked={deleteAdded}
          onChange={(event) => setDeleteAdded(event.target.checked)}
          data-testid="commit-rollback-delete-added"
        >
          <span style={{ fontSize: 12 }}>{t('workbench.commitTool.rollbackChanges.deleteAdded')}</span>
        </Checkbox>
        <div style={{ fontSize: 12, color: token.colorTextTertiary }} data-testid="commit-rollback-note">
          {t('workbench.commitTool.rollbackChanges.irreversible')}
        </div>
        {error !== null && (
          <div style={{ fontSize: 12, color: token.colorError, whiteSpace: 'pre-wrap' }} data-testid="commit-rollback-error">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default RollbackChangesModal;
