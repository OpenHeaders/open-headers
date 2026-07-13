/**
 * useMonacoJwtEdit — per-editor wiring for JWT editing inside a Monaco
 * buffer. Attach from the editor's `onMount`; detected tokens get an
 * underline decoration (refreshed debounced on content changes), the
 * hover's "Edit JWT" command link or a cmd/ctrl+click opens the shared
 * JWT modal, and Save replaces just that token in the buffer through
 * the editor's edit stack (undoable, cursor preserved). The clicked
 * range rides its own decoration so edits elsewhere in the buffer
 * can't shift the write-back target. A pending-edit guard keeps a
 * double delivery (hover command + mouse listener) harmless.
 */

import { scanForJWTs } from '@openheaders/ui/shared/value-detection';
import type * as monacoType from 'monaco-editor';
import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { attachJwtEditTarget, buildJwtDecorations, type JwtLinkTarget, registerJwtLinkPlane } from './monaco-jwt-links';

// Same lazy treatment as `useValueEditAction` — the modal mounts
// nothing until a token is actually activated.
const JWTEditorModalLazy = lazy(() => import('./JWTEditorModal'));

const DECORATION_REFRESH_MS = 300;

interface PendingEdit {
  editor: monacoType.editor.IStandaloneCodeEditor;
  model: monacoType.editor.ITextModel;
  decorationIds: string[];
  token: string;
}

export interface MonacoJwtEditOptions {
  /** Viewer wiring for read-only buffers: the hover link reads
   *  "View JWT" and the modal opens read-only with no write-back. */
  readOnly?: boolean;
}

export interface MonacoJwtEditResult {
  /** Call from the editor's `onMount`. Idempotent per Monaco instance;
   *  re-attaching (fresh mount) replaces the previous registration. */
  attachJwtDetection: (editor: monacoType.editor.IStandaloneCodeEditor, monacoApi: typeof monacoType) => void;
  /** Render alongside the editor — mounts nothing until a token opens. */
  jwtModal: React.ReactNode;
}

export function useMonacoJwtEdit({ readOnly = false }: MonacoJwtEditOptions = {}): MonacoJwtEditResult {
  const t = useT();
  const [pending, setPending] = useState<PendingEdit | null>(null);
  const pendingRef = useRef<PendingEdit | null>(null);
  const detachRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      detachRef.current?.();
      detachRef.current = null;
    };
  }, []);

  const attachJwtDetection = useCallback(
    (editor: monacoType.editor.IStandaloneCodeEditor, monacoApi: typeof monacoType) => {
      registerJwtLinkPlane(monacoApi);
      detachRef.current?.();
      const model = editor.getModel();
      if (!model) return;

      const openTarget = (target: JwtLinkTarget) => {
        // Double-delivery guard — the mouse listener and the hover
        // command can both report one activation.
        if (pendingRef.current) return;
        // Pin the clicked token's range with a decoration so the
        // write-back survives any buffer movement while the modal is up.
        const startPos = target.model.getPositionAt(target.start);
        const endPos = target.model.getPositionAt(target.end);
        const decorationIds = target.model.deltaDecorations(
          [],
          [
            {
              range: new monacoApi.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
              options: { stickiness: monacoApi.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges },
            },
          ],
        );
        const edit: PendingEdit = { editor, model: target.model, decorationIds, token: target.token };
        pendingRef.current = edit;
        setPending(edit);
      };

      const { id, detach: detachTarget } = attachJwtEditTarget(model, openTarget);

      // Underline decorations over detected tokens, refreshed debounced
      // while the user types.
      let underlineIds: string[] = [];
      let refreshTimer: ReturnType<typeof setTimeout> | null = null;
      const refresh = () => {
        underlineIds = model.deltaDecorations(
          underlineIds,
          buildJwtDecorations(model, id, readOnly ? 'view' : 'edit', t),
        );
      };
      refresh();
      const contentListener = model.onDidChangeContent(() => {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(refresh, DECORATION_REFRESH_MS);
      });

      // Direct activation path — cmd/ctrl+click on a detected token.
      const mouseListener = editor.onMouseUp((e) => {
        if (!(e.event.metaKey || e.event.ctrlKey) || e.event.leftButton === false) return;
        const position = e.target.position;
        if (!position) return;
        const liveModel = editor.getModel();
        if (!liveModel) return;
        const offset = liveModel.getOffsetAt(position);
        const hit = scanForJWTs(liveModel.getValue()).find((h) => offset >= h.start && offset <= h.end);
        if (!hit) return;
        openTarget({ model: liveModel, start: hit.start, end: hit.end, token: hit.token });
      });

      detachRef.current = () => {
        if (refreshTimer) clearTimeout(refreshTimer);
        contentListener.dispose();
        mouseListener.dispose();
        if (!model.isDisposed()) model.deltaDecorations(underlineIds, []);
        detachTarget();
      };
    },
    [readOnly, t],
  );

  const clearPending = useCallback((edit: PendingEdit) => {
    if (!edit.model.isDisposed()) edit.model.deltaDecorations(edit.decorationIds, []);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const handleSave = useCallback(
    (nextToken: string) => {
      if (!pending) return;
      const range = pending.model.getDecorationRange(pending.decorationIds[0]);
      if (range) {
        pending.editor.executeEdits('oh-jwt-edit', [{ range, text: nextToken }]);
      }
      clearPending(pending);
    },
    [pending, clearPending],
  );

  const handleCancel = useCallback(() => {
    if (pending) clearPending(pending);
  }, [pending, clearPending]);

  return {
    attachJwtDetection,
    jwtModal: pending ? (
      <Suspense fallback={null}>
        <JWTEditorModalLazy
          open
          token={pending.token}
          readOnly={readOnly}
          onSave={readOnly ? undefined : handleSave}
          onCancel={handleCancel}
        />
      </Suspense>
    ) : null,
  };
}
