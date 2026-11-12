/**
 * Git › Log sections — the Git tool window's per-workspace display
 * preferences, the same values the window's eye menus and ⋯ Options
 * flip: Commits (compact references, references on the left, tag names,
 * commit timestamp, the author / hash / date columns, the merge-commit highlight, the current-branch band), Changes (group by directory, show details, what a
 * double-click opens) and Console (the gutter toggles). The values
 * live in the window's own per-workspace stores, so the rows patch
 * those stores directly and an open window follows at once; a row's
 * reset returns the store's default. Without a bound repository the
 * sections give way to the pointer at the Folder page, like the
 * sibling pages.
 */

import { Select, Switch } from 'antd';
import type React from 'react';
import { useCallback, useSyncExternalStore } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  DEFAULT_GIT_CONSOLE_PREFS,
  type GitConsolePrefs,
  getGitConsolePrefs,
  patchGitConsolePrefs,
  subscribeGitConsolePrefs,
} from '../../../components/panels/git/git-console-view-state';
import {
  DEFAULT_GIT_LOG_VIEW_PREFS,
  type GitDoubleClickTarget,
  type GitLogViewPrefs,
  getGitLogViewPrefs,
  patchGitLogViewPrefs,
  subscribeGitLogViewPrefs,
} from '../../../components/panels/git/git-log-view-prefs';
import FieldRow from '../../fields/FieldRow';
import { PaneSection } from '../pane-chrome';
import GitNeedsRepoNote from './git-needs-repo-note';
import type { WorkspaceGit } from './use-workspace-git';

interface ToggleRowProps {
  settingKey: string;
  label: string;
  description: string;
  value: boolean;
  defaultValue: boolean;
  onChange: (value: boolean) => void;
  testid: string;
}

/** One on/off preference: a switch, the modified dot against the store's default, reset to it. */
const ToggleRow: React.FC<ToggleRowProps> = ({ settingKey, label, description, value, defaultValue, onChange, testid }) => (
  <FieldRow
    settingKey={settingKey}
    label={label}
    description={description}
    modified={value !== defaultValue}
    onReset={() => onChange(defaultValue)}
  >
    <Switch size="small" checked={value} onChange={onChange} data-testid={testid} />
  </FieldRow>
);

