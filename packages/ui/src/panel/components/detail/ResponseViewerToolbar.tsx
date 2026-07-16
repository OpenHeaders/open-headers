/**
 * Toolbar for the binary-mode response viewer — Base64 / Hex / UTF-8
 * selector only. Text bodies use `TextBodyToolbar` instead, so this
 * file no longer needs to juggle pretty-print or sniffer state.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';

type ViewMode = 'utf8' | 'hex' | 'base64';

interface ResponseViewerToolbarProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  /** Trailing action(s) after the mode buttons, behind a divider (e.g. an
   *  override CTA). The row stays left-aligned. */
  action?: React.ReactNode;
  /** Extra controls rendered at the far right (e.g. a copy action). */
  trailing?: React.ReactNode;
}

export type { ViewMode };

export default function ResponseViewerToolbar({ mode, onModeChange, action, trailing }: ResponseViewerToolbarProps) {
  const t = useT();
  return (
    <div className="dt-response-toolbar">
      <div className="dt-response-toolbar-left">
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
            {t('panel.inspector.viewer.hexViewer')}
          </button>
          <button
            type="button"
            className={`dt-response-toolbar-btn ${mode === 'utf8' ? 'active' : ''}`}
            onClick={() => onModeChange('utf8')}
          >
            UTF-8
          </button>
        </div>
        {action && (
          <>
            <span className="dt-toolbar-divider" aria-hidden="true" />
            {action}
          </>
        )}
      </div>
      {trailing}
    </div>
  );
}
