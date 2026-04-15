/**
 * Pre-mount theme initializer.
 *
 * Loaded as a classic (non-module) script in popup.html / workspace.html
 * BEFORE the React bundle so it runs during HTML parsing — beating the
 * first paint. Reads `oh:theme` from localStorage (mirrored by
 * ThemeContext) and sets `data-theme`, `color-scheme`, and a background
 * color on the document element. Without this step the first frame
 * always paints light, and users who run in dark mode see a white flash
 * every time a popup/workspace opens.
 *
 * localStorage is used instead of chrome.storage because the latter is
 * async — by the time its callback fires, the page has already painted.
 * ThemeContext keeps the two in sync.
 *
 * Written as hand-authored JS (not TS) so it can be copied verbatim to
 * the extension bundle without module wrapping, which would turn it
 * into a deferred script that runs too late.
 */
(function () {
  try {
    var raw = localStorage.getItem('oh:theme');
    var mode = raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'auto';
    var resolved =
      mode === 'auto'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : mode;
    var root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.style.colorScheme = resolved;
    root.style.backgroundColor = resolved === 'dark' ? '#000' : '#fff';
  } catch (_) {
    // localStorage disabled or matchMedia unavailable — fall through to
    // the post-mount React path, which will apply the real theme once
    // settings load. The first paint may flash but nothing breaks.
  }
})();
