/**
 * GrpcTimelineEntryRow — one display entry of the gRPC timeline,
 * rendered from the model plane's `GrpcTimelineEntry` vocabulary: the
 * lifecycle rows ("Request sent" expandable to the carried metadata,
 * "Response received" expandable to the received-metadata line, the
 * ended row — a failure or a lost connection expandable to its
 * explanation), the script marks, the group headers and their "show
 * older" rows, the message rows (direction badge · opt-in type chip ·
 * preview · session time · expand slot) and the expanded payload
 * viewer. Purely presentational — expansion state and its toggles
 * belong to the orchestrator (`GrpcMessageTimeline.tsx`).
 */

import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CodeOutlined,
  DisconnectOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { Button, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { scriptSlotInfo } from '../script-editor/script-slot-info';
import TimelineMessageViewer, { STREAM_HAIRLINE, type TimelineViewerModes } from '../shared/TimelineMessageViewer';
import type { GrpcScriptMarkItem } from './grpc-scripts';
import {
  CONNECTED_DETAIL_PX,
  cellFont,
  type DirectionChips,
  ERROR_DETAIL_PX,
  formatMessageTime,
  type GrpcFrameDerivations,
  type GrpcTimelineEntry,
  type GrpcTimelineItem,
  type GrpcTimelineLifecycle,
  sentDetailPx,
} from './grpc-timeline-model';
import { useGrpcRowParts } from './grpc-timeline-row-parts';
import { endedRowText, scriptRowText } from './grpc-timeline-row-text';
import GrpcTimelineGroupHeader from './GrpcTimelineGroupHeader';

/** The received-metadata sentence with only the linked WORD carrying
 *  the affordance — the sentence splits on the {metadata} marker so
 *  word order stays each locale's own; the hover tint is the line's. */
const ReceivedMetadataLine: React.FC<{ onShowMetadata: (() => void) | undefined }> = ({ onShowMetadata }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [before = '', after = ''] = t('workbench.editors.grpc.timeline.receivedMetadata').split('{metadata}');
  return (
    <div style={{ fontSize: 12, lineHeight: '20px', height: 20, color: token.colorTextSecondary }}>
      {before}
      <button
        type="button"
        data-testid="grpc-timeline-received-metadata-link"
        onClick={(event) => {
          event.stopPropagation();
          onShowMetadata?.();
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 12,
          lineHeight: '20px',
          color: hovered ? token.colorPrimary : token.colorText,
          textDecoration: 'underline',
          cursor: 'pointer',
        }}
      >
        {t('workbench.editors.grpc.timeline.receivedMetadataLink')}
      </button>
      {after}
    </div>
  );
};

interface GrpcTimelineEntryRowProps {
  entry: GrpcTimelineEntry;
  items: readonly GrpcTimelineItem[];
  /** Session-only positional times (items[i] ↔ timestamps[i]). */
  timestamps?: readonly number[] | undefined;
  lifecycle: GrpcTimelineLifecycle;
  scriptMarks: readonly GrpcScriptMarkItem[];
  chips: DirectionChips;
  /** Per-row type chips are opt-in (the Postman posture). */
  showTypes: boolean;
  derive: GrpcFrameDerivations;
  /** Expanded message indexes — a message row's viewer follows each. */
  expanded: ReadonlySet<number>;
  sentExpanded: boolean;
  connectedExpanded: boolean;
  errorExpanded: boolean;
  /** Response metadata pair count — absent = unknown, the connected
   *  row reads plain. */
  responseMetadataCount?: number | undefined;
  groupRowLimit: number;
  unwindowedGroups: ReadonlySet<string>;
  onToggleRow: (index: number) => void;
  onToggleSent: () => void;
  onToggleConnected: () => void;
  onToggleError: () => void;
  onToggleGroup: (key: string) => void;
  onToggleGroupWindow: (key: string) => void;
  onShowMetadata?: (() => void) | undefined;
  onTrustCertificate?: (() => void) | undefined;
  trustOfferOpen: boolean;
  wrapLines: boolean;
  onWrapLinesChange: (wrap: boolean) => void;
  viewerModes: TimelineViewerModes;
}

const GrpcTimelineEntryRow: React.FC<GrpcTimelineEntryRowProps> = ({
  entry,
  items,
  timestamps,
  lifecycle,
  scriptMarks,
  chips,
  showTypes,
  derive,
  expanded,
  sentExpanded,
  connectedExpanded,
  errorExpanded,
  responseMetadataCount,
  groupRowLimit,
  unwindowedGroups,
  onToggleRow,
  onToggleSent,
  onToggleConnected,
  onToggleError,
  onToggleGroup,
  onToggleGroupWindow,
  onShowMetadata,
  onTrustCertificate,
  trustOfferOpen,
  wrapLines,
  onWrapLinesChange,
  viewerModes,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const { singleRowStyle, lifecycleRowStyle, lifecycleTime, expandSlot, lifecycleGlyph, directionBadge, chipTag } =
    useGrpcRowParts();

  const sentMetadata = lifecycle.requestMetadata ?? [];
  const sentRecorded = lifecycle.requestMetadata !== undefined;
  const errorExpandable =
    (lifecycle.endedBy === 'error' || lifecycle.endedBy === 'lost') && lifecycle.endedMessage !== undefined;
  const connectedExpandable = responseMetadataCount !== undefined;

  // A clickable row's a11y + toggle plumbing — the same shape on every
  // expandable lifecycle row.
  const expandableProps = (open: boolean, toggle: () => void) => ({
    role: 'button',
    tabIndex: 0,
    'aria-expanded': open,
    className: 'oh-stream-row',
    onClick: toggle,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggle();
      }
    },
  });

  switch (entry.kind) {
    case 'sent':
      // With a recorded metadata truth the row expands to the pairs
      // the call actually carried — or to the honest "No metadata
      // sent." line (the MQTT Connected row's anatomy). Unrecorded
      // (live phase, older hosts) reads plain.
      return (
        <div
          data-testid="grpc-timeline-sent-row"
          {...(sentRecorded ? expandableProps(sentExpanded, onToggleSent) : {})}
          style={{ ...lifecycleRowStyle, ...(sentRecorded ? { cursor: 'pointer' } : {}) }}
        >
          {lifecycleGlyph(<InfoCircleOutlined aria-hidden style={{ color: token.colorTextTertiary }} />)}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('workbench.editors.grpc.timeline.requestSent')}
          </span>
          {lifecycleTime(lifecycle.startedAt)}
          {expandSlot(sentRecorded ? sentExpanded : null)}
        </div>
      );
    case 'sentDetail': {
      const sentSecretKeys = new Set((lifecycle.secretMetadataKeys ?? []).map((key) => key.toLowerCase()));
      return (
        <div
          data-testid="grpc-timeline-metadata-details"
          style={{
            height: sentDetailPx(sentMetadata.length),
            boxSizing: 'border-box',
            padding: '6px 10px 6px 37px',
            borderBottom: STREAM_HAIRLINE,
            overflow: 'hidden',
          }}
        >
          <div style={{ ...cellFont, fontSize: 11, lineHeight: '18px', height: 18, color: token.colorTextTertiary }}>
            {t('workbench.editors.grpc.response.tab.metadata')}
          </div>
          {sentMetadata.length === 0 ? (
            <div style={{ ...cellFont, lineHeight: '20px', height: 20, color: token.colorTextSecondary }}>
              {t('workbench.editors.grpc.timeline.noMetadataSent')}
            </div>
          ) : (
            sentMetadata.map((pair, index) => (
              <div
                key={`${String(index)}:${pair.key}`}
                style={{
                  ...cellFont,
                  lineHeight: '20px',
                  height: 20,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                <span style={{ color: token.colorTextSecondary }}>{pair.key}: </span>
                <span style={{ color: token.colorText }}>
                  {sentSecretKeys.has(pair.key.toLowerCase())
                    ? t('workbench.editors.session.secretHidden')
                    : pair.value}
                </span>
              </div>
            ))
          )}
        </div>
      );
    }
    case 'errorDetail':
      if (lifecycle.endedMessage === undefined) return null;
      // The failure explained — the shared guidance line, then the
      // classified message verbatim on the error tint (full text on
      // hover).
      return (
        <div
          data-testid="grpc-timeline-error-details"
          style={{
            height: ERROR_DETAIL_PX,
            boxSizing: 'border-box',
            padding: '6px 10px 6px 37px',
            borderBottom: STREAM_HAIRLINE,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              fontSize: 12,
              lineHeight: '20px',
              height: 20,
              color: token.colorTextSecondary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {t('workbench.editors.grpc.response.error.localGuidance')}
          </div>
          <div
            title={
              lifecycle.endedAdvice !== undefined
                ? `${lifecycle.endedMessage} ${lifecycle.endedAdvice}`
                : lifecycle.endedMessage
            }
            data-testid="grpc-session-error-detail"
            style={{
              fontSize: 12,
              lineHeight: '20px',
              height: 20,
              color: token.colorError,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {lifecycle.endedMessage}
            {lifecycle.endedAdvice !== undefined && (
              <span data-testid="grpc-session-error-advice" style={{ color: token.colorTextSecondary }}>
                {` ${lifecycle.endedAdvice}`}
              </span>
            )}
          </div>
        </div>
      );
    case 'connected':
      // Expands to the received-metadata line — a jump to the
      // Metadata tab, or the honest "No metadata received." one.
      return (
        <div
          data-testid="grpc-timeline-connected-row"
          {...(connectedExpandable ? expandableProps(connectedExpanded, onToggleConnected) : {})}
          style={{ ...lifecycleRowStyle, ...(connectedExpandable ? { cursor: 'pointer' } : {}) }}
        >
          {lifecycleGlyph(<InfoCircleOutlined aria-hidden style={{ color: token.colorTextTertiary }} />)}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t('workbench.editors.grpc.timeline.responseReceived')}
          </span>
          {lifecycleTime(lifecycle.connectedAt)}
          {expandSlot(connectedExpandable ? connectedExpanded : null)}
        </div>
      );
    case 'connectedDetail':
      return (
        <div
          data-testid="grpc-timeline-connected-details"
          style={{
            height: CONNECTED_DETAIL_PX,
            boxSizing: 'border-box',
            padding: '6px 10px 6px 37px',
            borderBottom: STREAM_HAIRLINE,
            overflow: 'hidden',
          }}
        >
          {(responseMetadataCount ?? 0) > 0 ? (
            <ReceivedMetadataLine onShowMetadata={onShowMetadata} />
          ) : (
            <div style={{ fontSize: 12, lineHeight: '20px', height: 20, color: token.colorTextSecondary }}>
              {t('workbench.editors.grpc.timeline.noMetadataReceived')}
            </div>
          )}
        </div>
      );
    case 'ended': {
      if (lifecycle.endedBy === undefined) return null;
      // A pre-head failure — and a connection lost after the head —
      // reads as the red-iconed row with the PLAIN label; the
      // explanation lives behind the chevron (the sent row's
      // expansion anatomy).
      if (lifecycle.endedBy === 'error' || lifecycle.endedBy === 'lost') {
        return (
          <div
            data-testid="grpc-timeline-ended-row"
            {...(errorExpandable ? expandableProps(errorExpanded, onToggleError) : {})}
            style={{ ...lifecycleRowStyle, ...(errorExpandable ? { cursor: 'pointer' } : {}) }}
          >
            {lifecycleGlyph(
              lifecycle.endedBy === 'lost' ? (
                <DisconnectOutlined aria-hidden style={{ color: token.colorError }} />
              ) : (
                <CloseCircleOutlined aria-hidden style={{ color: token.colorError }} />
              ),
            )}
            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {endedRowText(lifecycle, t)}
            </span>
            {onTrustCertificate !== undefined && (
              <Button
                size="small"
                aria-pressed={trustOfferOpen}
                onClick={(event) => {
                  event.stopPropagation();
                  onTrustCertificate();
                }}
                onKeyDown={(event) => event.stopPropagation()}
                style={{ flexShrink: 0 }}
                data-testid="grpc-timeline-trust-certificate"
              >
                {t('workbench.editors.grpc.timeline.trustCertificate')}
              </Button>
            )}
            {lifecycleTime(lifecycle.endedAt)}
            {expandSlot(errorExpandable ? errorExpanded : null)}
          </div>
        );
      }
      return (
        <div data-testid="grpc-timeline-ended-row" style={lifecycleRowStyle}>
          {lifecycleGlyph(
            lifecycle.endedBy === 'complete' ? (
              <CheckCircleOutlined aria-hidden style={{ color: token.colorTextTertiary }} />
            ) : (
              <DisconnectOutlined aria-hidden style={{ color: token.colorTextTertiary }} />
            ),
          )}
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {endedRowText(lifecycle, t)}
          </span>
          {lifecycleTime(lifecycle.endedAt)}
          {expandSlot(null)}
        </div>
      );
    }
    case 'noMatches':
      return (
        <div style={lifecycleRowStyle}>
          <span>{t('workbench.editors.grpc.timeline.noMatches')}</span>
        </div>
      );
    case 'script': {
      // One hook ran — the hook, the levels that contributed and
      // the verdict; a failure names its error.
      const mark = scriptMarks[entry.index];
      if (mark === undefined) return null;
      return (
        <div className="oh-info-hover-host" data-testid="grpc-timeline-script-row" style={lifecycleRowStyle}>
          {lifecycleGlyph(
            <CodeOutlined aria-hidden style={{ color: mark.succeeded ? token.colorTextTertiary : token.colorError }} />,
          )}
          <span
            {...(mark.error !== undefined ? { title: mark.error.message } : {})}
            style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {scriptRowText(mark, t)}
          </span>
          {/* The hook's own (i) — the rail row's lifecycle card, the
              mark's hook line lit; revealed on hover so a chatty
              stream's marks stay a quiet column. */}
          <InfoTrigger className="oh-info-trigger--hover" content={scriptSlotInfo(mark.hook, t)} />
          {lifecycleTime(mark.atMs)}
          {expandSlot(null)}
        </div>
      );
    }
    case 'header':
      return (
        <GrpcTimelineGroupHeader
          group={entry.group}
          memberCount={entry.count}
          collapsed={entry.collapsed}
          chips={chips}
          groupRowLimit={groupRowLimit}
          unwindowed={unwindowedGroups.has(entry.group.key)}
          onToggle={onToggleGroup}
          onToggleWindow={onToggleGroupWindow}
          testId="grpc-timeline-group-header"
        />
      );
    case 'groupMore':
      return (
        <div
          role="button"
          tabIndex={0}
          className="oh-stream-row"
          data-testid="grpc-timeline-group-more"
          onClick={() => onToggleGroupWindow(entry.group.key)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggleGroupWindow(entry.group.key);
            }
          }}
          style={{ ...singleRowStyle, cursor: 'pointer', fontSize: 12, color: token.colorPrimary }}
        >
          {t('shared.timelineGroup.showOlder', { count: entry.hidden })}
        </div>
      );
    case 'row': {
      const item = items[entry.index];
      const up = item.direction === 'up';
      const chip = up ? chips.up : chips.down;
      const isExpanded = expanded.has(entry.index);
      const ts = timestamps?.[entry.index];
      const view = derive.viewOf(item);
      return (
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          className="oh-stream-row"
          data-testid="grpc-timeline-message-row"
          onClick={() => onToggleRow(entry.index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggleRow(entry.index);
            }
          }}
          style={{ ...singleRowStyle, cursor: 'pointer' }}
        >
          {directionBadge(up)}
          {showTypes && chipTag(chip, 'grpc-timeline-message-badge')}
          <span
            style={{
              ...cellFont,
              color: token.colorTextSecondary,
              flex: 1,
              minWidth: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              ...(view.kind === 'compressed' ? { fontStyle: 'italic', color: token.colorTextTertiary } : {}),
            }}
          >
            {view.kind === 'compressed' ? t('workbench.editors.grpc.response.compressed') : derive.previewOf(item)}
          </span>
          {ts !== undefined && (
            <span
              data-testid="grpc-timeline-message-time"
              style={{ ...cellFont, fontSize: 11, color: token.colorTextTertiary, flexShrink: 0 }}
            >
              {formatMessageTime(ts)}
            </span>
          )}
          {expandSlot(isExpanded)}
        </div>
      );
    }
    case 'viewer': {
      const item = items[entry.index];
      const view = derive.viewOf(item);
      // A decoded frame reads as JSON; the raw and compressed frames
      // have only their bytes — they open on the Hexdump, the text
      // views read the base64.
      const decoded = view.kind === 'schema' || view.kind === 'structural';
      const text = decoded ? view.text : view.kind === 'raw' ? view.base64 : '';
      return (
        <TimelineMessageViewer
          text={text}
          defaultFormat={decoded ? 'json' : 'text'}
          hexDump={() => derive.hexOf(item)}
          base64={() => (item.secret === true ? text : item.dataBase64)}
          mode={viewerModes.modeOf(entry.index, !decoded)}
          onModeChange={(mode) => viewerModes.setMode(entry.index, mode)}
          wrapLines={wrapLines}
          onWrapLinesChange={onWrapLinesChange}
          actionsRef={viewerModes.actionsOf(entry.index)}
          testIdPrefix="grpc-timeline"
        />
      );
    }
    default: {
      const _exhaustive: never = entry;
      void _exhaustive;
      return null;
    }
  }
};

export default GrpcTimelineEntryRow;
