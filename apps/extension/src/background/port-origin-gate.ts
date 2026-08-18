/**
 * Extension-origin gate for `runtime.onConnect` ports.
 *
 * Every legitimate port consumer is an extension-origin surface —
 * panel, popup, sidepanel, workbench, devtools pages, offscreen doc.
 * No content script opens ports, so a port dialed from a tab realm has
 * no business attaching to any host: without this gate a compromised
 * page realm could subscribe to another tab's lifecycle/console/page
 * streams or feed forged rows into the correlator. Defense-in-depth —
 * reaching a content-script realm already requires a renderer
 * compromise.
 *
 * Callers check AFTER their port-name match so the log line only fires
 * for ports that actually targeted the caller's namespace.
 */

import { runtime } from '@utils/browser-runtime';
import { logger } from '@utils/logger';

let cachedOwnOriginPrefix: string | null = null;

/**
 * True when the port was opened by one of the extension's own pages
 * (chrome-extension:// / moz-extension:// / safari-web-extension://).
 * Logs and returns false for anything else.
 */
export function isExtensionOriginPort(port: chrome.runtime.Port, hostLabel: string): boolean {
  if (cachedOwnOriginPrefix === null) cachedOwnOriginPrefix = runtime.getURL('');
  const senderUrl = port.sender?.url ?? '';
  if (senderUrl.startsWith(cachedOwnOriginPrefix)) return true;
  logger.warn(hostLabel, 'Dropped port from non-extension sender:', port.name, senderUrl || '(no url)');
  return false;
}
