// @vitest-environment jsdom
/**
 * CodeEditorActions — the Find / Replace / Format cluster: names ride
 * every toolbar row by default and only the corner overlay drops them;
 * Format stays in the row for a language without a formatter, disabled
 * with the reason, and the read-only cluster carries Find alone.
 */

import CodeEditorActions, {
  type CodeEditorActionsTarget,
} from '@openheaders/ui/workbench/components/shared/CodeEditorActions';
// Registers the keyboard.* settings the cluster's shortcut hints read.
import '@openheaders/ui/workbench/settings/schema/keyboard';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(cleanup);

function target(): { ref: React.RefObject<CodeEditorActionsTarget>; actions: CodeEditorActionsTarget } {
  const actions = { find: vi.fn(), replace: vi.fn(), format: vi.fn() };
  return { ref: { current: actions }, actions };
}

describe('CodeEditorActions', () => {
  it('shows icon + name for Find, Replace and Format on a formattable language', () => {
    const { ref, actions } = target();
    render(<CodeEditorActions target={ref} language="json" />);
    expect(screen.getByTestId('code-editor-find').textContent).toBe('Find');
    expect(screen.getByTestId('code-editor-replace').textContent).toBe('Replace');
    const format = screen.getByTestId('code-editor-format') as HTMLButtonElement;
    expect(format.textContent).toBe('Format');
    expect(format.disabled).toBe(false);
    fireEvent.click(format);
    expect(actions.format).toHaveBeenCalledTimes(1);
  });

  it('keeps Format in the row, disabled, for a language without a formatter', () => {
    const { ref, actions } = target();
    render(<CodeEditorActions target={ref} language="text" />);
    const format = screen.getByTestId('code-editor-format') as HTMLButtonElement;
    expect(format.disabled).toBe(true);
    fireEvent.click(format);
    expect(actions.format).not.toHaveBeenCalled();
  });

  it('drops the names only in the icons-only corner form', () => {
    const { ref } = target();
    render(<CodeEditorActions target={ref} language="json" iconsOnly />);
    expect(screen.getByTestId('code-editor-find').textContent).toBe('');
    expect(screen.getByTestId('code-editor-find').getAttribute('aria-label')).toBe('Find');
  });

  it('carries Find alone on a read-only buffer', () => {
    const { ref } = target();
    render(<CodeEditorActions target={ref} language="json" readOnly />);
    expect(screen.getByTestId('code-editor-find')).toBeTruthy();
    expect(screen.queryByTestId('code-editor-replace')).toBeNull();
    expect(screen.queryByTestId('code-editor-format')).toBeNull();
  });
});
