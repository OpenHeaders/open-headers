/**
 * useCommitPatch — the log's Create Patch… and Copy as Patch to
 * Clipboard: one host read answers the selected commits as a
 * mailbox-format text, and the surface decides where it goes — a file
 * through the browser's own save routine (the desktop shell reports
 * where it landed), or the clipboard. Nothing is written on the host.
 */

import { hostBridge } from '@openheaders/core/bridge';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { App as AntApp } from 'antd';
import { patchApplyOrder, patchFilename } from './commit-patch';
import { useGitWork } from './use-git-work';

export interface CommitPatchActions {
  /** Save the commits (list order, newest first) as one patch file. */
  createPatch: (shas: readonly string[]) => void;
  /** Put the same patch text on the clipboard. */
  copyAsPatch: (shas: readonly string[]) => void;
  /** The patch is being read at the host right now. */
  working: boolean;
}

function downloadPatch(filename: string, patch: string): void {
  const url = URL.createObjectURL(new Blob([patch], { type: 'text/x-patch;charset=utf-8' }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}

export function useCommitPatch(workspaceId: string): CommitPatchActions {
  const t = useT();
  const { notification } = AntApp.useApp();
  const work = useGitWork();

  const read = async (shas: readonly string[]): Promise<string | null> => {
    try {
      const result = await work.atHost(t('workbench.gitLog.working.patch'), () =>
        hostBridge.call('oh.workspaceTree.commitPatch', { workspaceId, shas: patchApplyOrder(shas) }),
      );
      if (result.ok) return result.patch;
      notification.error({
        title:
          result.reason === 'empty'
            ? t('workbench.gitLog.createPatch.empty')
            : result.reason === 'too-large'
              ? t('workbench.gitLog.createPatch.tooLarge')
              : t('workbench.gitLog.createPatch.failed', { detail: result.detail ?? result.reason }),
      });
    } catch (err) {
      notification.error({
        title: t('workbench.gitLog.createPatch.failed', { detail: err instanceof Error ? err.message : String(err) }),
      });
    }
    return null;
  };

  const createPatch = async (shas: readonly string[]): Promise<void> => {
    const patch = await read(shas);
    if (patch !== null) downloadPatch(patchFilename(shas), patch);
  };

  const copyAsPatch = async (shas: readonly string[]): Promise<void> => {
    const patch = await read(shas);
    if (patch === null) return;
    await navigator.clipboard.writeText(patch);
    notification.success({ title: t('workbench.gitLog.createPatch.copied'), duration: 3 });
  };

  return {
    createPatch: (shas) => void createPatch(shas),
    copyAsPatch: (shas) => void copyAsPatch(shas),
    working: work.working,
  };
}
