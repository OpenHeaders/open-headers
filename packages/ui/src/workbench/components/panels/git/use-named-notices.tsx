/**
 * useNamedNotices — a surface's notices about files of the workspace's
 * tree, the files named as the workbench names them
 * (`use-workspace-file-namer`), without the surface reading the
 * workspace itself: it hands over what to say, and a child mounted only
 * while something waits reads the workspace, says it with the namer and
 * leaves. Each notice keeps its surface's own face — the surface raises
 * it, this only lends the names.
 */

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceFileNamer } from './use-workspace-file-namer';

/** A file's name for a notice. */
export type NameFile = (path: string) => string;

type Say = (nameOf: NameFile) => void;

export interface NamedNotices {
  /** Say something that names files — run once, with the namer, as soon as the workspace is read. */
  say: (say: Say) => void;
  /** Mount once in the surface's tree. */
  holder: ReactNode;
}

function Sayer({ waiting, onSaid }: { waiting: readonly Say[]; onSaid: (said: readonly Say[]) => void }) {
  const nameOf = useWorkspaceFileNamer();
  const said = useRef(new Set<Say>());
  useEffect(() => {
    for (const say of waiting) {
      if (said.current.has(say)) continue;
      said.current.add(say);
      say(nameOf);
    }
    onSaid(waiting);
  }, [waiting, nameOf, onSaid]);
  return null;
}

export function useNamedNotices(): NamedNotices {
  const [waiting, setWaiting] = useState<readonly Say[]>([]);
  const say = useCallback((one: Say): void => setWaiting((prev) => [...prev, one]), []);
  const onSaid = useCallback(
    (said: readonly Say[]): void => setWaiting((prev) => prev.filter((one) => !said.includes(one))),
    [],
  );
  return { say, holder: waiting.length > 0 ? <Sayer waiting={waiting} onSaid={onSaid} /> : null };
}
