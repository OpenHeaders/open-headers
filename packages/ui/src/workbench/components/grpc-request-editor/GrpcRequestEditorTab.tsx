/**
 * GrpcRequestEditorTab — the `grpc-edit` tab body: resolves the tab's
 * uid to the live GrpcRequest and mounts the editor over it, or the
 * not-found panel when the request is gone (deleted, or the outgoing
 * workspace's tab rendering against the incoming workspace's data for
 * the frame before the tab session resyncs). The editor takes the
 * entity, so its hook chain never forks on absence.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import type React from 'react';
import { useMemo } from 'react';
import EditorNotFound from '../shared/EditorNotFound';
import GrpcRequestEditor, { type GrpcRequestEditorProps } from './GrpcRequestEditor';

interface GrpcRequestEditorTabProps extends Omit<GrpcRequestEditorProps, 'entity'> {
  grpcRequestUid: string;
}

const GrpcRequestEditorTab: React.FC<GrpcRequestEditorTabProps> = ({ grpcRequestUid, ...editorProps }) => {
  const t = useT();
  const { grpcRequests } = useRequests();
  const entity = useMemo(
    () => grpcRequests.find((r) => r.uid === grpcRequestUid) ?? null,
    [grpcRequests, grpcRequestUid],
  );
  if (entity === null) return <EditorNotFound message={t('workbench.editors.grpc.notFound')} />;
  return <GrpcRequestEditor entity={entity} {...editorProps} />;
};

export default GrpcRequestEditorTab;
