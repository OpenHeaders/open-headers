/**
 * Console REPL prompt (JS contexts Phase D) — the input row pinned under
 * the console body. Enter evaluates in the selector's effective context
 * (the echo pair arrives back on the console stream, so submission only
 * dispatches); ↑/↓ walk a panel-local history ring, with the draft
 * preserved when stepping off its bottom.
 *
 * Never-silent gating: the row renders whenever capture is live, and
 * disables (with the reason as placeholder) while no evaluation context
 * exists yet — the registry fills within a beat of attach.
 */

import { useRef, useState } from 'react';

export interface ConsolePromptProps {
  /** The selector's effective context — evaluation target (null = none yet). */
  contextKey: string | null;
  onSubmit: (expression: string) => void;
}

export function ConsolePrompt({ contextKey, onSubmit }: ConsolePromptProps) {
  const [value, setValue] = useState('');
  const history = useRef<string[]>([]);
  /** Index into `history` while browsing; null = at the live draft. */
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const draft = useRef('');

  const submit = (): void => {
    const expression = value.trim();
    if (expression.length === 0 || contextKey === null) return;
    onSubmit(expression);
    if (history.current[history.current.length - 1] !== expression) history.current.push(expression);
    setValue('');
    draft.current = '';
    setHistoryIndex(null);
  };

  const step = (direction: -1 | 1): void => {
    const entries = history.current;
    if (entries.length === 0) return;
    if (historyIndex === null) {
      if (direction === 1) return;
      draft.current = value;
      setHistoryIndex(entries.length - 1);
      setValue(entries[entries.length - 1]);
      return;
    }
    const next = historyIndex + direction;
    if (next >= entries.length) {
      setHistoryIndex(null);
      setValue(draft.current);
      return;
    }
    if (next < 0) return;
    setHistoryIndex(next);
    setValue(entries[next]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      step(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      step(1);
    }
  };

  return (
    <div className="dt-console-prompt">
      <span className="dt-console-prompt-glyph" aria-hidden="true">
        ›
      </span>
      <input
        type="text"
        className="dt-console-prompt-input"
        value={value}
        disabled={contextKey === null}
        placeholder={contextKey === null ? 'Waiting for a JavaScript context…' : 'Run JavaScript in the selected context'}
        aria-label="Console prompt"
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setValue(e.target.value);
          setHistoryIndex(null);
        }}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
