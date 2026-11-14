/**
 * useRemoteOps — the edits of the configured remotes, ONE implementation
 * for every surface that offers them (the Git Remotes dialog's bar, the
 * branches rail's menu on a remote): Add and Edit through the Define
 * Remote form, Remove behind its confirm. Each change is one host verb,
 * named in the processes slot while it is out (the form's and the
 * confirm's own button sign it); with "Fetch remote" checked the remotes
 * are fetched once the change is in, so the new or edited remote's
 * branches show without a second gesture. The status frame the host
 * publishes moves the rail on its own; `onChanged` tells a surface that
 * lists the remotes itself to read them again.
 *
 * A remote named by a surface that holds no url (the rail knows a
 * remote by its name alone) is read from the host first.
 */

import { hostBridge, type WorkspaceTreeRemoteOpWire } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import { type ReactNode, useState } from 'react';
import { nameGitWork } from '../use-git-work';
import RemoteFormModal from './RemoteFormModal';
import { type RemoteDraft, type RemoteRow, remoteUpdatePatch } from './remote-form-model';

export interface RemoteOps {
  /** The Define Remote form, empty. */
  add: () => void;
  /** The Define Remote form on a remote. */
  edit: (row: RemoteRow) => void;
  /** The Define Remote form on the remote of that name, read from the host. */
  editNamed: (name: string) => void;
  /** Remove a remote, asked first. */
  remove: (name: string) => void;
  /** The Define Remote form — mount once in the caller's tree. */
  dialogs: ReactNode;
}

type FormState = { mode: 'add' } | { mode: 'edit'; row: RemoteRow };

const failure = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** `onChanged` — a remote was added, edited or removed; the name it now has, or null once it is gone. */
export function useRemoteOps(workspaceId: string, onChanged?: (name: string | null) => void): RemoteOps {
  const t = useT();
  const { modal, notification } = AntApp.useApp();
  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refusal = (result: Extract<WorkspaceTreeRemoteOpWire, { ok: false }>, name: string): string => {
    switch (result.reason) {
      case 'exists':
        return t('workbench.gitRemotes.exists', { name });
      case 'unknown-remote':
        return t('workbench.gitRemotes.unknown', { name });
      case 'invalid-name':
        return t('workbench.gitRemotes.define.nameInvalid');
      case 'invalid-url':
        return t('workbench.gitRemotes.define.urlInvalid');
      default:
        return t('workbench.gitRemotes.failed', { detail: result.detail ?? result.reason });
    }
  };

  const open = (next: FormState): void => {
    setError(null);
    setForm(next);
  };

  /** The remotes fetched after a change — a failure there is said, the change stands. */
  const fetchRemotes = async (): Promise<void> => {
    try {
      const fetched = await nameGitWork(t('workbench.gitLog.working.fetch'), () =>
        hostBridge.call('oh.workspaceTree.fetch', { workspaceId }),
      );
      if (!fetched.ok) {
        notification.error({ title: t('workbench.gitLog.fetch.failed', { detail: fetched.detail ?? fetched.reason }) });
      }
    } catch (err) {
      notification.error({ title: t('workbench.gitLog.fetch.failed', { detail: failure(err) }) });
    }
  };

  const submit = async (draft: RemoteDraft, fetch: boolean): Promise<void> => {
    if (form === null || busy) return;
    const patch = form.mode === 'edit' ? remoteUpdatePatch(form.row, draft) : null;
    setBusy(true);
    setError(null);
    try {
      // An edit that changes nothing sends nothing — the fetch, when asked, still runs.
      if (form.mode === 'add' || patch !== null) {
        const result =
          form.mode === 'add'
            ? await nameGitWork(t('workbench.gitLog.working.addRemote', { name: draft.name }), () =>
                hostBridge.call('oh.workspaceTree.addRemote', { workspaceId, name: draft.name, url: draft.url }),
              )
            : await nameGitWork(t('workbench.gitLog.working.updateRemote', { name: form.row.name }), () =>
                hostBridge.call('oh.workspaceTree.updateRemote', { workspaceId, name: form.row.name, ...patch }),
              );
        if (!result.ok) {
          setError(refusal(result, form.mode === 'add' ? draft.name : form.row.name));
          return;
        }
      }
      if (fetch) await fetchRemotes();
      setForm(null);
      onChanged?.(draft.name);
    } catch (err) {
      setError(t('workbench.gitRemotes.failed', { detail: failure(err) }));
    } finally {
      setBusy(false);
    }
  };

  const editNamed = async (name: string): Promise<void> => {
    try {
      const result = await hostBridge.call('oh.workspaceTree.listRemotes', { workspaceId });
      if (!result.ok) {
        notification.error({ title: t('workbench.gitRemotes.listFailed', { detail: result.detail ?? result.reason }) });
        return;
      }
      const row = result.remotes.find((remote) => remote.name === name);
      if (row === undefined) notification.error({ title: t('workbench.gitRemotes.unknown', { name }) });
      else open({ mode: 'edit', row });
    } catch (err) {
      notification.error({ title: t('workbench.gitRemotes.listFailed', { detail: failure(err) }) });
    }
  };

  const remove = (name: string): void => {
    modal.confirm({
      title: t('workbench.gitRemotes.removeConfirm', { name }),
      content: t('workbench.gitRemotes.removeConfirmBody'),
      okText: t('workbench.gitRemotes.removeOk'),
      okButtonProps: { danger: true, 'data-testid': 'git-remotes-remove-ok' },
      cancelText: t('workbench.gitLog.modal.cancel'),
      onOk: async () => {
        try {
          const result = await nameGitWork(t('workbench.gitLog.working.removeRemote', { name }), () =>
            hostBridge.call('oh.workspaceTree.removeRemote', { workspaceId, name }),
          );
          if (!result.ok) notification.error({ title: refusal(result, name) });
        } catch (err) {
          notification.error({ title: t('workbench.gitRemotes.failed', { detail: failure(err) }) });
        }
        onChanged?.(null);
      },
    });
  };

  return {
    add: () => open({ mode: 'add' }),
    edit: (row) => open({ mode: 'edit', row }),
    editNamed: (name) => void editNamed(name),
    remove,
    dialogs: (
      <RemoteFormModal
        initial={form === null ? null : form.mode === 'edit' ? form.row : { name: '', url: '' }}
        busy={busy}
        error={error}
        onSubmit={(draft, fetch) => void submit(draft, fetch)}
        onClose={() => setForm(null)}
      />
    ),
  };
}