const GitLogSection: React.FC<{ git: WorkspaceGit }> = ({ git }) => {
  const t = useT();
  const { workspaceId, gitStatus } = git;
  const prefsKey = workspaceId ?? '';
  const view: GitLogViewPrefs = useSyncExternalStore(
    useCallback((listener) => subscribeGitLogViewPrefs(prefsKey, listener), [prefsKey]),
    () => getGitLogViewPrefs(prefsKey),
  );
  const console: GitConsolePrefs = useSyncExternalStore(
    useCallback((listener) => subscribeGitConsolePrefs(prefsKey, listener), [prefsKey]),
    () => getGitConsolePrefs(prefsKey),
  );
  const patchView = (patch: Partial<GitLogViewPrefs>): void => patchGitLogViewPrefs(prefsKey, patch);
  const patchConsole = (patch: Partial<GitConsolePrefs>): void => patchGitConsolePrefs(prefsKey, patch);

  if (workspaceId === null || gitStatus === null || !gitStatus.git.available || !gitStatus.repo) {
    return <GitNeedsRepoNote />;
  }

  return (
    <>
      <PaneSection title={t('workbench.settings.category.gitLog.sub.commits')}>
        <ToggleRow
          settingKey="git.log.compactReferences"
          label={t('workbench.settings.gitPane.log.compactReferencesLabel')}
          description={t('workbench.settings.gitPane.log.compactReferencesDescription')}
          value={view.compactReferences}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.compactReferences}
          onChange={(compactReferences) => patchView({ compactReferences })}
          testid="git-log-pane-compact-references"
        />
        <ToggleRow
          settingKey="git.log.referencesOnLeft"
          label={t('workbench.settings.gitPane.log.referencesOnLeftLabel')}
          description={t('workbench.settings.gitPane.log.referencesOnLeftDescription')}
          value={view.referencesOnLeft}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.referencesOnLeft}
          onChange={(referencesOnLeft) => patchView({ referencesOnLeft })}
          testid="git-log-pane-references-on-left"
        />
        <ToggleRow
          settingKey="git.log.tagNames"
          label={t('workbench.settings.gitPane.log.tagNamesLabel')}
          description={t('workbench.settings.gitPane.log.tagNamesDescription')}
          value={view.showTagNames}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.showTagNames}
          onChange={(showTagNames) => patchView({ showTagNames })}
          testid="git-log-pane-tag-names"
        />
        <ToggleRow
          settingKey="git.log.commitTimestamp"
          label={t('workbench.settings.gitPane.log.commitTimestampLabel')}
          description={t('workbench.settings.gitPane.log.commitTimestampDescription')}
          value={view.showCommitTimestamp}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.showCommitTimestamp}
          onChange={(showCommitTimestamp) => patchView({ showCommitTimestamp })}
          testid="git-log-pane-commit-timestamp"
        />
        <ToggleRow
          settingKey="git.log.authorColumn"
          label={t('workbench.settings.gitPane.log.authorColumnLabel')}
          description={t('workbench.settings.gitPane.log.authorColumnDescription')}
          value={view.showAuthorColumn}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.showAuthorColumn}
          onChange={(showAuthorColumn) => patchView({ showAuthorColumn })}
          testid="git-log-pane-author-column"
        />
        <ToggleRow
          settingKey="git.log.hashColumn"
          label={t('workbench.settings.gitPane.log.hashColumnLabel')}
          description={t('workbench.settings.gitPane.log.hashColumnDescription')}
          value={view.showHashColumn}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.showHashColumn}
          onChange={(showHashColumn) => patchView({ showHashColumn })}
          testid="git-log-pane-hash-column"
        />
        <ToggleRow
          settingKey="git.log.dateColumn"
          label={t('workbench.settings.gitPane.log.dateColumnLabel')}
          description={t('workbench.settings.gitPane.log.dateColumnDescription')}
          value={view.showDateColumn}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.showDateColumn}
          onChange={(showDateColumn) => patchView({ showDateColumn })}
          testid="git-log-pane-date-column"
        />
        <ToggleRow
          settingKey="git.log.highlightMergeCommits"
          label={t('workbench.settings.gitPane.log.mergeCommitsLabel')}
          description={t('workbench.settings.gitPane.log.mergeCommitsDescription')}
          value={view.highlightMergeCommits}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.highlightMergeCommits}
          onChange={(highlightMergeCommits) => patchView({ highlightMergeCommits })}
          testid="git-log-pane-merge-commits"
        />
        <ToggleRow
          settingKey="git.log.highlightCurrentBranch"
          label={t('workbench.settings.gitPane.log.currentBranchLabel')}
          description={t('workbench.settings.gitPane.log.currentBranchDescription')}
          value={view.highlightCurrentBranch}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.highlightCurrentBranch}
          onChange={(highlightCurrentBranch) => patchView({ highlightCurrentBranch })}
          testid="git-log-pane-current-branch"
        />
      </PaneSection>
      <PaneSection title={t('workbench.settings.category.gitLog.sub.changes')}>
        <ToggleRow
          settingKey="git.log.groupFilesByWorkspace"
          label={t('workbench.settings.gitPane.log.groupByWorkspaceLabel')}
          description={t('workbench.settings.gitPane.log.groupByWorkspaceDescription')}
          value={view.groupFilesByWorkspace}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.groupFilesByWorkspace}
          onChange={(groupFilesByWorkspace) => patchView({ groupFilesByWorkspace })}
          testid="git-log-pane-group-by-workspace"
        />
        <ToggleRow
          settingKey="git.log.groupFilesByDirectory"
          label={t('workbench.settings.gitPane.log.groupByDirectoryLabel')}
          description={t('workbench.settings.gitPane.log.groupByDirectoryDescription')}
          value={view.groupFilesByDirectory}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.groupFilesByDirectory}
          onChange={(groupFilesByDirectory) => patchView({ groupFilesByDirectory })}
          testid="git-log-pane-group-by-directory"
        />
        <ToggleRow
          settingKey="git.log.showDetails"
          label={t('workbench.settings.gitPane.log.showDetailsLabel')}
          description={t('workbench.settings.gitPane.log.showDetailsDescription')}
          value={view.showDetails}
          defaultValue={DEFAULT_GIT_LOG_VIEW_PREFS.showDetails}
          onChange={(showDetails) => patchView({ showDetails })}
          testid="git-log-pane-show-details"
        />
        <FieldRow
          settingKey="git.log.doubleClickOpens"
          label={t('workbench.settings.gitPane.log.doubleClickLabel')}
          description={t('workbench.settings.gitPane.log.doubleClickDescription')}
          modified={view.doubleClickOpens !== DEFAULT_GIT_LOG_VIEW_PREFS.doubleClickOpens}
          onReset={() => patchView({ doubleClickOpens: DEFAULT_GIT_LOG_VIEW_PREFS.doubleClickOpens })}
        >
          <Select<GitDoubleClickTarget>
            size="small"
            value={view.doubleClickOpens}
            onChange={(doubleClickOpens) => patchView({ doubleClickOpens })}
            style={{ width: 160 }}
            options={[
              { value: 'diff', label: t('workbench.gitLog.options.showOnDoubleClick.diff') },
              { value: 'source', label: t('workbench.gitLog.options.showOnDoubleClick.source') },
            ]}
            data-testid="git-log-pane-double-click-select"
          />
        </FieldRow>
      </PaneSection>
      <PaneSection title={t('workbench.settings.category.gitLog.sub.console')}>
        <ToggleRow
          settingKey="git.console.softWrap"
          label={t('workbench.settings.gitPane.log.softWrapLabel')}
          description={t('workbench.settings.gitPane.log.softWrapDescription')}
          value={console.softWrap}
          defaultValue={DEFAULT_GIT_CONSOLE_PREFS.softWrap}
          onChange={(softWrap) => patchConsole({ softWrap })}
          testid="git-log-pane-soft-wrap"
        />
        <ToggleRow
          settingKey="git.console.foldOptions"
          label={t('workbench.settings.gitPane.log.foldOptionsLabel')}
          description={t('workbench.settings.gitPane.log.foldOptionsDescription')}
          value={console.foldOptions}
          defaultValue={DEFAULT_GIT_CONSOLE_PREFS.foldOptions}
          onChange={(foldOptions) => patchConsole({ foldOptions })}
          testid="git-log-pane-fold-options"
        />
        <ToggleRow
          settingKey="git.console.shortenPaths"
          label={t('workbench.settings.gitPane.log.shortenPathsLabel')}
          description={t('workbench.settings.gitPane.log.shortenPathsDescription')}
          value={console.shortenPaths}
          defaultValue={DEFAULT_GIT_CONSOLE_PREFS.shortenPaths}
          onChange={(shortenPaths) => patchConsole({ shortenPaths })}
          testid="git-log-pane-shorten-paths"
        />
      </PaneSection>
    </>
  );
};

export default GitLogSection;
