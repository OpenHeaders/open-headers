/**
 * TimelineMessageViewer — the expanded row's viewer shared by the
 * WebSocket, gRPC and MQTT timelines and the SSE event list: the HTTP
 * response body's toolbar over a read-only buffer — the one view
 * picker (a language = Pretty under that grammar; Raw / Hex / Base64
 * the byte views) and wrap on the left, Find and Copy on the right —
 * above the framed editor, or the message's bytes as the classic dump
 * in the same frame. Pretty is the HTTP body's law carried over: a
 * JSON or markup message re-indents for reading (the default — a
 * minified payload arrives as one line), Raw is the wire text
 * verbatim; a grammar without a formatter shows the text as it came.
 * Per-viewer choice (`ViewerMode`) and the editor's find target live
 * on the timeline through `useTimelineViewerModes`, keyed by item
 * index; the wrap flag is ONE state across every open viewer.
 */

import { CheckOutlined, CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Tooltip, theme } from 'antd';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { LanguageId } from '../../languages/registry';
import type { HexDump } from '../request-editor/response/response-encoding';
import { WrapLinesIcon } from '../request-editor/response/ViewPickerIcons';
import BodyViewPicker, { type EncodingView } from './BodyViewPicker';
import CodeEditor from './CodeEditor';
import type { CodeEditorActionsTarget } from './CodeEditorActions';
import HexDumpView from './HexDumpView';
import { usePrettyViewerText } from './use-pretty-viewer-text';

/** The timelines' row hairline — a CSS variable with the theme's
 *  secondary border as its fallback, so the LAST rendered row can drop
 *  it through `.oh-stream-last-row` (dock-layout.css) without every
 *  row site threading a flag: no line closes the list, the same as no
 *  line opens it. */
export const STREAM_HAIRLINE = '1px solid var(--oh-stream-hairline, var(--ant-color-border-secondary))';

/** Wraps every rendered entry — the same element whether last or not,
 *  so a row never remounts as the last slot moves — and marks the
 *  last one so its hairline goes. */
export const StreamLastRow: React.FC<{ last: boolean; children: React.ReactNode }> = ({ last, children }) => (
  <div className={last ? 'oh-stream-last-row' : undefined}>{children}</div>
);

/** Pinned height of an expanded row's viewer: the 24px toolbar row +
 *  4px gap + 180px editor + 4px bottom pad + 1px divider — the virtual
 *  windows' arithmetic depends on it being exact by construction. */
export const VIEWER_TOOLBAR_PX = 24;
export const VIEWER_EDITOR_PX = 180;
export const VIEWER_PX = VIEWER_TOOLBAR_PX + 4 + VIEWER_EDITOR_PX + 4 + 1;

/** Per-viewer display choice — `format` null follows the decode;
 *  `view` is Pretty under the format, or one of the byte views. */
export interface ViewerMode {
  format: LanguageId | null;
  view: 'pretty' | EncodingView;
}

export interface TimelineViewerModes {
  /** The row's choice, or the default for a row never touched — a
   *  binary frame opens on its bytes. */
  modeOf: (index: number, binary: boolean) => ViewerMode;
  setMode: (index: number, mode: ViewerMode) => void;
  /** One imperative find target per open viewer. */
  actionsOf: (index: number) => React.MutableRefObject<CodeEditorActionsTarget | null>;
}

export function useTimelineViewerModes(): TimelineViewerModes {
  const [modes, setModes] = useState<ReadonlyMap<number, ViewerMode>>(new Map());
  const refs = useRef(new Map<number, React.MutableRefObject<CodeEditorActionsTarget | null>>());
  return {
    modeOf: (index, binary) => modes.get(index) ?? { format: null, view: binary ? 'hex' : 'pretty' },
    setMode: (index, mode) => setModes((prev) => new Map(prev).set(index, mode)),
    actionsOf: (index) => {
      let ref = refs.current.get(index);
      if (ref === undefined) {
        ref = { current: null };
        refs.current.set(index, ref);
      }
      return ref;
    },
  };
}

