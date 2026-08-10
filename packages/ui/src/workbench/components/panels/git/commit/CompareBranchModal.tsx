/**
 * CompareBranchModal — the Commit window's "Compare with Branch or
 * Tag…" picker: the `listRefs` tree flattened to a searchable list
 * (locals, remotes, tags; the checked-out branch omitted — comparing a
 * ref with itself is the empty answer). Picking a ref opens the Git
 * window's Compare-with-Current tab via the shared registry; the modal
 * is panel-scoped like every Commit-window dialog.
 */

import { BranchesOutlined, TagOutlined } from '@ant-design/icons';
import { hostBridge, type WorkspaceTreeRefWire } from '@openheaders/core/bridge';
import { Input, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface CompareBranchModalProps {
  workspaceId: string;
  open: boolean;
  /** The Commit tool window element — the modal centers over the
   *  panel, not the app window. Null falls back to the document body. */
  container: HTMLElement | null;
  onClose: () => void;
  onPick: (ref: string) => void;
}

const CompareBranchModal: React.FC<CompareBranchModalProps> = ({ workspaceId, open, container, onClose, onPick }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [refs, setRefs] = useState<WorkspaceTreeRefWire[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setSearch('');
    void hostBridge
      .call('oh.workspaceTree.listRefs', { workspaceId })
      .then((result) => {
        if (result.ok) {
          setRefs(result.refs);
          setCurrent(result.current);
        }
      })
      .catch(() => undefined);
  }, [open, workspaceId]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return refs.filter(
      (ref) => ref.name !== current && (needle.length === 0 || ref.name.toLowerCase().includes(needle)),
    );
  }, [refs, current, search]);

  return (
    <Modal
      open={open}
      title={t('workbench.commitTool.menu.comparePickerTitle')}
      footer={null}
      onCancel={onClose}
      width={420}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('workbench.commitTool.menu.comparePickerSearch')}
          autoFocus
          data-testid="commit-tool-compare-search"
        />
        <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {visible.length === 0 && (
            <span style={{ fontSize: 12, color: token.colorTextTertiary, padding: '4px 2px' }}>
              {t('workbench.commitTool.menu.comparePickerEmpty')}
            </span>
          )}
          {visible.map((ref) => (
            <button
              key={`${ref.kind}:${ref.name}`}
              type="button"
              className="git-tool-row"
              onClick={() => onPick(ref.name)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                padding: '3px 6px',
                fontSize: 13,
                color: token.colorText,
                cursor: 'pointer',
              }}
              data-testid="commit-tool-compare-ref"
              data-ref={ref.name}
            >
              {ref.kind === 'tag' ? (
                <TagOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
              ) : (
                <BranchesOutlined style={{ fontSize: 13, color: token.colorTextTertiary }} />
              )}
              <span style={{ flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ref.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default CompareBranchModal;
