type ViewMode = 'utf8' | 'hex' | 'base64';

interface ResponseViewerToolbarProps {
  /** For binary content — Base64 / Hex / UTF-8 selector */
  mode?: ViewMode;
  onModeChange?: (mode: ViewMode) => void;
  /** For text content — pretty print toggle */
  prettyPrint?: boolean;
  onTogglePrettyPrint?: () => void;
  lineInfo?: string;
}

export type { ViewMode };

export default function ResponseViewerToolbar({
  mode,
  onModeChange,
  prettyPrint,
  onTogglePrettyPrint,
  lineInfo,
}: ResponseViewerToolbarProps) {
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
        {lineInfo && <span className="dt-response-toolbar-info">{lineInfo}</span>}
      </div>
      {onModeChange && mode && (
        <div className="dt-response-toolbar-modes">
          <button
            type="button"
            className={`dt-response-toolbar-btn ${mode === 'base64' ? 'active' : ''}`}
            onClick={() => onModeChange('base64')}
          >
            Base64
          </button>
          <button
            type="button"
            className={`dt-response-toolbar-btn ${mode === 'hex' ? 'active' : ''}`}
            onClick={() => onModeChange('hex')}
          >
            Hex Viewer
          </button>
          <button
            type="button"
            className={`dt-response-toolbar-btn ${mode === 'utf8' ? 'active' : ''}`}
            onClick={() => onModeChange('utf8')}
          >
            UTF-8
          </button>
        </div>
      )}
    </div>
  );
}