interface TimelineMessageViewerProps {
  /** The wire text as decoded — Raw shows it verbatim, Pretty
   *  re-indents it under the format. */
  text: string;
  /** A host-printed Pretty text where the host's print is the law
   *  (the SSE list's lossless per-document print); absent, Pretty is
   *  the shared re-indent over `text`. */
  prettyText?: string;
  /** The format the decode suggests, taken while the row has no choice. */
  defaultFormat: LanguageId;
  /** The message's bytes as a dump — computed on demand, cached by the
   *  timeline's derivations. */
  hexDump: () => HexDump;
  /** The same bytes base64-encoded — the host's stored form. */
  base64: () => string;
  mode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  wrapLines: boolean;
  onWrapLinesChange: (wrap: boolean) => void;
  actionsRef: React.MutableRefObject<CodeEditorActionsTarget | null>;
  /** Pin prefix — `<prefix>-message-viewer` on the block, the toolbar
   *  controls as `<prefix>-viewer-*`, the dump as `<prefix>-hex`. */
  testIdPrefix: string;
}

const TimelineMessageViewer: React.FC<TimelineMessageViewerProps> = ({
  text,
  prettyText,
  defaultFormat,
  hexDump,
  base64,
  mode,
  onModeChange,
  wrapLines,
  onWrapLinesChange,
  actionsRef,
  testIdPrefix,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const format = mode.format ?? defaultFormat;
  const hex = mode.view === 'hex';
  const pretty = mode.view === 'pretty';
  const sharedPretty = usePrettyViewerText(text, format, pretty && prettyText === undefined);
  // The buffer's text by view: the host's print or the shared
  // re-indent under Pretty, the wire text under Raw, the stored bytes
  // under Base64; the dump renders its own frame.
  const shownText = pretty ? (prettyText ?? sharedPretty) : mode.view === 'base64' ? base64() : text;

  // The copy button's one-and-a-half-second check — the HTTP body's
  // feedback; copies what the frame shows.
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
    },
    [],
  );
  const copyShown = () => {
    void navigator.clipboard.writeText(hex ? hexDump().text : shownText).then(() => {
      setCopied(true);
      if (copiedTimerRef.current !== null) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      data-testid={`${testIdPrefix}-message-viewer`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{
        height: VIEWER_PX - 1,
        borderBottom: STREAM_HAIRLINE,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingBottom: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: VIEWER_TOOLBAR_PX }}>
        <BodyViewPicker
          language={format}
          view={mode.view === 'pretty' ? null : mode.view}
          onPickLanguage={(language) => onModeChange({ format: language, view: 'pretty' })}
          onPickView={(view) => onModeChange({ ...mode, view })}
          ariaLabel={t('workbench.editors.timelineViewer.format')}
          testId={`${testIdPrefix}-viewer-picker`}
        />
        <Tooltip
          title={
            wrapLines
              ? t('workbench.editors.request.response.body.unwrapLines')
              : t('workbench.editors.request.response.body.wrapLines')
          }
          placement="bottom"
        >
          <Button
            size="small"
            type="text"
            icon={<WrapLinesIcon />}
            disabled={hex}
            onClick={() => onWrapLinesChange(!wrapLines)}
            aria-label={t('workbench.editors.request.response.body.wrapLines')}
            style={wrapLines && !hex ? { background: token.colorBgTextActive } : undefined}
            data-testid={`${testIdPrefix}-viewer-wrap`}
          />
        </Tooltip>
        <span style={{ flex: 1 }} />
        <Tooltip title={t('shared.codeEditor.find')} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={<SearchOutlined />}
            disabled={hex}
            onClick={() => actionsRef.current?.find()}
            aria-label={t('shared.codeEditor.find')}
            data-testid={`${testIdPrefix}-viewer-find`}
          />
        </Tooltip>
        <Tooltip
          title={
            copied
              ? t('workbench.editors.request.response.copied')
              : t('workbench.editors.timelineViewer.copyMessage')
          }
          placement="bottom"
        >
          <Button
            size="small"
            type="text"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={copyShown}
            aria-label={t('workbench.editors.timelineViewer.copyMessage')}
            data-testid={`${testIdPrefix}-viewer-copy`}
          />
        </Tooltip>
      </div>
      {hex ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '4px 8px',
            border: `1px solid ${token.colorBorder}`,
            borderRadius: 6,
          }}
        >
          <HexDumpView dump={hexDump()} testIdPrefix={`${testIdPrefix}-hex`} />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <CodeEditor
            value={shownText}
            language={pretty ? format : 'text'}
            readOnly
            fill
            variableAutoComplete={false}
            wordWrapOverride={wrapLines ? 'on' : 'off'}
            actions="external"
            actionsRef={actionsRef}
          />
        </div>
      )}
    </div>
  );
};

export default TimelineMessageViewer;
