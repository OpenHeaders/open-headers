/**
 * Console REPL prompt (JS contexts Phase D) — the input row pinned under
 * the console body. Enter evaluates in the selector's effective context
 * (the echo pair arrives back on the console stream, so submission only
 * dispatches); ↑/↓ walk the history ring, with the draft preserved when
 * stepping off its bottom. The ring lives in the console-prefs store, so
 * it survives tool-window switches like every other console pref.
 *
 * Eager evaluation: while the setting is on, the typed text previews on a
 * grey line under the input — a silent, side-effect-free evaluation the
 * host refuses rather than runs when it could mutate state. Debounced;
 * stale responses drop; a preview identical to the typed text stays quiet.
 *
 * Autocomplete from history: while the setting is on, the most recent
 * prior command extending the typed prefix ghosts ahead of the caret;
 * Tab (or → at the end of the text) accepts it.
 *
 * Never-silent gating: the row renders whenever capture is live, and
 * disables (with the reason as placeholder) while no evaluation context
 * exists yet — the registry fills within a beat of attach.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { pushConsolePromptHistory, useConsolePrefs } from '../data/console-prefs';

export interface ConsolePromptProps {
  /** The selector's effective context — evaluation target (null = none yet). */
  contextKey: string | null;
  onSubmit: (expression: string) => void;
  /** Eager-evaluation preview; resolves `null` when there is nothing to show. */
  onPreview: (expression: string) => Promise<string | null>;
}

/** Preview debounce — the browser's own text-change throttle interval. */
const PREVIEW_DEBOUNCE_MS = 150;
/** No eager evaluation past this length (the browser's cap). */
const MAX_EAGER_EXPRESSION = 2_000;

export function ConsolePrompt({ contextKey, onSubmit, onPreview }: ConsolePromptProps) {
  const [value, setValue] = useState('');
  const prefs = useConsolePrefs();
  const history = prefs.promptHistory;
  /** Index into the history ring while browsing; null = at the live draft. */
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const draft = useRef('');
  const [preview, setPreview] = useState<string | null>(null);
  const previewSeq = useRef(0);

  // Eager evaluation — debounced on the typed text; a stale response (the
  // text moved on) drops, and a preview that would just echo the input hides.
  useEffect(() => {
    const seq = ++previewSeq.current;
    const expression = value.trim();
    if (!prefs.eagerEval || contextKey === null || expression.length === 0 || expression.length > MAX_EAGER_EXPRESSION) {
      setPreview(null);
      return;
    }
    const timer = setTimeout(() => {
      void onPreview(expression).then((text) => {
        if (previewSeq.current !== seq) return;
        setPreview(text !== null && text !== expression ? text : null);
      });
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, prefs.eagerEval, contextKey, onPreview]);

  // Autocomplete from history — the most recent prior command extending the
  // typed prefix, ghosted ahead of the caret (suspended while walking the
  // ring: the arrows already put a full command in the input).
  const suggestion = useMemo(() => {
    if (!prefs.autocompleteHistory || historyIndex !== null || value.length === 0) return null;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].startsWith(value) && history[i] !== value) return history[i];
    }
    return null;
  }, [prefs.autocompleteHistory, history, value, historyIndex]);

  const submit = (): void => {
    const expression = value.trim();
    if (expression.length === 0 || contextKey === null) return;
    onSubmit(expression);
    pushConsolePromptHistory(expression);
    setValue('');
    draft.current = '';
    setHistoryIndex(null);
  };

  const step = (direction: -1 | 1): void => {
    if (history.length === 0) return;
    if (historyIndex === null) {
      if (direction === 1) return;
      draft.current = value;
      setHistoryIndex(history.length - 1);
      setValue(history[history.length - 1]);
      return;
    }
    const next = historyIndex + direction;
    if (next >= history.length) {
      setHistoryIndex(null);
      setValue(draft.current);
      return;
    }
    if (next < 0) return;
    setHistoryIndex(next);
    setValue(history[next]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    const input = e.currentTarget;
    const caretAtEnd = input.selectionStart === value.length && input.selectionEnd === value.length;
    if (suggestion !== null && (e.key === 'Tab' || (e.key === 'ArrowRight' && caretAtEnd))) {
      e.preventDefault();
      setValue(suggestion);
      return;
    }
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
    <div className="dt-console-prompt-area">
      <div className="dt-console-prompt">
        <span className="dt-console-prompt-glyph" aria-hidden="true">
          ›
        </span>
        <span className="dt-console-prompt-editor">
          {suggestion !== null && (
            // The ghost underlay: an invisible copy of the typed text keeps
            // the dimmed remainder aligned with the caret (same font/metrics
            // as the input above it).
            <span className="dt-console-prompt-ghost" aria-hidden="true">
              <span className="dt-console-prompt-ghost-typed">{value}</span>
              {suggestion.slice(value.length)}
            </span>
          )}
          <input
            type="text"
            className="dt-console-prompt-input"
            value={value}
            disabled={contextKey === null}
            placeholder={
              contextKey === null ? 'Waiting for a JavaScript context…' : 'Run JavaScript in the selected context'
            }
            aria-label="Console prompt"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setValue(e.target.value);
              setHistoryIndex(null);
            }}
            onKeyDown={onKeyDown}
          />
        </span>
      </div>
      {preview !== null && (
        <div className="dt-console-prompt-preview" aria-label="Eager evaluation preview">
          <span className="dt-console-prompt-preview-glyph" aria-hidden="true">
            ‹
          </span>
          <span className="dt-console-prompt-preview-text">{preview}</span>
        </div>
      )}
    </div>
  );
}
