/**
 * useFolderToCreate — the folder a bind of the typed path would create,
 * as the host that owns the disk resolves it (`oh.workspaceTree.probe`):
 * what the bind form says under its field before the press. The host is
 * asked once the typing has stood still, and only the path now typed is
 * answered for. Null while the path is blank, the folder stands, the
 * host does not say, or its answer is not in.
 */

import { useEffect, useState } from 'react';
import type { WorkspaceTreeTransport } from './transport';

/** How long the typed path stands still before the host is asked. */
export const FOLDER_PROBE_SETTLE_MS = 300;

export function useFolderToCreate(call: WorkspaceTreeTransport, typedPath: string): string | null {
  const rootDir = typedPath.trim();
  const [answer, setAnswer] = useState<{ rootDir: string; folder: string | null } | null>(null);

  useEffect(() => {
    if (rootDir === '') return;
    let asked = true;
    const timer = setTimeout(() => {
      call('oh.workspaceTree.probe', { rootDir }).then(
        (probe) => {
          if (asked) setAnswer({ rootDir, folder: probe.present ? null : (probe.missingFolder ?? null) });
        },
        // A host that does not answer says nothing of the folder.
        () => undefined,
      );
    }, FOLDER_PROBE_SETTLE_MS);
    return () => {
      asked = false;
      clearTimeout(timer);
    };
  }, [call, rootDir]);

  return answer !== null && answer.rootDir === rootDir ? answer.folder : null;
}
