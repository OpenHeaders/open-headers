/**
 * Monaco context-menu icon injector.
 *
 * Monaco renders the editor context menu inside an OPEN shadow root
 * (`.shadow-root-host` appended to the editor's DOM node on first
 * open), so page stylesheets can't decorate menu entries and
 * `addAction()` has no icon API. This watches the editor's DOM node
 * for the shadow host and appends one `<style>` into its shadow root —
 * the package icon rides on the entry's aria-label, in `currentColor`
 * via mask so it follows the menu theme.
 *
 * The observer lives exactly as long as the editor's DOM node; no
 * explicit teardown needed beyond garbage collection.
 */

import type * as monaco from 'monaco-editor';

const PACKAGE_ICON_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='black' stroke-width='1.3'%3E%3Cpath d='M8 1.5 14 4.75v6.5L8 14.5 2 11.25v-6.5L8 1.5z'/%3E%3Cpath d='M2 4.75 8 8l6-3.25M8 8v6.5'/%3E%3C/svg%3E")`;

const MENU_ICON_CSS = `
.monaco-menu .action-label[aria-label^='Save to Package Library']::before {
  content: '';
  display: inline-block;
  width: 13px;
  height: 13px;
  margin-right: 6px;
  vertical-align: -1px;
  background-color: currentColor;
  mask: ${PACKAGE_ICON_SVG} no-repeat center / contain;
  -webkit-mask: ${PACKAGE_ICON_SVG} no-repeat center / contain;
}
`;

function injectInto(host: Element): void {
  const root = host.shadowRoot;
  if (!root || root.querySelector('style[data-oh-menu-icons]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-oh-menu-icons', '');
  style.textContent = MENU_ICON_CSS;
  root.appendChild(style);
}

/** Watch the editor's DOM node for Monaco's context-view shadow host
 *  and style our custom menu entries inside it. */
export function installMenuIconInjector(editor: monaco.editor.IStandaloneCodeEditor): void {
  const node = editor.getDomNode();
  if (!node) return;
  for (const host of node.querySelectorAll('.shadow-root-host')) injectInto(host);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const added of mutation.addedNodes) {
        if (added instanceof Element && added.classList.contains('shadow-root-host')) injectInto(added);
      }
    }
  });
  observer.observe(node, { childList: true });
  editor.onDidDispose(() => observer.disconnect());
}
