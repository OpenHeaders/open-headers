/**
 * Delay Page — the landing page for the standalone main_frame/sub_frame delay path.
 *
 * Flow:
 *   1. DNR redirect rule rewrites a main_frame navigation to
 *      chrome-extension://<id>/delay.html?ms=<ms>#<encoded-target-url>
 *   2. This script reads the duration and target from URL, shows a branded
 *      countdown, waits, then asks the background to temporarily suppress the
 *      delay rule for this tab and navigates to the real target.
 *   3. Background clears the suppression on webNavigation.onCommitted so the
 *      next navigation in the same tab triggers the delay again.
 *
 * The target URL is passed in the URL fragment (`#<target>`) because Chrome
 * DNR `regexSubstitution` copies the matched URL verbatim into the redirect
 * target — embedding it as a query param would corrupt our own `?ms=` parsing
 * when the target contained `?` or `&`. Fragments are preserved literally by
 * browsers and never sent to servers, so they are the safest carrier.
 *
 * ── Chrome Bounce Tracking Mitigations (DIPS/BTM) notice ───────────────
 *
 * Chrome's bounce-tracking heuristic flags this page in DevTools with:
 *   "Chrome may soon delete state for intermediate websites in a recent
 *    navigation chain … 1 potentially tracking website: <extension-id>"
 * because the delay chain (site → delay.html → site) passes through
 * delay.html without any real user input (the countdown is passive; a
 * synthetic user activation can't be forged — `navigator.userActivation`
 * is read-only by design).
 *
 * The warning is benign for this extension:
 *   - delay.html stores nothing: no cookies, localStorage, sessionStorage,
 *     IndexedDB, or cache. Every run parses config from the URL and exits.
 *   - Chrome's BrowsingDataRemover (the API BTM calls to execute a wipe)
 *     does not act on `chrome-extension://` origins — extension storage is
 *     under the extension permission model, not the web data store.
 *   - chrome.storage.local / chrome.storage.sync (rule store, settings,
 *     shadow-detection flag, etc.) are untouched even in the worst case.
 *
 * Net effect of the heuristic firing: a DevTools notice, and nothing else.
 * If you're here because you saw that warning and wondered whether the
 * audit missed something — it didn't. Leave this as-is.
 */

import { call } from '@utils/bridge';

interface DelayConfig {
  ms: number;
  target: string;
}

function parseConfig(): DelayConfig | null {
  const params = new URLSearchParams(window.location.search);
  const msRaw = params.get('ms');
  const ms = msRaw ? parseInt(msRaw, 10) : Number.NaN;
  const target = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '';
  if (!Number.isFinite(ms) || ms < 0 || !target) return null;
  try {
    // Only allow http(s) to avoid open-redirect style abuse via a crafted URL
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  } catch {
    return null;
  }
  return { ms, target };
}

function formatSeconds(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  return seconds % 1 === 0 ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

function render(cfg: DelayConfig | null): void {
  const root = document.getElementById('root');
  if (!root) return;

  if (!cfg) {
    root.innerHTML =
      '<div class="oh-wrap"><div class="oh-card"><h1>Open Headers</h1><p class="oh-error">Invalid delay parameters.</p></div></div>';
    applyStyles();
    return;
  }

  const totalLabel = formatSeconds(cfg.ms);
  root.innerHTML = `
    <div class="oh-wrap">
      <div class="oh-card">
        <div class="oh-brand">Open Headers</div>
        <div class="oh-title">Delaying request</div>
        <div class="oh-url" title="${escapeHtml(cfg.target)}">${escapeHtml(cfg.target)}</div>
        <div class="oh-progress"><div class="oh-progress-bar" id="oh-bar"></div></div>
        <div class="oh-countdown"><span id="oh-remaining">${totalLabel}</span> remaining</div>
        <div class="oh-hint">The browser is paused by an Open Headers delay rule.</div>
      </div>
    </div>
  `;
  applyStyles();
}

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

function applyStyles(): void {
  if (document.getElementById('oh-delay-styles')) return;
  const style = document.createElement('style');
  style.id = 'oh-delay-styles';
  style.textContent = `
    :root { color-scheme: light dark; }
    html, body { margin: 0; padding: 0; height: 100%; background: #f5f6f8; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; color: #1f2328; }
    @media (prefers-color-scheme: dark) { html, body { background: #141518; color: #e6e8eb; } }
    .oh-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .oh-card { width: 100%; max-width: 480px; background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08); border: 1px solid rgba(0,0,0,0.06); }
    @media (prefers-color-scheme: dark) { .oh-card { background: #1c1e22; border-color: rgba(255,255,255,0.08); box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(0,0,0,0.4); } }
    .oh-brand { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #8a94a6; margin-bottom: 8px; }
    .oh-title { font-size: 20px; font-weight: 600; margin-bottom: 16px; }
    .oh-url { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace; font-size: 13px; background: #f5f6f8; padding: 10px 12px; border-radius: 6px; word-break: break-all; margin-bottom: 20px; color: #4a5565; border: 1px solid rgba(0,0,0,0.04); }
    @media (prefers-color-scheme: dark) { .oh-url { background: #0f1114; color: #a6b0c0; border-color: rgba(255,255,255,0.06); } }
    .oh-progress { height: 4px; background: rgba(0,0,0,0.06); border-radius: 999px; overflow: hidden; margin-bottom: 10px; }
    @media (prefers-color-scheme: dark) { .oh-progress { background: rgba(255,255,255,0.08); } }
    .oh-progress-bar { height: 100%; width: 0%; background: #3b82f6; border-radius: 999px; transition: width linear; }
    .oh-countdown { font-size: 13px; color: #4a5565; margin-bottom: 12px; font-variant-numeric: tabular-nums; }
    @media (prefers-color-scheme: dark) { .oh-countdown { color: #a6b0c0; } }
    .oh-hint { font-size: 12px; color: #8a94a6; }
    .oh-error { color: #dc2626; font-size: 14px; }
  `;
  document.head.appendChild(style);
}

function startCountdown(cfg: DelayConfig): void {
  const bar = document.getElementById('oh-bar') as HTMLDivElement | null;
  const remaining = document.getElementById('oh-remaining');
  if (!bar || !remaining) return;

  const start = performance.now();
  bar.style.transition = `width ${cfg.ms}ms linear`;
  // Kick off width animation on next frame so the transition actually runs
  requestAnimationFrame(() => {
    bar.style.width = '100%';
  });

  const tick = (): void => {
    const elapsed = performance.now() - start;
    const left = Math.max(0, cfg.ms - elapsed);
    remaining.textContent = formatSeconds(Math.ceil(left / 100) * 100);
    if (left > 0) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

async function run(): Promise<void> {
  const cfg = parseConfig();
  render(cfg);
  if (!cfg) return;

  startCountdown(cfg);

  await new Promise<void>((resolve) => setTimeout(resolve, cfg.ms));

  // Ask the background to suppress the delay rule for this tab so our
  // navigation to the real target doesn't loop back into the same delay.
  // The ruleUid is passed along so the background can record a scriptable
  // fire for the delay rule against the destination page — without this,
  // the popup's "matched Nx" counter would show 0 for main-frame delays
  // because the scriptable XHR/fetch monkey-patch never sees them.
  try {
    await call('oh-delay-bypass', { target: cfg.target });
  } catch {
    /* background not ready — fall through and navigate anyway; loop will
       be rate-limited by Chrome's DNR redirect-chain cap */
  }

  window.location.replace(cfg.target);
}

void run();
