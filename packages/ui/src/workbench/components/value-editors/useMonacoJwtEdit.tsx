/**
 * useMonacoJwtEdit — per-editor wiring for JWT editing inside a Monaco
 * buffer. Attach from the editor's `onMount`; detected tokens become
 * "Edit JWT" links (cmd/ctrl+click), the click opens the shared JWT
 * modal, and Save replaces just that token in the buffer through the
 * editor's edit stack (undoable, cursor preserved). The clicked range
 * rides a decoration so edits elsewhere in the buffer can't shift the
 * write-back target.
 *
 * Activation arrives on two paths: the token's `command:` link (the
 * hover's clickable "Edit JWT" label and native cmd/ctrl+click both
 * execute it) and our own `onMouseUp` listener as a belt-and-braces
 * fallback for hosts where the opener chain doesn't deliver clicks —
 * a pending-edit guard keeps a double delivery harmless.
 */

import type * as monacoType from 'monaco-editor';
import type React from 'react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { attachJwtEditTarget, type JwtLinkTarget, registerJwtLinkPlane } from './monaco-jwt-links';
import { scanForJWTs } from './scan';

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
        // Double-delivery guard — the mouse listener and (on hosts
        // where it works) the link opener can both report one click.
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

      const detachLinks = attachJwtEditTarget(model, openTarget);

      // Primary activation path — cmd/ctrl+click on a detected token.
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
        detachLinks();
        mouseListener.dispose();
      };
    },
    [],
  );

  const clearPending = useCallback((edit: PendingEdit) => {
    edit.model.deltaDecorations(edit.decorationIds, []);
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
        <JWTEditorModalLazy open token={pending.token} onSave={handleSave} onCancel={handleCancel} />
      </Suspense>
    ) : null,
  };
}
