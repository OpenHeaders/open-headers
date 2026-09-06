/**
 * "Convert to GraphQL request" — the workbench gesture over the tree
 * operation (`convert-request-to-graphql.ts`): a confirmation that
 * spells out what the conversion does to THIS request (the query rows
 * folded into the URL, disabled rows dropped, a non-POST method
 * becoming POST, the saved responses following), then the operation,
 * then the new editor opened in the HTTP tab's place (the HTTP tab
 * closes on its own once its entity is gone). Shared by the sidebar
 * request row's context menu and the HTTP editor's ⋯ menu; failures
 * surface as a toast carrying the host's message.
 */

import { fromHttpRequest } from '@openheaders/core/graphql';
import type { Request } from '@openheaders/core/types';
import { getResponseExampleSyncMirrorForWorkspace } from '@openheaders/ui/context/mirrors/response-example-sync-mirror';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useRequests } from '@openheaders/ui/shared/hooks/readers/useRequests';
import { App, Modal } from 'antd';
import { useCallback } from 'react';
import { useWorkbenchEditingScopeWorkspaceId } from './EditingScopeWorkspaceContext';

export type ConvertRequestToGraphql = (
  request: Request,
  /** Opens the new GraphQL request's editor once the conversion landed. */
  onConverted?: (uid: string, name: string) => void,
) => void;

export function useConvertRequestToGraphql(): ConvertRequestToGraphql {
  const { message } = App.useApp();
  const t = useT();
  const { convertRequestToGraphql } = useRequests();
  const workspaceId = useWorkbenchEditingScopeWorkspaceId();

  return useCallback<ConvertRequestToGraphql>(
    (request, onConverted) => {
      const preview = fromHttpRequest(request);
      if (preview === null) {
        message.warning(t('workbench.editors.request.convert.notConvertible'));
        return;
      }
      const examples = workspaceId
        ? getResponseExampleSyncMirrorForWorkspace(workspaceId).listResponseExamplesForRequest(request.uid).length
        : 0;
      const notes = preview.notes.map((note) => {
        switch (note.kind) {
          case 'params-folded':
            return t('workbench.editors.request.convert.noteParamsFolded', { count: note.count });
          case 'disabled-params-dropped':
            return t('workbench.editors.request.convert.noteDisabledParamsDropped', { count: note.count });
          case 'method-changed':
            return t('workbench.editors.request.convert.noteMethodChanged', { method: note.method });
        }
      });
      if (examples > 0) notes.push(t('workbench.editors.request.convert.noteExamples', { count: examples }));
      Modal.confirm({
        title: <span style={{ fontSize: 13, fontWeight: 600 }}>{t('workbench.editors.request.convert.title')}</span>,
        width: 420,
        content: (
          <div style={{ fontSize: 12, margin: '4px 0 0' }} data-testid="request-convert-graphql-confirm">
            <p style={{ margin: 0 }}>{t('workbench.editors.request.convert.body', { name: request.name })}</p>
            {notes.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                {notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </div>
        ),
        okText: t('workbench.editors.request.convert.ok'),
        okButtonProps: { size: 'small' },
        cancelButtonProps: { size: 'small' },
        onOk: async () => {
          const result = await convertRequestToGraphql(request.uid);
          if (result === null || !result.ok) {
            const detail = result !== null && result.reason === 'other' ? result.message : undefined;
            message.error(
              detail
                ? t('workbench.editors.request.convert.failedDetail', { message: detail })
                : t('workbench.editors.request.convert.failed'),
            );
            return;
          }
          message.success(t('workbench.editors.request.convert.done', { name: result.graphqlRequest.name }));
          onConverted?.(result.graphqlRequest.uid, result.graphqlRequest.name);
        },
      });
    },
    [convertRequestToGraphql, workspaceId, message, t],
  );
}
