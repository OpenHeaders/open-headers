import { getCapability } from '@openheaders/core/capabilities';

/**
 * Open a link outside the app: through the host's `openExternalUrl`
 * capability where one is registered (the desktop renderer hands it to
 * the OS), else a new browser tab.
 */
export function openExternalLink(url: string): void {
  const openUrl = getCapability('openExternalUrl');
  if (openUrl) void openUrl(url);
  else window.open(url, '_blank', 'noopener');
}
