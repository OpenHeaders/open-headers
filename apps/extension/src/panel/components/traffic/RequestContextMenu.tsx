/**
 * Right-click menu on a traffic list row.
 *
 * Mirrors the Chrome DevTools Network tab's row menu:
 *
 *   - Open in new tab
 *   - Copy > ... (per-row and bulk variants)
 *   - Block request URL (creates a block-rule draft)
 *   - Save as HAR (single request)
 *
 * The menu closes on outside click or Esc via the shared close-on-
 * outside pattern. Clipboard operations go through `navigator.clipboard`
 * and fall back to `document.execCommand('copy')` on failure for hosts
 * where the clipboard API is gated (historically some dev env iframes).
 */

import { useEffect, useRef, useState } from 'react';
import { formatCurl, formatFetch, formatRequestHeaders, formatResponseHeaders } from '../../data/request-formatters';
import { handOffRuleDraft } from '../../data/rule-draft-bridge';
import type { InspectorRequest } from '../../data/types';

export interface RequestContextMenuState {
  x: number;
  y: number;
  requestId: string;
}

interface RequestContextMenuProps {
  state: RequestContextMenuState;
  request: InspectorRequest;
  allEntries: readonly InspectorRequest[];
  onClose: () => void;
  onSaveAsHar: (entry: InspectorRequest) => void;
  onSaveAllAsHar: () => void;
  onCopyAllAsHar: () => void;
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall through to legacy path below.
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    ta.remove();
  }
}

async function blockRequest(request: InspectorRequest, scope: 'url' | 'domain'): Promise<void> {
  let url = request.url;
  if (scope === 'domain') {
    try {
      const u = new URL(request.url);
      url = `${u.protocol}//${u.hostname}/*`;
    } catch {
      // Fall back to raw URL.
    }
  }
  await handOffRuleDraft({
    type: 'block',
    url,
  });
}

export function RequestContextMenu({
  state,
  request,
  allEntries,
  onClose,
  onSaveAsHar,
  onSaveAllAsHar,
  onCopyAllAsHar,
}: RequestContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const item = (label: string, action: () => void | Promise<void>, disabled = false) => (
    <button
      type="button"
      className={`dt-ctx-item${disabled ? ' disabled' : ''}`}
      onClick={() => {
        if (disabled) return;
        void Promise.resolve(action()).finally(() => onClose());
      }}
      disabled={disabled}
    >
      {label}
    </button>
  );

  const openInNewTab = () => {
    try {
      window.open(request.url, '_blank', 'noopener,noreferrer');
    } catch {
      // window.open may be blocked inside some DevTools contexts.
    }
  };

  const responseBody = request.responseBody ?? '';
  const allUrls = allEntries.map((e) => e.url).join('\n');
  const allCurls = allEntries.map((e) => formatCurl(e)).join('\n\n');

  return (
    <div ref={menuRef} className="dt-ctx-menu" style={{ left: state.x, top: state.y }}>
      {item('Open in new tab', openInNewTab)}
      <div className="dt-ctx-sep" />
      {/* Copy submenu */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover submenu */}
      <div
        className="dt-ctx-item dt-ctx-sub"
        onMouseEnter={() => setCopyOpen(true)}
        onMouseLeave={() => setCopyOpen(false)}
      >
        Copy {'\u25B8'}
        {copyOpen && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {item('Copy URL', () => copyText(request.url))}
            {item('Copy as cURL', () => copyText(formatCurl(request)))}
            {item('Copy as fetch', () => copyText(formatFetch(request)))}
            {item('Copy request headers', () => copyText(formatRequestHeaders(request)))}
            {item('Copy response headers', () => copyText(formatResponseHeaders(request)))}
            {item('Copy response', () => copyText(responseBody), responseBody.length === 0)}
            <div className="dt-ctx-sep" />
            {item('Copy all URLs', () => copyText(allUrls), allEntries.length === 0)}
            {item('Copy all as cURL', () => copyText(allCurls), allEntries.length === 0)}
            {item('Copy all as HAR', onCopyAllAsHar, allEntries.length === 0)}
          </div>
        )}
      </div>
      {/* Block requests submenu */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover submenu */}
      <div
        className="dt-ctx-item dt-ctx-sub"
        onMouseEnter={() => setBlockOpen(true)}
        onMouseLeave={() => setBlockOpen(false)}
      >
        Block requests {'\u25B8'}
        {blockOpen && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {item('Block request URL', () => blockRequest(request, 'url'))}
            {item('Block request domain', () => blockRequest(request, 'domain'))}
          </div>
        )}
      </div>
      <div className="dt-ctx-sep" />
      {/* Save as submenu */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover submenu */}
      <div
        className="dt-ctx-item dt-ctx-sub"
        onMouseEnter={() => setSaveOpen(true)}
        onMouseLeave={() => setSaveOpen(false)}
      >
        Save as... {'\u25B8'}
        {saveOpen && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {item('Save this as HAR', () => onSaveAsHar(request))}
            {item('Save all as HAR', onSaveAllAsHar, allEntries.length === 0)}
          </div>
        )}
      </div>
    </div>
  );
}
