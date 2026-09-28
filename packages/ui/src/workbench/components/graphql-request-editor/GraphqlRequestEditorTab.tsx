/**
 * GraphqlRequestEditorTab — the `graphql-edit` tab body: resolves the
 * tab's uid to the live GraphqlRequest and mounts the editor over it,
 * or the not-found panel when the request is gone (deleted, or the
 * outgoing workspace's tab rendering against the incoming workspace's
 * data for the frame before the tab session resyncs). The editor takes
 * the entity, so its hook chain never forks on absence.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import type React from 'react';
import { useMemo } from 'react';
import EditorNotFound from '../shared/EditorNotFound';
import GraphqlRequestEditor, { type GraphqlRequestEditorProps } from './GraphqlRequestEditor';

interface GraphqlRequestEditorTabProps extends Omit<GraphqlRequestEditorProps, 'entity'> {
  graphqlRequestUid: string;
}

const GraphqlRequestEditorTab: React.FC<GraphqlRequestEditorTabProps> = ({ graphqlRequestUid, ...editorProps }) => {
  const t = useT();
  const { graphqlRequests } = useRequests();
  const entity = useMemo(
    () => graphqlRequests.find((r) => r.uid === graphqlRequestUid) ?? null,
    [graphqlRequests, graphqlRequestUid],
  );
  if (entity === null) return <EditorNotFound message={t('workbench.editors.graphql.notFound')} />;
  return <GraphqlRequestEditor entity={entity} {...editorProps} />;
};

export default GraphqlRequestEditorTab;
