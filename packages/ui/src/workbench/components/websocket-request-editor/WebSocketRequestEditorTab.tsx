/**
 * WebSocketRequestEditorTab — the `websocket-edit` tab body: resolves
 * the tab's uid to the live WebSocketRequest and mounts the editor over
 * it, or the not-found panel when the request is gone (deleted, or the
 * outgoing workspace's tab rendering against the incoming workspace's
 * data for the frame before the tab session resyncs). The editor takes
 * the entity, so its hook chain never forks on absence.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import type React from 'react';
import { useMemo } from 'react';
import EditorNotFound from '../shared/EditorNotFound';
import WebSocketRequestEditor, { type WebSocketRequestEditorProps } from './WebSocketRequestEditor';

interface WebSocketRequestEditorTabProps extends Omit<WebSocketRequestEditorProps, 'entity'> {
  websocketRequestUid: string;
}

const WebSocketRequestEditorTab: React.FC<WebSocketRequestEditorTabProps> = ({
  websocketRequestUid,
  ...editorProps
}) => {
  const t = useT();
  const { websocketRequests } = useRequests();
  const entity = useMemo(
    () => websocketRequests.find((r) => r.uid === websocketRequestUid) ?? null,
    [websocketRequests, websocketRequestUid],
  );
  if (entity === null) return <EditorNotFound message={t('workbench.editors.websocket.notFound')} />;
  return <WebSocketRequestEditor entity={entity} {...editorProps} />;
};

export default WebSocketRequestEditorTab;
