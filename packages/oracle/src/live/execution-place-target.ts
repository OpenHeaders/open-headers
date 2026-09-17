/**
 * The execution place a workbench frame names — the Execution Place
 * plan's explicit target (`executionPlace: { backendId }` on the send
 * and Connect channels). A place is always named by an explicit
 * backend id, never a default wire; a frame naming none runs on the
 * answering host's own socket. Read here once for every route that
 * honours a place (the HTTP send, the three session Connects).
 */

/** The frame's place, when it names one by an explicit backend id. */
export function executionPlaceBackendIdOf(message: Record<string, unknown>): string | undefined {
  const place = message.executionPlace;
  if (!place || typeof place !== 'object') return undefined;
  const backendId = (place as { backendId?: unknown }).backendId;
  return typeof backendId === 'string' && backendId !== '' ? backendId : undefined;
}
