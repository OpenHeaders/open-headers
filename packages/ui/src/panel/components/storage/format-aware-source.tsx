/**
 * Format-aware Source plane for the storage value documents — the panel
 * sibling of the workbench's `FormatAwareBodyEditor`, over the same
 * `body-format` fidelity core.
 *
 * `useFormatAwareSource` owns the {baseline, view, mode} machine and
 * keeps the FORM VALUE in WIRE space: the Formatted mode renders a
 * whitespace-only view of the stored text and re-encodes every edit
 * through `encodeBodyForWire`, so derived dirty, the conflict tier and
 * the save path keep comparing the exact stored bytes. An untouched
 * view never emits, and an edit reverted to the formatted baseline
 * re-emits the original bytes exactly (the verbatim short-circuit) — a
 * no-edit Save writes what the browser stores. Raw mode is verbatim
 * passthrough. Mode toggles never emit, so they can never dirty.
 *
 * Cost discipline mirrors the workbench wrapper: the view is formatted
 * once per external value change, the encode runs once per editor
 * change event (the only per-keystroke tokenize), and the Formatted/Raw
 * gate tokenizes only in Raw mode. The 2 MB tokenize cap fails open —
 * an oversized value simply stays Raw.
 *
 * `FormatModeToggle` renders the Formatted/Raw pair in the storage
 * documents' own mode-button vocabulary (`dt-storagedoc-mode`), shared
 * by the DOM entry editor and the cache entry's view-only toggle.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { encodeBodyForWire, formatBody, isFormattableBody } from '@openheaders/ui/shared/body-format';
import { useMemo, useRef, useState } from 'react';

export type SourceFormatMode = 'formatted' | 'raw';

interface SourceViewState {
  /** External wire text the view was seeded from — the encode baseline. */
  baseline: string;
  /** Formatted-mode buffer; stale in Raw mode until the next toggle. */
  view: string;
  mode: SourceFormatMode;
}

function seedSourceViewState(wire: string): SourceViewState {
  return {
    baseline: wire,
    view: formatBody(wire),
    mode: isFormattableBody(wire) ? 'formatted' : 'raw',
  };
}

export interface FormatAwareSourceApi {
  mode: SourceFormatMode;
  /** Can the Formatted mode be entered right now? */
  formattable: boolean;
  /** What the Source editor renders — the view in Formatted mode, the
   *  wire text in Raw mode. */
  editorValue: string;
  onEditorChange: (next: string) => void;
  onModeChange: (mode: SourceFormatMode) => void;
}

export function useFormatAwareSource(value: string, onChange: (wire: string) => void): FormatAwareSourceApi {
  const [state, setState] = useState<SourceViewState>(() => seedSourceViewState(value));
  const lastEmittedRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // External value change (canonical reload, Refresh, take-theirs, a
  // merge commit) reseeds the view; the echo of our own emission does
  // not — that would reformat under the user's caret.
  if (value !== state.baseline && value !== lastEmittedRef.current) {
    lastEmittedRef.current = value;
    setState(seedSourceViewState(value));
  }

  // In Formatted mode the affordance is trivially available; only Raw
  // mode pays a tokenize to decide whether the toggle can leave it.
  const formattable = useMemo(
    () => (state.mode === 'formatted' ? true : isFormattableBody(value)),
    [state.mode, value],
  );

  return useMemo<FormatAwareSourceApi>(
    () => ({
      mode: state.mode,
      formattable,
      editorValue: state.mode === 'formatted' ? state.view : value,
      onEditorChange: (next: string) => {
        if (state.mode === 'formatted') {
          setState((s) => ({ ...s, view: next }));
          const wire = encodeBodyForWire(state.baseline, next);
          lastEmittedRef.current = wire;
          onChangeRef.current(wire);
        } else {
          lastEmittedRef.current = next;
          onChangeRef.current(next);
        }
      },
      onModeChange: (mode: SourceFormatMode) => {
        // Entering Formatted re-derives the view from the CURRENT wire
        // text so Raw-mode edits are picked up; leaving it keeps the
        // wire value already emitted per edit.
        setState((s) => (mode === 'formatted' ? { ...s, mode, view: formatBody(value) } : { ...s, mode }));
      },
    }),
    [state, formattable, value],
  );
}

interface FormatModeToggleProps {
  mode: SourceFormatMode;
  formattable: boolean;
  onModeChange: (mode: SourceFormatMode) => void;
}

export function FormatModeToggle({ mode, formattable, onModeChange }: FormatModeToggleProps) {
  const t = useT();
  return (
    <span className="dt-storagedoc-modes" role="radiogroup" aria-label={t('panel.storage.doc.formatAria')}>
      <button
        type="button"
        className="dt-storagedoc-mode"
        role="radio"
        aria-checked={mode === 'formatted'}
        data-active={mode === 'formatted'}
        disabled={!formattable}
        title={formattable ? t('panel.storage.doc.formattedTitle') : t('panel.storage.doc.formatUnavailable')}
        onClick={() => onModeChange('formatted')}
      >
        {t('panel.storage.doc.formatted')}
      </button>
      <button
        type="button"
        className="dt-storagedoc-mode"
        role="radio"
        aria-checked={mode === 'raw'}
        data-active={mode === 'raw'}
        title={t('panel.storage.doc.rawTitle')}
        onClick={() => onModeChange('raw')}
      >
        {t('panel.storage.doc.raw')}
      </button>
    </span>
  );
}
