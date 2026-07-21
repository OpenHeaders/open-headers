/**
 * Snippet formatters — pure text builders that turn a resolved wire
 * request (`resolveRequestWire` bridge output) into runnable commands
 * for the workbench "Copy as" actions.
 */

export { formatCurlSnippet } from './curl';
export { formatFetchSnippet } from './fetch';
export type { WireHeader, WireSnippetRequest } from './types';
export { graphqlWireBody } from './wire';
