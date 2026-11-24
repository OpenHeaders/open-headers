/**
 * What the host offers under the "content is available only with DevTools
 * opened, or with Debug mode on" notice: its Debug mode control for the
 * browser tab the request ran in.
 *
 * The Response and Preview panes are shared by every host and know neither
 * a tab's identity nor a control plane, so the surface that mounts them
 * provides the control — the in-browser panel its own switch, the workbench
 * the owning browser's. A surface with nothing to offer provides nothing,
 * and the notice stands alone.
 */

import { createContext, type ReactNode, useContext } from 'react';

export const BodyCaptureControlContext = createContext<ReactNode>(null);

export function useBodyCaptureControl(): ReactNode {
  return useContext(BodyCaptureControlContext);
}
