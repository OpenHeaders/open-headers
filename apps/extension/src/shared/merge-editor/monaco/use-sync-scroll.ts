/**
 * Sync-scroll bridge.
 *
 * Mirrors the `result` editor's vertical scroll position to the side
 * editors. Result is the authority — it's the editable pane and the
 * one the user typically drives. Side editors echo `scrollTop`; their
 * own user-initiated scrolls flow back the same way (also writing to
 * result), so reading either side keeps the trio aligned.
 *
 * Re-entrancy guard: when we push a scroll to a slave, that slave's
 * onDidScrollChange fires too. The guard skips one tick on the
 * receiving side so we don't bounce.
 */

import type * as monaco from 'monaco-editor';
import { type RefObject, useEffect } from 'react';
import type { MonacoEditorHandle } from './use-monaco-editor-lifecycle';

export interface SyncScrollArgs {
  editors: ReadonlyArray<RefObject<MonacoEditorHandle>>;
}

export function useSyncScroll({ editors }: SyncScrollArgs): void {
  useEffect(() => {
    const subs: monaco.IDisposable[] = [];
    let muted = false;

    const ready = editors.map((r) => r.current?.editor).filter((e): e is monaco.editor.IStandaloneCodeEditor => !!e);
    if (ready.length < 2) return;

    for (const source of ready) {
      const sub = source.onDidScrollChange((event) => {
        if (muted) return;
        if (!event.scrollTopChanged) return;
        muted = true;
        try {
          for (const target of ready) {
            if (target === source) continue;
            target.setScrollTop(event.scrollTop);
          }
        } finally {
          muted = false;
        }
      });
      subs.push(sub);
    }

    return () => {
      for (const s of subs) s.dispose();
    };
    // The editor refs are stable handles; their `.current.editor` is set
    // once during the lifecycle effect (mount). Re-running on the array
    // identity alone is enough for the create-once-on-mount pattern.
  }, [editors]);
}
