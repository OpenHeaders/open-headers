/**
 * Band 3 of the Sync page (the Backup and Sync UX plan §5.2, Q4): where
 * newly-created workspaces go — the Org they bind to by default. Owned
 * here alone; Manage workspaces dropped its copy. The resolved value
 * falls back to the widest-reach place (`defaultNewWorkspaceOrgId`) when
 * the user has set no explicit preference, so the control always
 * reflects what creation will do; with one place to choose from it
 * renders disabled rather than vanishing, so the page keeps its shape
 * when a place connects. The choice catalogue is the clamped one —
 * server places only on the joined web tab.
 */

import { orgCatalogue } from '@openheaders/core/identity';
import { Select, Space } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useBackendReach } from '../../../shared/hooks/useBackendReach';
import { useIdentitySnapshot } from '../../../shared/hooks/useIdentitySnapshot';
import { useOrgBindingPrefs } from '../../../shared/hooks/useOrgBindingPrefs';
import { orgChoiceCatalogue, resolveNewWorkspaceOrgId } from '../../../shared/workspace-org/org-choice';
import { orgFullLabelText } from '../../../shared/workspace-org/org-copy';
import { OrgIcon } from '../../../shared/workspace-org/OrgIcon';
import FieldRow from '../fields/FieldRow';
import { PaneSection } from './pane-chrome';

export const BackendPlacementRow: React.FC = () => {
  const t = useT();
  const snapshot = useIdentitySnapshot();
  // Org labels only read reach for the home Org's host hint — the
  // host's OWN bind tier (self entry).
  const { self: reach } = useBackendReach();
  const catalogue = useMemo(() => orgChoiceCatalogue(orgCatalogue(snapshot)), [snapshot]);
  const { prefs, isReady, setDefaultNewWorkspaceOrgId } = useOrgBindingPrefs();
  const resolved = resolveNewWorkspaceOrgId(snapshot, prefs.defaultNewWorkspaceOrgId);

  return (
    <PaneSection title={t('workbench.settings.backendPane.placement.section')}>
      <FieldRow
        settingKey="backend.newWorkspacePlace"
        label={t('workbench.settings.backendPane.placement.label')}
        description={t('workbench.settings.backendPane.placement.description')}
        resettable={false}
      >
        <Select
          size="small"
          value={resolved ?? undefined}
          disabled={!isReady || catalogue.length <= 1}
          onChange={(orgId) => void setDefaultNewWorkspaceOrgId(orgId)}
          style={{ minWidth: 220 }}
          options={catalogue.map((descriptor) => ({
            value: descriptor.id,
            label: (
              <Space size={6}>
                <OrgIcon descriptor={descriptor} size={13} />
                {orgFullLabelText(t, descriptor, reach)}
              </Space>
            ),
          }))}
        />
      </FieldRow>
    </PaneSection>
  );
};
