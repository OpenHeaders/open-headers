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

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { handOffApiRequestSeed } from '../../data/api-request-handoff';
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

/**
 * Hover-opened submenu row. The flyout reuses the scrollable context-menu
 * pattern (the column-visibility menu's outer scrollhost + inner scroll
 * region): its height is capped to the viewport room below the row,
 * measured at open — the `100vh` term keeps the cap live across DevTools
 * window resizes — so a long list (Copy) grows an inner scrollbar instead
 * of running off-screen. The submenu opens 4px above the row (see
 * `.dt-ctx-submenu`), hence the offset in the cap.
 */
function SubmenuRow({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(0);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover submenu
    <div
      className="dt-ctx-item dt-ctx-sub"
      onMouseEnter={(e) => {
        setTop(e.currentTarget.getBoundingClientRect().top);
        setOpen(true);
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {label} {'▸'}
      {open && (
        <div className="dt-ctx-menu dt-ctx-submenu dt-ctx-menu--scrollhost">
          <div
            className="dt-ctx-menu-scroll"
            style={{ maxHeight: `calc(100vh - ${top - 4}px - 8px)`, overflowY: 'auto', overscrollBehavior: 'none' }}
          >
            {children}
          </div>
        </div>
      )}
    </div>
  );
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
  const t = useT();
  const menuRef = useRef<HTMLDivElement>(null);

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
      {item(t('panel.requestMenu.openInNewTab'), openInNewTab)}
      {item(t('panel.requestMenu.createApiRequest'), () => handOffApiRequestSeed(lc))}
      <div className="dt-ctx-sep" />
      <SubmenuRow label={t('panel.requestMenu.copy')}>
        {item(t('panel.requestMenu.copyUrl'), () => copyText(lc.url))}
        {item(t('panel.requestMenu.copyAsCurl'), () => copyText(formatCurl(lc)))}
        {item(t('panel.requestMenu.copyAsFetch'), () => copyText(formatFetch(lc)))}
        {item(t('panel.requestMenu.copyRequestHeaders'), () => copyText(formatRequestHeaders(lc)))}
        {item(t('panel.requestMenu.copyResponseHeaders'), () => copyText(formatResponseHeaders(lc)))}
        {item(t('panel.requestMenu.copyResponse'), () => copyText(responseBody), responseBody.length === 0)}
        {item(t('panel.requestMenu.copyAsHar'), () => onCopyAsHar(row, false))}
        {item(t('panel.requestMenu.copyAsHarSanitized'), () => onCopyAsHar(row, true))}
        <div className="dt-ctx-sep" />
        {item(t('panel.requestMenu.copyAllUrls'), () => copyText(allUrls), allRows.length === 0)}
        {item(t('panel.requestMenu.copyAllAsCurl'), () => copyText(allCurls), allRows.length === 0)}
        {item(t('panel.requestMenu.copyAllAsHar'), () => onCopyAllAsHar(false), allRows.length === 0)}
        {item(t('panel.requestMenu.copyAllAsHarSanitized'), () => onCopyAllAsHar(true), allRows.length === 0)}
      </SubmenuRow>
      <SubmenuRow label={t('panel.requestMenu.blockRequests')}>
        {item(t('panel.requestMenu.blockUrl'), () => blockRequest(lc.url, 'url'))}
        {item(t('panel.requestMenu.blockDomain'), () => blockRequest(lc.url, 'domain'))}
      </SubmenuRow>
      <div className="dt-ctx-sep" />
      <SubmenuRow label={t('panel.requestMenu.saveAs')}>
        {item(t('panel.requestMenu.saveThisAsHar'), () => onSaveAsHar(row, false))}
        {item(t('panel.requestMenu.saveThisAsHarSanitized'), () => onSaveAsHar(row, true))}
        {item(t('panel.requestMenu.saveAllAsHar'), () => onSaveAllAsHar(false), allRows.length === 0)}
        {item(t('panel.requestMenu.saveAllAsHarSanitized'), () => onSaveAllAsHar(true), allRows.length === 0)}
      </SubmenuRow>
    </div>
  );
}
