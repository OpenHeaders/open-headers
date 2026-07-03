/**
 * Right-click menu on a traffic list row.
 *
 * Mirrors the native network row menu pattern:
 *
 *   - Open in new tab
 *   - Copy > ... (per-row and bulk variants)
 *   - Block request URL (creates a block-rule draft)
 *   - Save as HAR (single request)
 *
 * The menu closes on outside click or Esc via the shared close-on-
 * outside pattern. Clipboard operations go through `navigator.clipboard`
 * and fall back to `document.execCommand('copy')` on failure for hosts
 * where the clipboard API is gated.
 */

import { useEffect, useRef, useState } from 'react';
import { currentResponseBody, type InspectorRowWithFires } from '../../data/inspector-row-projection';
import { formatCurl, formatFetch, formatRequestHeaders, formatResponseHeaders } from '../../data/request-formatters';
import { handOffRuleDraft } from '../../data/rule-create/rule-draft-bridge';

export interface RequestContextMenuState {
  x: number;
  y: number;
  requestId: string;
}

interface RequestContextMenuProps {
  state: RequestContextMenuState;
  row: InspectorRowWithFires;
  allRows: readonly InspectorRowWithFires[];
  onClose: () => void;
  onCopyAsHar: (row: InspectorRowWithFires, sanitize?: boolean) => void;
  onSaveAsHar: (row: InspectorRowWithFires, sanitize?: boolean) => void;
  onSaveAllAsHar: (sanitize?: boolean) => void;
  onCopyAllAsHar: (sanitize?: boolean) => void;
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

async function blockRequest(url: string, scope: 'url' | 'domain'): Promise<void> {
  let pattern = url;
  if (scope === 'domain') {
    try {
      const u = new URL(url);
      pattern = `${u.protocol}//${u.hostname}/*`;
    } catch {
      // Fall back to raw URL.
    }
  }
  await handOffRuleDraft({
    type: 'block',
    url: pattern,
  });
}

export function RequestContextMenu({
  state,
  row,
  allRows,
  onClose,
  onCopyAsHar,
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

  const lc = row.lifecycle;
  const openInNewTab = () => {
    try {
      window.open(lc.url, '_blank', 'noopener,noreferrer');
    } catch {
      // window.open may be blocked inside some DevTools contexts.
    }
  };

  const responseBody = currentResponseBody(lc)?.content ?? '';
  const allUrls = allRows.map((r) => r.lifecycle.url).join('\n');
  const allCurls = allRows.map((r) => formatCurl(r.lifecycle)).join('\n\n');

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
        Copy {'▸'}
        {copyOpen && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {item('Copy URL', () => copyText(lc.url))}
            {item('Copy as cURL', () => copyText(formatCurl(lc)))}
            {item('Copy as fetch', () => copyText(formatFetch(lc)))}
            {item('Copy request headers', () => copyText(formatRequestHeaders(lc)))}
            {item('Copy response headers', () => copyText(formatResponseHeaders(lc)))}
            {item('Copy response', () => copyText(responseBody), responseBody.length === 0)}
            {item('Copy as HAR', () => onCopyAsHar(row, false))}
            {item('Copy as HAR (sanitized)', () => onCopyAsHar(row, true))}
            <div className="dt-ctx-sep" />
            {item('Copy all URLs', () => copyText(allUrls), allRows.length === 0)}
            {item('Copy all as cURL', () => copyText(allCurls), allRows.length === 0)}
            {item('Copy all as HAR', () => onCopyAllAsHar(false), allRows.length === 0)}
            {item('Copy all as HAR (sanitized)', () => onCopyAllAsHar(true), allRows.length === 0)}
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
        Block requests {'▸'}
        {blockOpen && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {item('Block request URL', () => blockRequest(lc.url, 'url'))}
            {item('Block request domain', () => blockRequest(lc.url, 'domain'))}
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
        Save as... {'▸'}
        {saveOpen && (
          <div className="dt-ctx-menu dt-ctx-submenu">
            {item('Save this as HAR', () => onSaveAsHar(row, false))}
            {item('Save this as HAR (sanitized)', () => onSaveAsHar(row, true))}
            {item('Save all as HAR', () => onSaveAllAsHar(false), allRows.length === 0)}
            {item('Save all as HAR (sanitized)', () => onSaveAllAsHar(true), allRows.length === 0)}
          </div>
        )}
      </div>
    </div>
  );
}
