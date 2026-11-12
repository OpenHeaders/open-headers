/**
 * FileHistoryModal — one path's timeline (`fileLog`, renames followed):
 * the newest entry is "who last touched this". Fetches on open,
 * renders sha · subject · author line · co-authors per entry; typed
 * refusals render inline. Panel-scoped like every Git window dialog.
 * The title names the file as the workbench names it (`NamedFileTitle`).
 */

import { hostBridge, type WorkspaceTreeLogEntryWire } from '@openheaders/core/bridge';
import { Modal, Spin, theme } from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import NamedFileTitle from './NamedFileTitle';

const HISTORY_LIMIT = 50;

export interface FileHistoryModalProps {
  workspaceId: string;
  /** The repository-relative path; null keeps the modal unmounted. */
  path: string | null;
  /** The Git tool window element — the modal centers over the panel. */
  container: HTMLElement | null;
  onClose: () => void;
}

const FileHistoryModal: React.FC<FileHistoryModalProps> = ({ workspaceId, path, container, onClose }) => {
  const { locale, t } = useLocale();
  const { token } = theme.useToken();
  const [entries, setEntries] = useState<WorkspaceTreeLogEntryWire[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (path === null) return;
    let cancelled = false;
    setEntries([]);
    setError(null);
    setLoading(true);
    void hostBridge
      .call('oh.workspaceTree.fileLog', { workspaceId, path, limit: HISTORY_LIMIT })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setEntries(result.entries);
        else setError(t('workbench.gitLog.fileHistory.failed', { detail: result.detail ?? result.reason }));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(t('workbench.gitLog.fileHistory.failed', { detail: (err as Error).message }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, path, t]);

  return (
    <Modal
      open={path !== null}
      title={path !== null ? <NamedFileTitle messageKey="workbench.gitLog.fileHistory.title" path={path} /> : ''}
      footer={null}
      onCancel={onClose}
      width={560}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
      data-testid="git-tool-file-history"
    >
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <Spin size="small" />
        </div>
      )}
      {error !== null && (
        <div style={{ fontSize: 12, color: token.colorError }} data-testid="git-tool-file-history-error">
          {error}
        </div>
      )}
      {!loading && error === null && entries.length === 0 && (
        <p style={{ fontSize: 12, margin: 0 }} data-testid="git-tool-file-history-empty">
          {t('workbench.gitLog.fileHistory.empty')}
        </p>
      )}
      {entries.length > 0 && (
        <ul
          style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 360, overflowY: 'auto' }}
          data-testid="git-tool-file-history-list"
        >
          {entries.map((entry) => (
            <li
              key={entry.sha}
              style={{ padding: '6px 0', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
              data-testid="git-tool-file-history-entry"
              data-sha={entry.sha}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span
                  title={entry.sha}
                  style={{ fontFamily: token.fontFamilyCode, fontSize: 11, color: token.colorTextSecondary }}
                >
                  {entry.sha.slice(0, 8)}
                </span>
                <span style={{ fontSize: 12, color: token.colorText, flex: 1, overflowWrap: 'anywhere' }}>
                  {entry.subject}
                </span>
              </div>
              <div style={{ fontSize: 11, color: token.colorTextSecondary, marginTop: 2 }}>
                {t('workbench.gitLog.authorLine', {
                  author: entry.authorName,
                  email: entry.authorEmail,
                  date: new Date(entry.authoredAt).toLocaleString(locale),
                })}
              </div>
              {entry.coAuthors.length > 0 && (
                <div style={{ fontSize: 11, color: token.colorTextSecondary }}>
                  {t('workbench.gitLog.coAuthors', { authors: entry.coAuthors.join(', ') })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
};

export default FileHistoryModal;
