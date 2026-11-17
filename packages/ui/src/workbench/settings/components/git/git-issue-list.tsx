/**
 * Git › Folder — the files of the bound folder that were not taken in,
 * a row a cause (`foldTreeIssues`): a file with what it holds back
 * counted beside it, or a directory that holds no collection or folder
 * with the count of the files skipped in it. The title counts files.
 */

import type { WorkspaceTreeIssueWire } from '@openheaders/core/bridge';
import { foldTreeIssues } from '@openheaders/core/workspace-tree';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Alert, theme } from 'antd';
import type React from 'react';

const GitIssueList: React.FC<{ issues: readonly WorkspaceTreeIssueWire[] }> = ({ issues }) => {
  const { token } = theme.useToken();
  const t = useT();
  const code: React.CSSProperties = { fontFamily: token.fontFamilyCode };

  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginTop: 10 }}
      data-testid="git-pane-issues-alert"
      title={
        <span style={{ fontSize: 12 }}>{t('workbench.settings.gitPane.issuesTitle', { count: issues.length })}</span>
      }
      description={
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 11.5 }}>
          {foldTreeIssues(issues).map((row) =>
            row.kind === 'directory' ? (
              <li key={`${row.dir}/`}>
                <span style={code}>{`${row.dir}/`}</span> —{' '}
                {t('workbench.settings.gitPane.issuesUncontained', { count: row.files })}
              </li>
            ) : (
              <li key={row.path}>
                <span style={code}>{row.path}</span> — {row.message}
                {row.inside > 0 && ` — ${t('workbench.settings.gitPane.issuesInside', { count: row.inside })}`}
              </li>
            ),
          )}
        </ul>
      }
    />
  );
};

export default GitIssueList;
