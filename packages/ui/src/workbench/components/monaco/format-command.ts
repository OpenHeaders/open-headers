/**
 * format-command — ONE Format path for the button and the chord.
 *
 * The toolbar's Format button runs the host editor's own format
 * routine (which can resolve a plain-text buffer's real language
 * before formatting), while a keybinding rule can only name a
 * command id. Binding the chord to Monaco's built-in
 * `editor.action.formatDocument` would make the two disagree — the
 * chord silently doing nothing on the buffer the button formats. So
 * the chord binds to this page-global command, which hands off to the
 * handler the FOCUSED editor registered at mount: same routine, same
 * outcome, whichever way the user asks.
 */

import type * as monaco from 'monaco-editor';

export const EDITOR_FORMAT_COMMAND_ID = 'oh.editor.format';

/** The slice of an editor the command needs to pick the target. */
export interface FormatCommandEditor {
  hasTextFocus(): boolean;
}

/** The slice of the Monaco namespace the install drives —
 *  structurally satisfied by the instance `onMount` hands out. */
export interface MonacoFormatCommandHost {
  editor: {
    registerCommand(id: string, handler: () => void): monaco.IDisposable;
    getEditors(): readonly FormatCommandEditor[];
  };
}

const handlers = new WeakMap<FormatCommandEditor, () => void>();

/** Register the routine Format runs for this editor; returns the
 *  unregister. */
export function registerEditorFormatHandler(editor: FormatCommandEditor, run: () => void): () => void {
  handlers.set(editor, run);
  return () => {
    if (handlers.get(editor) === run) handlers.delete(editor);
  };
}

/** Run the focused editor's Format routine; false when no mounted
 *  editor holds text focus or the focused one registered none. */
export function runFocusedEditorFormat(editors: readonly FormatCommandEditor[]): boolean {
  const focused = editors.find((editor) => editor.hasTextFocus());
  if (!focused) return false;
  const run = handlers.get(focused);
  if (!run) return false;
  run();
  return true;
}

let installed = false;

/** Install the page-global command once — the first mounted editor
 *  wins, later mounts share it. */
export function ensureEditorFormatCommand(host: MonacoFormatCommandHost): void {
  if (installed) return;
  installed = true;
  host.editor.registerCommand(EDITOR_FORMAT_COMMAND_ID, () => {
    runFocusedEditorFormat(host.editor.getEditors());
  });
}
