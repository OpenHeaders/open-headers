/**
 * Bottom toolbar for the text-body viewer. Owns the pretty-print
 * toggle, the sniffer "parse as X / revert" pill, and a cursor-info
 * readout. Binary-mode selection lives in a different toolbar
 * (`ResponseViewerToolbar`) because those controls are specific to
 * response bodies.
 */

import type { DetectedFormat } from '../../data/content-sniff';
import { detectedFormatLabel } from '../../data/content-sniff';

interface TextBodyToolbarProps {
  prettyPrint?: boolean;
  onTogglePrettyPrint?: () => void;
  lineInfo?: string;
  suggestedFormat?: DetectedFormat | null;
  override?: DetectedFormat | null;
  onApplyOverride?: (format: DetectedFormat) => void;
  onClearOverride?: () => void;
}

export default function TextBodyToolbar({
  prettyPrint,
  onTogglePrettyPrint,
  lineInfo,
  suggestedFormat,
  override,
  onApplyOverride,
  onClearOverride,
}: TextBodyToolbarProps) {
  return (
    <div className="dt-response-toolbar">
      <div className="dt-response-toolbar-left">
        {onTogglePrettyPrint && (
          <button
            type="button"
            className={`dt-response-toolbar-btn ${prettyPrint ? 'active' : ''}`}
            onClick={onTogglePrettyPrint}
            title="Pretty print"
          >
            {'{ }'}
          </button>
        )}
        {override && onClearOverride ? (
          <button
            type="button"
            className="dt-response-toolbar-btn dt-response-toolbar-btn--override-active"
            onClick={onClearOverride}
            title="Revert to declared Content-Type"
          >
            Parsed as {detectedFormatLabel(override)} · revert
          </button>
        ) : suggestedFormat && onApplyOverride ? (
          <button
            type="button"
            className="dt-response-toolbar-btn dt-response-toolbar-btn--suggest"
            onClick={() => onApplyOverride(suggestedFormat)}
            title={`Content-Type looks off — the body parses as ${detectedFormatLabel(suggestedFormat)}. Click to reinterpret.`}
          >
            Looks like {detectedFormatLabel(suggestedFormat)} · parse
          </button>
        ) : null}
        {lineInfo && <span className="dt-response-toolbar-info">{lineInfo}</span>}
      </div>
    </div>
  );
}
