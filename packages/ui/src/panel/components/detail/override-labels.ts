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
