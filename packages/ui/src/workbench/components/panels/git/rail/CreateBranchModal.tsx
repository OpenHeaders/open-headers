/**
 * CreateBranchModal — the New Branch dialog (IDE-log): "Create Branch
 * from <start point>", a name input prefilled with the start point's
 * name (selected for quick overtyping), the Checkout-branch checkbox
 * (default on) and the Overwrite-existing-branch checkbox (default
 * off). Create calls the runtime verb; typed refusals render inline
 * (`exists` nudges toward Overwrite).
 */

import { hostBridge } from '@openheaders/core/bridge';
import { Checkbox, Input, Modal, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { InputRef } from 'antd';
import { useT } from '@openheaders/ui/context/LocaleContext';

export interface CreateBranchModalProps {
  workspaceId: string;
  /** Start point — the selected ref, or the current branch when the
   *  selection is HEAD. Null keeps the modal unmounted. */
  from: string | null;
  /** Verb-side start point: `from` when it resolves in the ref tree,
   *  undefined to anchor at HEAD (the unborn-branch case — the name
   *  exists only as `gitStatus.branch`, so the membership gate would
   *  refuse it; HEAD IS that branch). */
  fromRef: string | undefined;
  /** The Git tool window element — the modal centers over the panel,
   *  not the app window. Null falls back to the document body. */
  container: HTMLElement | null;
  onClose: () => void;
  /** A branch was created (and possibly checked out) — the caller
   *  raises the balloon and the status frame refreshes the views. */
  onCreated: (branch: string, from: string, checkedOut: boolean) => void;
}

const CreateBranchModal: React.FC<CreateBranchModalProps> = ({
  workspaceId,
  from,
  fromRef,
  container,
  onClose,
  onCreated,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [name, setName] = useState('');
  const [checkout, setCheckout] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (from === null) return;
    setName(from);
    setCheckout(true);
    setOverwrite(false);
    setError(null);
    // Prefill selected-all (the IDE gesture: type to replace).
    const timer = setTimeout(() => inputRef.current?.select(), 50);
    return () => clearTimeout(timer);
  }, [from]);

  const submit = async (): Promise<void> => {
    if (from === null || busy) return;
    const branch = name.trim();
    if (branch.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await hostBridge.call('oh.workspaceTree.createBranch', {
        workspaceId,
        branch,
        ...(fromRef !== undefined ? { from: fromRef } : {}),
        checkout,
        overwrite,
      });
      if (result.ok) {
        onCreated(result.branch, from, result.checkedOut);
        onClose();
      } else if (result.reason === 'exists') {
        setError(t('workbench.gitLog.createBranch.exists', { name: branch }));
      } else {
        setError(t('workbench.gitLog.createBranch.failed', { detail: result.detail ?? result.reason }));
      }
    } catch (err) {
      setError(t('workbench.gitLog.createBranch.failed', { detail: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={from !== null}
      title={from !== null ? t('workbench.gitLog.createBranch.title', { from }) : ''}
      okText={t('workbench.gitLog.createBranch.create')}
      cancelText={t('workbench.gitLog.createBranch.cancel')}
      okButtonProps={{ disabled: name.trim().length === 0, loading: busy }}
      onOk={() => void submit()}
      onCancel={onClose}
      width={480}
      centered
      getContainer={container ?? undefined}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flexShrink: 0 }}>{t('workbench.gitLog.createBranch.nameLabel')}</span>
          <Input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onPressEnter={() => void submit()}
            data-testid="git-tool-create-branch-name"
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Checkbox
            checked={checkout}
            onChange={(e) => setCheckout(e.target.checked)}
            data-testid="git-tool-create-branch-checkout"
          >
            {t('workbench.gitLog.createBranch.checkout')}
          </Checkbox>
          <Checkbox
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            data-testid="git-tool-create-branch-overwrite"
          >
            {t('workbench.gitLog.createBranch.overwrite')}
          </Checkbox>
        </div>
        {error !== null && (
          <div style={{ fontSize: 12, color: token.colorError }} data-testid="git-tool-create-branch-error">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CreateBranchModal;
