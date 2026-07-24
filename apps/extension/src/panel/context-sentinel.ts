/**
 * Extension-context sentinel for the DevTools panel.
 *
 * When the extension is reloaded or updated while DevTools is open,
 * Chrome sometimes leaves the panel document alive but orphaned: DOM
 * and plain JS keep running, while the extension context is
 * invalidated — `chrome.runtime.id` reads `undefined` and every
 * `chrome.*` call throws. React keeps whatever was last painted (or a
 * white frame), with no signal to the user about what happened or how
 * to recover.
 *
 * This sentinel polls `chrome.runtime.id` on a slow interval and, the
 * moment the context dies, replaces the document body with a static
 * explanation ("close and reopen DevTools"). Everything the overlay
 * needs — translator, locale, styles — is captured from in-memory
 * state; past the trigger no `chrome.*` surface is touched, which is
 * the one constraint an invalidated document imposes.
 *
 * The update-deferral host on the SW side makes this rare for store
 * updates (they wait for the last DevTools session to close); this
 * covers what deferral cannot: manual reloads from the extensions page
 * and the dev workflow.
 */

import { getTranslator, resolveLocale } from '@openheaders/i18n';
import { get as getSetting } from '@openheaders/ui/workbench/settings/store';

const POLL_MS = 3_000;

function contextAlive(): boolean {
  try {
    return typeof chrome !== 'undefined' && typeof chrome.runtime?.id === 'string';
  } catch {
    return false;
  }
}

function renderInvalidatedNotice(): void {
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  const t = getTranslator(resolveLocale(getSetting('general.language'), navigator.languages));

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:8px',
    'padding:24px',
    'text-align:center',
    `background:${dark ? '#1f1f1f' : '#ffffff'}`,
    `color:${dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.88)'}`,
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
  ].join(';');

  const title = document.createElement('div');
  title.style.cssText = 'font-size:15px;font-weight:600';
  title.textContent = t('shared.contextInvalidated.title');

  const body = document.createElement('div');
  body.style.cssText = `font-size:13px;color:${dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)'}`;
  body.textContent = t('shared.contextInvalidated.body');

  overlay.appendChild(title);
  overlay.appendChild(body);
  document.body.replaceChildren(overlay);
}

/**
 * Start the sentinel. Returns a stop handle (tests; the panel document
 * itself never stops it — the document's death is the stop).
 */
export function startContextSentinel(): () => void {
  const timer = setInterval(() => {
    if (contextAlive()) return;
    clearInterval(timer);
    renderInvalidatedNotice();
  }, POLL_MS);
  return () => clearInterval(timer);
}
