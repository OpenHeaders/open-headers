/**
 * WorkflowRunMessage — what a session step of a run opens to (the
 * workflow runs plan, The Run view): the messages its product holds —
 * an `expect`'s window with what became of each, a `send`'s message and
 * its reply — and the selected one in the timelines' own message viewer.
 * Loaded when such a step is first opened: the workflow editor does not
 * carry the code editor.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useState } from 'react';
import { buildHexDump, toBase64 } from '../request-editor/response/response-encoding';
import TimelineMessageViewer, { useTimelineViewerModes } from '../shared/TimelineMessageViewer';
import {
  defaultRunMessageIndex,
  type MessageProduct,
  type RunMessageNote,
  runMessageBody,
  runMessageEntries,
} from './run-message-display';

const { Text } = Typography;

interface Props {
  product: MessageProduct;
  /** The step whose start opened an `expect`'s window. */
  trigger: string | undefined;
}

const NOTE_WORD = {
  matched: 'workbench.editors.live.run.pane.note.matched',
  'not-matched': 'workbench.editors.live.run.pane.note.notMatched',
  stored: 'workbench.editors.live.run.pane.note.stored',
  sent: 'workbench.editors.live.run.pane.note.sent',
  reply: 'workbench.editors.live.run.pane.note.reply',
} as const;

const NOTE_COLOR: Record<RunMessageNote, string> = {
  matched: 'success',
  'not-matched': 'default',
  stored: 'default',
  sent: 'processing',
  reply: 'success',
};

const WorkflowRunMessage: React.FC<Props> = ({ product, trigger }) => {
  const { token } = theme.useToken();
  const t = useT();
  const entries = useMemo(() => runMessageEntries(product), [product]);
  const [picked, setPicked] = useState<number | null>(null);
  const [wrapLines, setWrapLines] = useState(true);
  const viewerModes = useTimelineViewerModes();

  const isWindow = product.window !== undefined;
  const selected = picked !== null && picked < entries.length ? picked : defaultRunMessageIndex(entries);
  const shown = selected === null ? null : entries[selected];
  const body = useMemo(() => (shown === null ? null : runMessageBody(shown.message)), [shown]);

  return (
    <div
      data-testid="wf-run-message"
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '8px 12px', gap: 8 }}
    >
      {isWindow && trigger !== undefined && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.live.run.pane.window.since', { step: trigger })}
        </Text>
      )}
      {entries.length === 0 ? (
        <Text type="secondary" data-testid="wf-run-message-empty" style={{ fontSize: 12 }}>
          {t(isWindow ? 'workbench.editors.live.run.pane.window.empty' : 'workbench.editors.live.run.pane.none')}
        </Text>
      ) : (
        <div
          className="oh-persistent-scroll"
          style={{
            flex: '0 1 auto',
            maxHeight: '40%',
            minHeight: 0,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: 6,
          }}
        >
          {entries.map((entry, index) => (
            <div
              key={entry.message.position}
              role="button"
              tabIndex={0}
              data-testid={`wf-run-message-row-${index}`}
              data-note={entry.note}
              data-selected={index === selected ? 'true' : undefined}
              onClick={() => setPicked(index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setPicked(index);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                padding: '4px 8px',
                fontSize: 12,
                cursor: 'pointer',
                background: index === selected ? token.controlItemBgActive : 'transparent',
                borderBottom: index === entries.length - 1 ? undefined : `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <Tag color={NOTE_COLOR[entry.note]} style={{ marginInlineEnd: 0, fontSize: 11 }}>
                {t(NOTE_WORD[entry.note])}
              </Tag>
              {entry.message.address !== null && (
                <Text style={{ fontSize: 11, fontFamily: "'SF Mono', monospace", flexShrink: 0 }}>
                  {entry.message.address}
                </Text>
              )}
              <Text type="secondary" ellipsis style={{ fontSize: 12, minWidth: 0 }}>
                {runMessageBody(entry.message).preview}
              </Text>
            </div>
          ))}
        </div>
      )}
      {shown !== null && body !== null && selected !== null && (
        <>
          <div data-testid="wf-run-message-fields" style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 12px' }}>
            {shown.message.fields.map((field, index) => (
              <span key={`${field.key}:${index}`} style={{ fontSize: 12, display: 'inline-flex', gap: 4 }}>
                <span style={{ color: token.colorTextSecondary }}>{field.key}</span>
                <span style={{ color: token.colorText }}>{field.value}</span>
              </span>
            ))}
          </div>
          <TimelineMessageViewer
            text={body.text}
            defaultFormat={body.format}
            hexDump={() => buildHexDump(body.bytes())}
            base64={() => toBase64(body.bytes())}
            mode={viewerModes.modeOf(selected, body.binary)}
            onModeChange={(mode) => viewerModes.setMode(selected, mode)}
            wrapLines={wrapLines}
            onWrapLinesChange={setWrapLines}
            actionsRef={viewerModes.actionsOf(selected)}
            testIdPrefix="wf-run"
          />
        </>
      )}
    </div>
  );
};

export default WorkflowRunMessage;
