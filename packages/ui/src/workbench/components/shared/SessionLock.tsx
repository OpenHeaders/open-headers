/**
 * SessionLock — freezes a session editor's Connect-time surfaces while
 * the session is in flight (connecting, open, or a stream invoke
 * running): the target row and every tab whose values the executor
 * snapshotted at Connect (params, auth, headers / metadata, settings).
 * An edit there could not reach the wire until the next Connect, so
 * the controls read DISABLED rather than silently stale. The compose
 * surfaces (message, docs) stay live — they are what Send writes.
 *
 * Two legs, one wrapper: antd's `componentDisabled` disables every
 * antd input, select, switch and button underneath; the context feeds
 * the contentEditable-backed {@link TemplateInput} the same signal.
 */

import { ConfigProvider } from 'antd';
import type React from 'react';
import { createContext, useContext } from 'react';

const SessionLockContext = createContext(false);

/** True inside a locked {@link SessionLock}. */
export function useSessionLocked(): boolean {
  return useContext(SessionLockContext);
}

const SessionLock: React.FC<{ locked: boolean; children: React.ReactNode }> = ({ locked, children }) => (
  <SessionLockContext.Provider value={locked}>
    <ConfigProvider componentDisabled={locked}>{children}</ConfigProvider>
  </SessionLockContext.Provider>
);

export default SessionLock;
