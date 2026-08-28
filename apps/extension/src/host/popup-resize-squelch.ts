/**
 * Popup resize squelch — drops `resize` events whose viewport did not
 * change.
 *
 * Chrome's action popup re-reports its preferred content size after
 * layout and the browser answers with a widget resize, so the popup
 * document receives a `window` `resize` on ordinary hover — dozens per
 * second while a dropdown is open — even though the viewport stays at
 * its fixed 800×600. Every mounted popup (dropdown, tooltip, popover)
 * realigns on `resize` with a run of forced synchronous layouts, which
 * is what made hover inside the popup lag behind the side panel.
 *
 * A capturing listener registered before any other sees the event
 * first; when the inner size matches the last observed one the event
 * carries no information and is stopped before the aligners run. A
 * real size change passes through untouched.
 */

export function installPopupResizeSquelch(win: Window): () => void {
  let lastWidth = win.innerWidth;
  let lastHeight = win.innerHeight;
  const onResize = (event: Event): void => {
    const { innerWidth, innerHeight } = win;
    if (innerWidth === lastWidth && innerHeight === lastHeight) {
      event.stopImmediatePropagation();
      return;
    }
    lastWidth = innerWidth;
    lastHeight = innerHeight;
  };
  win.addEventListener('resize', onResize, { capture: true });
  return () => win.removeEventListener('resize', onResize, { capture: true });
}
