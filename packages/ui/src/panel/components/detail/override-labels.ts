/**
 * Pane captions for the two-sided override views (split and diff).
 * Phrased as the delivery path so the reader can see where each body
 * came from and where Open Headers sat in the middle — response bodies
 * travel server → page, request bodies page → server.
 *
 * WebSocket frame captions ride the same pairs per direction: a receive
 * frame reads as a response (server → page), a send frame as a request
 * (page → server); only the dropped captions are WS-specific.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';

export interface OverrideLabels {
  readonly responseOriginal: string;
  readonly responseModified: string;
  readonly requestOriginal: string;
  readonly requestModified: string;
  readonly wsRecvDropped: string;
  readonly wsSendDropped: string;
}

export function overrideLabels(t: Translate): OverrideLabels {
  return {
    responseOriginal: t('panel.inspector.paneCaption.responseOriginal'),
    responseModified: t('panel.inspector.paneCaption.responseModified'),
    requestOriginal: t('panel.inspector.paneCaption.requestOriginal'),
    requestModified: t('panel.inspector.paneCaption.requestModified'),
    wsRecvDropped: t('panel.inspector.paneCaption.wsRecvDropped'),
    wsSendDropped: t('panel.inspector.paneCaption.wsSendDropped'),
  };
}
