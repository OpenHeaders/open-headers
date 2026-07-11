/**
 * Full-screen transition overlay for the web tab's boot / sign-in /
 * sign-out moments — a spinner over a theme-matched backdrop so those
 * async gaps never show a frozen, static screen.
 *
 * Framework-free (plain DOM) on purpose: it must paint the instant a
 * gesture fires — before React re-renders — and it has to survive a
 * full-page reload teardown (the sign-out path clears state and
 * navigates). Singleton: repeated shows update the label in place; hide
 * removes it. The backdrop is opaque so it fully masks whatever static
 * frame sits underneath.
 *
 * Theme comes from the `data-theme` the pre-mount initializer stamps on
 * `<html>` (see `public/js/theme-init.js`), so the overlay matches
 * light/dark with no flash even before the React theme applies.
 */

const OVERLAY_ID = 'oh-transition-overlay';
const STYLE_ID = 'oh-transition-overlay-style';
const BRAND = '#5890FF';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@keyframes oh-txo-spin { to { transform: rotate(360deg); } }
@keyframes oh-txo-fade { from { opacity: 0; } to { opacity: 1; } }
#${OVERLAY_ID} {
  position: fixed; inset: 0; z-index: 2147483000;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px;
  animation: oh-txo-fade 120ms ease-out;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#${OVERLAY_ID} .oh-txo-spinner {
  width: 34px; height: 34px; border-radius: 50%;
  border: 3px solid transparent; border-top-color: ${BRAND}; border-right-color: ${BRAND};
  animation: oh-txo-spin 0.7s linear infinite;
}
#${OVERLAY_ID} .oh-txo-label { font-size: 13px; letter-spacing: 0.01em; }
`;
  document.head.appendChild(style);
}

function themeColors(): { bg: string; fg: string } {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return dark ? { bg: '#141414', fg: 'rgba(255, 255, 255, 0.65)' } : { bg: '#ffffff', fg: 'rgba(0, 0, 0, 0.55)' };
}

/** Show (or re-label) the overlay. Idempotent — one element ever. */
export function showTransitionOverlay(message?: string): void {
  ensureStyle();
  const { bg, fg } = themeColors();
  let el = document.getElementById(OVERLAY_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    const spinner = document.createElement('div');
    spinner.className = 'oh-txo-spinner';
    const label = document.createElement('div');
    label.className = 'oh-txo-label';
    el.append(spinner, label);
    document.body.appendChild(el);
  }
  el.style.backgroundColor = bg;
  const label = el.querySelector<HTMLElement>('.oh-txo-label');
  if (label) {
    label.style.color = fg;
    label.textContent = message ?? '';
    label.style.display = message ? '' : 'none';
  }
}

/** Remove the overlay if present. */
export function hideTransitionOverlay(): void {
  document.getElementById(OVERLAY_ID)?.remove();
}
