/**
 * PublicWorkspaceViewer — the anonymous read-only mount at
 * `/public/<workspaceId>` (the access-foundation plan §8 F5b). The
 * boot already hydrated the published snapshot into a throwaway
 * in-memory oracle and set it active; this component frames the
 * ordinary Workbench with an honest banner: everything on screen is a
 * public snapshot copy, and local edits land nowhere.
 */

import type { PublicWorkspacePublication } from '@openheaders/core/protocol';
import { useT } from '@openheaders/ui/context/LocaleContext';
import Workbench from '@openheaders/ui/workbench/App';
import { Alert, Result, Tag } from 'antd';
import type React from 'react';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';

export interface PublicWorkspaceViewerProps {
  /** Null = the link answered 404 / an unusable payload. */
  publication: PublicWorkspacePublication | null;
}

export function PublicWorkspaceViewer({ publication }: PublicWorkspaceViewerProps): React.JSX.Element {
  const t = useT();
  if (publication === null) {
    return <Result status="404" title={t('workbench.workspace.publicView.loadFailed')} />;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Alert
        type="info"
        banner
        data-testid="public-view-banner"
        message={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {t('workbench.workspace.publicView.bannerTag')}
            </Tag>
            {t('workbench.workspace.publicView.banner', { name: publication.workspace.name })}
          </span>
        }
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Workbench resolveIdentity={resolveWorkbenchIdentity} />
      </div>
    </div>
  );
}
