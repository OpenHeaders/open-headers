/**
 * Pane captions for the two-sided override views (split and diff).
 * Phrased as the delivery path so the reader can see where each body
 * came from and where Open Headers sat in the middle — response bodies
 * travel server → page, request bodies page → server.
 */

export const RESPONSE_ORIGINAL_LABEL = 'Original · server → page';
export const RESPONSE_MODIFIED_LABEL = 'Modified · server → Open Headers → page';

export const REQUEST_ORIGINAL_LABEL = 'Original · page → server';
export const REQUEST_MODIFIED_LABEL = 'Modified · page → Open Headers → server';

/** WebSocket frame captions — per direction, since a frame travels one
 *  way: a receive frame reads as a response (server → page), a send
 *  frame as a request (page → server), so those pairs are shared. */
export const WS_RECV_DROPPED_LABEL = 'Dropped · never reached the page';
export const WS_SEND_DROPPED_LABEL = 'Dropped · never reached the server';
