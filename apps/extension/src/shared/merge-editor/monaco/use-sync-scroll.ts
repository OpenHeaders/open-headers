/**
 * Sync-scroll bridge.
 *
 * Mirrors scroll position (BOTH vertical and horizontal) across all
 * editors in the merge-editor pane group. Any pane the user
 * scrolls becomes the authority for that tick; the others echo
 * `scrollTop` / `scrollLeft`. Re-entrancy guard skips the bounce
 * tick on the receiving side.
 *
 * Horizontal sync matters for long YAML / JSON lines where the
 * user wraps off-screen — the matching content on the OTHER side
 * is also off-screen, but at the same horizontal offset, so the
 * panes stay vertically AND horizontally aligned through the diff.
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
        if (!event.scrollTopChanged && !event.scrollLeftChanged) return;
        muted = true;
        try {
          for (const target of ready) {
            if (target === source) continue;
            if (event.scrollTopChanged) target.setScrollTop(event.scrollTop);
            if (event.scrollLeftChanged) target.setScrollLeft(event.scrollLeft);
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
