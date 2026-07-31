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
import type { UnsavedSections } from './section-unsaved';
import SettingsTab from './SettingsTab';
import { type SettingsKnobKey, settingsSlice } from './settings-unsaved';

interface RequestTabContentProps {
  tab: TabKey;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  headerConflictBridge?: KeyValueRowConflictBridge;
  paramConflictBridge?: KeyValueRowConflictBridge;
  /** Editing-scope workspace — target for script-editor selection
   *  actions (Save to Package Library) and the Settings tab's
   *  per-workspace Script execution chooser. */
  workspaceId?: string | null;
  /** Open the Package Library tab (Scripts tab's Packages popover). */
  onOpenPackageLibrary?: () => void;
  /** Switch the editor's active sub-tab — drives the generated rows'
   *  "Go to …" jump links (Headers/Params → Authorization/Body/Settings). */
  onNavigateTab?: (tab: TabKey) => void;
  /** Settings knobs differing from the saved request — the Settings
   *  tab's salmon dots (see settings-unsaved.ts). */
  unsavedSettings?: ReadonlySet<SettingsKnobKey>;
  /** Per-section unsaved flags — feeds the Scripts tab's rail dots
   *  (see section-unsaved.ts). */
  unsavedSections?: UnsavedSections;
}

const RequestTabContent: React.FC<RequestTabContentProps> = ({
  tab,
  draft,
  setDraft,
  headerConflictBridge,
  paramConflictBridge,
  workspaceId,
  onOpenPackageLibrary,
  onNavigateTab,
  unsavedSettings,
  unsavedSections,
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
          onAuthChange={(auth) => setDraft((d) => ({ ...d, auth }))}
          onNavigateTab={onNavigateTab}
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
          onAuthChange={(auth) => setDraft((d) => ({ ...d, auth }))}
          onNavigateTab={onNavigateTab}
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
          workspaceId={workspaceId}
          onOpenPackageLibrary={onOpenPackageLibrary}
          preRequestUnsaved={unsavedSections?.preRequestScript}
          postResponseUnsaved={unsavedSections?.postResponseScript}
        />
      );
    case 'settings':
      return (
        <SettingsTab
          workspaceId={workspaceId}
          unsaved={unsavedSettings}
          value={settingsSlice(draft)}
          onChange={(next) =>
            setDraft((d) => ({
              ...d,
              credentialsMode: next.credentialsMode,
              followRedirects: next.followRedirects,
              sslVerification: next.sslVerification,
              tlsMinVersion: next.tlsMinVersion,
              tlsMaxVersion: next.tlsMaxVersion,
              tlsCipherSuites: next.tlsCipherSuites,
              httpVersion: next.httpVersion,
              resolveToAddress: next.resolveToAddress,
              clientCertificateRef: next.clientCertificateRef,
              proxyMode: next.proxyMode,
              proxyUrl: next.proxyUrl,
              proxyCredentialRef: next.proxyCredentialRef,
              unixSocketPath: next.unixSocketPath,
              cookieJar: next.cookieJar,
              timeoutMs: next.timeoutMs,
              maxResponseBytes: next.maxResponseBytes,
              maxRedirects: next.maxRedirects,
              followOriginalHttpMethod: next.followOriginalHttpMethod,
              followAuthorizationHeader: next.followAuthorizationHeader,
            }))
          }
        />
      );
  }
};

export default RequestTabContent;
