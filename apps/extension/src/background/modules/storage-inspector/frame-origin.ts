/**
 * Frame → security origin, derived SW-side via `webNavigation.getFrame`
 * — never trusted from the panel. The CDP-tier storage domains address
 * data per origin, so every arbitration (Cache Storage, quota) resolves
 * it through this one helper. `null` covers a gone frame, a non-http(s)
 * scheme, and a missing API — all of which degrade to injection.
 */

export async function frameSecurityOrigin(tabId: number, frameId: number): Promise<string | null> {
  if (!chrome.webNavigation?.getFrame) return null;
  try {
    const frame = await chrome.webNavigation.getFrame({ tabId, frameId });
    if (!frame?.url) return null;
    const url = new URL(frame.url);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}
