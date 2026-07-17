/**
 * FormatAwareBodyEditor — the workbench's format-aware wrapper over the
 * static-body CodeEditor (response / request-body / ws / sse payloads).
 *
 * The FORM VALUE stays the wire text: the wrapper formats a VIEW of it
 * for the Formatted mode and re-encodes every edit through
 * `encodeBodyForWire`, so derived-dirty equality, conflict chips and
 * awareness fields keep operating on canonical text unchanged. An
 * untouched view never emits, and an edit reverted to the formatted
 * baseline re-emits the original bytes exactly (the verbatim
 * short-circuit) — a no-edit save stays byte-identical to the wire.
 *
 * Cost discipline: the view is formatted once per external value change
 * and the encode runs once per editor change event — the only
 * per-keystroke tokenize. The Formatted/Raw gate tokenizes only in Raw
 * mode (in Formatted mode it is trivially available), so no change ever
 * pays for two scans.
 */

import { ConfigProvider, Segmented, Tooltip, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { encodeBodyForWire, formatBody, isFormattableBody } from '@openheaders/ui/shared/body-format';
import type { LanguageId } from '../../languages/registry';
import CodeEditor from '../shared/CodeEditor';

type BodyViewMode = 'formatted' | 'raw';

interface BodyViewState {
  /** External wire text the view was seeded from — the encode baseline. */
  baseline: string;
  /** Formatted-mode buffer; stale in Raw mode until the next toggle. */
  view: string;
  mode: BodyViewMode;
}

function seedBodyViewState(wire: string): BodyViewState {
  return {
    baseline: wire,
    view: formatBody(wire),
    mode: isFormattableBody(wire) ? 'formatted' : 'raw',
  };
}

interface FormatAwareBodyEditorProps {
  /** Wire-profile body text — injected by the host `Form.Item`. */
  value?: string;
  onChange?: (value: string) => void;
  /** Monaco language for the body's coloring — derive it from the
   *  rule's content-type (`detectLanguage`) so an HTML/JS/CSS body
   *  highlights like the response viewers do. Defaults to json. */
  language?: LanguageId;
  placeholder?: string;
  minHeight?: number;
  valueDetection?: boolean;
  /** Rendered on the toggle row's right side — the host's conflict chip. */
  extra?: React.ReactNode;
}

const FormatAwareBodyEditor: React.FC<FormatAwareBodyEditorProps> = ({
  value = '',
  onChange,
  language = 'json',
  placeholder,
  minHeight = 160,
  valueDetection = false,
  extra,
}) => {
  const t = useT();
  const { token } = theme.useToken();
  const [state, setState] = useState<BodyViewState>(() => seedBodyViewState(value));
  const lastEmittedRef = useRef(value);

  // External value change (canonical reload, form reset, conflict apply)
  // reseeds the view; the echo of our own emission does not — that would
  // reformat under the user's caret.
  if (value !== state.baseline && value !== lastEmittedRef.current) {
    lastEmittedRef.current = value;
    setState(seedBodyViewState(value));
  }

  // In Formatted mode the affordance is trivially available; only Raw
  // mode pays a tokenize to decide whether the toggle can leave it.
  const formattable = useMemo(
    () => (state.mode === 'formatted' ? true : isFormattableBody(value)),
    [state.mode, value],
  );

  const handleFormattedChange = (next: string) => {
    setState((s) => ({ ...s, view: next }));
    const wire = encodeBodyForWire(state.baseline, next);
    lastEmittedRef.current = wire;
    onChange?.(wire);
  };

  const handleRawChange = (next: string) => {
    lastEmittedRef.current = next;
    onChange?.(next);
  };

  const handleModeChange = (mode: BodyViewMode) => {
    // Entering Formatted re-derives the view from the CURRENT wire text
    // so Raw-mode edits are picked up; leaving it keeps the wire value
    // already emitted per edit.
    setState((s) => (mode === 'formatted' ? { ...s, mode, view: formatBody(value) } : { ...s, mode }));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <ConfigProvider
          // The stock thumb is near-invisible against the dark editors —
          // the accent selection keeps the active mode legible on both
          // themes (scoped-provider idiom, see QuickConditionsRow).
          theme={{
            components: {
              Segmented: {
                itemSelectedBg: token.colorPrimary,
                itemSelectedColor: token.colorTextLightSolid,
              },
            },
          }}
        >
          <Tooltip
            title={formattable ? undefined : t('workbench.editors.rule.fields.formatAwareBody.unavailableTooltip')}
          >
            <Segmented
              size="small"
              value={state.mode}
              onChange={(mode) => handleModeChange(mode as BodyViewMode)}
              options={[
                {
                  value: 'formatted',
                  label: t('workbench.editors.rule.fields.formatAwareBody.formatted'),
                  disabled: !formattable,
                },
                { value: 'raw', label: t('workbench.editors.rule.fields.formatAwareBody.raw') },
              ]}
            />
          </Tooltip>
        </ConfigProvider>
        {extra}
      </div>
      <CodeEditor
        language={language}
        value={state.mode === 'formatted' ? state.view : value}
        onChange={state.mode === 'formatted' ? handleFormattedChange : handleRawChange}
        placeholder={placeholder}
        minHeight={minHeight}
        valueDetection={valueDetection}
      />
    </div>
  );
};

export default FormatAwareBodyEditor;
