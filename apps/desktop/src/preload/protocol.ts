/**
 * `oh.protocol.onUrl(handler)` — subscribe to `openheaders://` deep
 * links forwarded by main. Main holds URLs in a buffer until the
 * renderer's load completes; this listener is wired at preload eval
 * time so it's present before that drain runs.
 */

import { ipcRenderer } from 'electron';

const PROTOCOL_URL_CHANNEL = 'oh:protocol:url';

export const protocol = {
  onUrl(handler: (url: string) => void): () => void {
    const listener = (_event: Electron.IpcRendererEvent, url: string): void => {
      handler(url);
    };
    ipcRenderer.on(PROTOCOL_URL_CHANNEL, listener);
    return () => {
      ipcRenderer.removeListener(PROTOCOL_URL_CHANNEL, listener);
    };
  },
};
