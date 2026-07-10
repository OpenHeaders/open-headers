/**
 * useMonacoJwtEdit — per-editor wiring for JWT editing inside a Monaco
 * buffer. Attach from the editor's `onMount`; detected tokens become
 * "Edit JWT" links (cmd/ctrl+click), the click opens the shared JWT
 * modal, and Save replaces just that token in the buffer through the
 * editor's edit stack (undoable, cursor preserved). The clicked range
 * rides a decoration so edits elsewhere in the buffer can't shift the
 * write-back target.
 */

import type * as monacoType from 'monaco-editor';
import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { attachJwtEditTarget, type JwtLinkTarget, registerJwtLinkPlane } from './monaco-jwt-links';

// Same lazy treatment as `useJwtEditAction` — the modal mounts nothing
// until a link is actually followed.
const JWTEditorModalLazy = lazy(() => import('./JWTEditorModal'));

interface PendingEdit {
  editor: monacoType.editor.IStandaloneCodeEditor;
  model: monacoType.editor.ITextModel;
  decorationIds: string[];
  token: string;
}

export interface MonacoJwtEditResult {
  /** Call from the editor's `onMount`. Idempotent per Monaco instance;
   *  re-attaching (fresh mount) replaces the previous registration. */
  attachJwtDetection: (editor: monacoType.editor.IStandaloneCodeEditor, monacoApi: typeof monacoType) => void;
  /** Render alongside the editor — mounts nothing until a link opens. */
  jwtModal: React.ReactNode;
}

export function useMonacoJwtEdit(): MonacoJwtEditResult {
  const [pending, setPending] = useState<PendingEdit | null>(null);
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
      const detach = attachJwtEditTarget(model, (target: JwtLinkTarget) => {
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
        setPending({ editor, model: target.model, decorationIds, token: target.token });
      });
      detachRef.current = detach;
    },
    [],
  );

  const clearPending = useCallback((edit: PendingEdit) => {
    edit.model.deltaDecorations(edit.decorationIds, []);
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
        <JWTEditorModalLazy open token={pending.token} onSave={handleSave} onCancel={handleCancel} />
      </Suspense>
    ) : null,
  };
}
