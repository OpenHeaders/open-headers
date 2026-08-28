/**
 * TimelineMessageViewer — the expanded message row's viewer shared by
 * the WebSocket, gRPC and MQTT timelines: a toolbar row (format
 * dropdown and wrap left, the Hexdump toggle and find right — the
 * compose bar's anatomy over a read-only buffer) above the framed
 * editor, or the frame's bytes as the classic dump in the same frame.
 * Per-viewer choice (`ViewerMode`) and the editor's find target live
 * on the timeline through `useTimelineViewerModes`, keyed by item
 * index; the wrap flag is ONE state across every open viewer.
 */

import { SearchOutlined } from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Select, Tooltip, theme } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import { getLanguage } from '../../languages/registry';
import type { HexDump } from '../request-editor/response/response-encoding';
import { WrapLinesIcon } from '../request-editor/response/ViewPickerIcons';
import CodeEditor from './CodeEditor';
import type { CodeEditorActionsTarget } from './CodeEditorActions';
import HexDumpView from './HexDumpView';

/** Pinned height of an expanded row's viewer: the 24px toolbar row +
 *  4px gap + 180px editor + 4px bottom pad + 1px divider — the virtual
 *  windows' arithmetic depends on it being exact by construction. */
export const VIEWER_TOOLBAR_PX = 24;
export const VIEWER_EDITOR_PX = 180;
export const VIEWER_PX = VIEWER_TOOLBAR_PX + 4 + VIEWER_EDITOR_PX + 4 + 1;

/** The viewer's text formats — a frame's bytes are the Hexdump
 *  toggle, not a format. */
export type ViewerFormat = 'text' | 'json' | 'xml' | 'html';
const VIEWER_FORMATS: readonly ViewerFormat[] = ['text', 'json', 'xml', 'html'];

/** Per-viewer display choice — `format` null follows the decode;
 *  `hex` shows the frame's bytes. */
export interface ViewerMode {
  format: ViewerFormat | null;
  hex: boolean;
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
    modeOf: (index, binary) => modes.get(index) ?? { format: null, hex: binary },
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
  /** The decoded message as the editor shows it. */
  text: string;
  /** The format the decode suggests, taken while the row has no choice. */
  defaultFormat: ViewerFormat;
  /** The frame's bytes as a dump — computed on demand, cached by the
   *  timeline's derivations. */
  hexDump: () => HexDump;
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
  defaultFormat,
  hexDump,
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
  return (
    <div
      data-testid={`${testIdPrefix}-message-viewer`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      style={{
        height: VIEWER_PX - 1,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingBottom: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: VIEWER_TOOLBAR_PX }}>
        <Select
          size="small"
          value={format}
          disabled={mode.hex}
          options={VIEWER_FORMATS.map((value) => ({ value, label: getLanguage(value).label }))}
          onChange={(next: ViewerFormat) => onModeChange({ ...mode, format: next })}
          style={{ width: 96 }}
          aria-label={t('workbench.editors.timelineViewer.format')}
          data-testid={`${testIdPrefix}-viewer-format`}
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
            disabled={mode.hex}
            onClick={() => onWrapLinesChange(!wrapLines)}
            aria-label={t('workbench.editors.request.response.body.wrapLines')}
            style={wrapLines && !mode.hex ? { background: token.colorBgTextActive } : undefined}
            data-testid={`${testIdPrefix}-viewer-wrap`}
          />
        </Tooltip>
        <span style={{ flex: 1 }} />
        <Button
          size="small"
          type="text"
          onClick={() => onModeChange({ ...mode, hex: !mode.hex })}
          aria-pressed={mode.hex}
          data-testid={`${testIdPrefix}-viewer-hex`}
        >
          {mode.hex
            ? t('workbench.editors.timelineViewer.showMessage')
            : t('workbench.editors.timelineViewer.showHexdump')}
        </Button>
        <Tooltip title={t('workbench.editors.scriptEditor.find')} placement="bottom">
          <Button
            size="small"
            type="text"
            icon={<SearchOutlined />}
            disabled={mode.hex}
            onClick={() => actionsRef.current?.find()}
            aria-label={t('workbench.editors.scriptEditor.find')}
            data-testid={`${testIdPrefix}-viewer-find`}
          />
        </Tooltip>
      </div>
      {mode.hex ? (
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
            value={text}
            language={format}
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
