/**
 * Toolbar for the binary-mode response viewer — Base64 / Hex / UTF-8
 * selector only. Text bodies use `TextBodyToolbar` instead, so this
 * file no longer needs to juggle pretty-print or sniffer state.
 */

type ViewMode = 'utf8' | 'hex' | 'base64';

interface ResponseViewerToolbarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  /** Extra controls rendered after the mode buttons (e.g. a copy action). */
  trailing?: React.ReactNode;
}

export type { ViewMode };

export default function ResponseViewerToolbar({ mode, onModeChange, trailing }: ResponseViewerToolbarProps) {
  return (
    <div className="dt-response-toolbar">
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
      {trailing}
    </div>
  );
}
