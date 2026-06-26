/**
 * RequestTabContent — renders the active request editor tab's pane.
 * Each case wires the matching draft slice to its tab component and
 * folds edits back into the draft via `setDraft`.
 */

import type React from 'react';
import AuthorizationTab from './AuthorizationTab';
import BodyTab from './BodyTab';
import DocsTab from './DocsTab';
import type { Draft } from './draft';
import HeadersTab from './HeadersTab';
import type { KeyValueRowConflictBridge } from './KeyValueTable';
import ParamsTab from './ParamsTab';
import type { TabKey } from './request-tab-items';
import ScriptsTab from './ScriptsTab';
import SettingsTab from './SettingsTab';

interface RequestTabContentProps {
  tab: TabKey;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  headerConflictBridge?: KeyValueRowConflictBridge;
  paramConflictBridge?: KeyValueRowConflictBridge;
}

const RequestTabContent: React.FC<RequestTabContentProps> = ({
  tab,
  draft,
  setDraft,
  headerConflictBridge,
  paramConflictBridge,
}) => {
  switch (tab) {
    case 'docs':
      return <DocsTab value={draft.description} onChange={(description) => setDraft((d) => ({ ...d, description }))} />;
    case 'params':
      return (
        <ParamsTab
          rows={draft.params}
          onChange={(params) => setDraft((d) => ({ ...d, params }))}
          auth={draft.auth}
          conflictBridge={paramConflictBridge}
        />
      );
    case 'authorization':
      return <AuthorizationTab auth={draft.auth} onChange={(auth) => setDraft((d) => ({ ...d, auth }))} />;
    case 'headers':
      return (
        <HeadersTab
          rows={draft.headers}
          onChange={(headers) => setDraft((d) => ({ ...d, headers }))}
          body={draft.body}
          auth={draft.auth}
          conflictBridge={headerConflictBridge}
        />
      );
    case 'body':
      return <BodyTab body={draft.body} onChange={(body) => setDraft((d) => ({ ...d, body }))} />;
    case 'scripts':
      return (
        <ScriptsTab
          preRequestScript={draft.preRequestScript ?? ''}
          postResponseScript={draft.postResponseScript ?? ''}
          onPreRequestChange={(preRequestScript) => setDraft((d) => ({ ...d, preRequestScript }))}
          onPostResponseChange={(postResponseScript) => setDraft((d) => ({ ...d, postResponseScript }))}
        />
      );
    case 'settings':
      return (
        <SettingsTab
          value={{ credentialsMode: draft.credentialsMode, followRedirects: draft.followRedirects }}
          onChange={(next) =>
            setDraft((d) => ({
              ...d,
              credentialsMode: next.credentialsMode,
              followRedirects: next.followRedirects,
            }))
          }
        />
      );
  }
};

export default RequestTabContent;
