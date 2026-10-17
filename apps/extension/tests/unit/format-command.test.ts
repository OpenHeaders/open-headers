/**
 * format-command — the page-global Format command runs the FOCUSED
 * editor's registered routine (the one the toolbar button runs),
 * installs once, and forgets a routine once it unregisters.
 */

import {
  EDITOR_FORMAT_COMMAND_ID,
  ensureEditorFormatCommand,
  type FormatCommandEditor,
  registerEditorFormatHandler,
  runFocusedEditorFormat,
} from '@openheaders/ui/workbench/components/monaco/format-command';
import { describe, expect, it, vi } from 'vitest';

function editor(focused: boolean): FormatCommandEditor {
  return { hasTextFocus: () => focused };
}

describe('runFocusedEditorFormat', () => {
  it('runs the routine of the editor holding text focus and no other', () => {
    const idle = editor(false);
    const focused = editor(true);
    const idleRun = vi.fn();
    const focusedRun = vi.fn();
    registerEditorFormatHandler(idle, idleRun);
    registerEditorFormatHandler(focused, focusedRun);
    expect(runFocusedEditorFormat([idle, focused])).toBe(true);
    expect(focusedRun).toHaveBeenCalledTimes(1);
    expect(idleRun).not.toHaveBeenCalled();
  });

  it('reports false with no focused editor or no routine for it', () => {
    const idle = editor(false);
    registerEditorFormatHandler(idle, vi.fn());
    expect(runFocusedEditorFormat([idle])).toBe(false);
    const unregistered = editor(true);
    expect(runFocusedEditorFormat([unregistered])).toBe(false);
  });

  it('forgets a routine once it unregisters', () => {
    const focused = editor(true);
    const run = vi.fn();
    const unregister = registerEditorFormatHandler(focused, run);
    unregister();
    expect(runFocusedEditorFormat([focused])).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('ensureEditorFormatCommand', () => {
  it('registers the command once and dispatches to the focused editor', () => {
    const registerCommand = vi.fn(() => ({ dispose: () => {} }));
    const focused = editor(true);
    const run = vi.fn();
    registerEditorFormatHandler(focused, run);
    const host = { editor: { registerCommand, getEditors: () => [editor(false), focused] } };
    ensureEditorFormatCommand(host);
    ensureEditorFormatCommand(host);
    expect(registerCommand).toHaveBeenCalledTimes(1);
    const [id, handler] = registerCommand.mock.calls[0] as unknown as [string, () => void];
    expect(id).toBe(EDITOR_FORMAT_COMMAND_ID);
    handler();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
