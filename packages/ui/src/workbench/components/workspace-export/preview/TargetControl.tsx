/**
 * Import-target picker — segmented switch with a contextual second
 * field that morphs based on the choice:
 *   - Current → no extra field
 *   - New     → editable name input (defaults to the export's
 *               workspace name, user can override) + an Org select when
 *               the identity holds more than one Org (defaults to the
 *               new-workspace Org preference; a joined Org lands the
 *               workspace on that back-end, the home Org stays local)
 *   - Pick    → workspace dropdown
 */

import { defaultNewWorkspaceOrgId, orgCatalogue } from '@openheaders/core/identity';
import type { ExtensionWorkspace } from '@openheaders/core/types';
import type { WorkspaceExport } from '@openheaders/core/workspace-export';
import { Input, Segmented, Select, Space, Typography } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { useIdentitySnapshot } from '@openheaders/ui/shared/hooks/useIdentitySnapshot';
import { useOrgBindingPrefs } from '@openheaders/ui/shared/hooks/useOrgBindingPrefs';
import { OrgIcon } from '@openheaders/ui/shared/workspace-org/OrgIcon';

const { Text } = Typography;

export type ImportTargetSelection =
  | { mode: 'current' }
  | { mode: 'new'; name?: string; orgId?: string }
  | { mode: 'picked'; workspaceId: string };

const TargetControl: React.FC<{
  target: ImportTargetSelection;
  onChange: (t: ImportTargetSelection) => void;
  workspaces: ExtensionWorkspace[];
  activeWorkspaceId: string | null;
  envelope: WorkspaceExport;
  /** Visual size of the segmented + side fields. `'middle'` is used
   *  when the picker is the modal's primary action (secondary header
   *  strip); `'small'` is the default for in-card uses. */
  size?: 'small' | 'middle';
}> = ({ target, onChange, workspaces, activeWorkspaceId, envelope, size = 'small' }) => {
  const t = useT();
  const exportName = envelope.workspace.name;

  // Local name buffer so the user can type freely without re-render
  // churn. Kept in sync when the radio flips back to `new`.
  const [newName, setNewName] = useState<string>(target.mode === 'new' ? (target.name ?? exportName) : exportName);
  useEffect(() => {
    if (target.mode === 'new' && target.name !== undefined) setNewName(target.name);
  }, [target]);

  // Org binding for the new workspace — same source of truth as the
  // Workspace Manager's create flow: the identity's Org catalogue with
  // the stored new-workspace preference as the default. With a single
  // Org there is nothing to choose and `orgId` stays absent.
  const snapshot = useIdentitySnapshot();
  const catalogue = useMemo(() => orgCatalogue(snapshot), [snapshot]);
  const { prefs } = useOrgBindingPrefs();
  const defaultOrgId = prefs.defaultNewWorkspaceOrgId ?? defaultNewWorkspaceOrgId(snapshot, null);
  const selectedOrgId = target.mode === 'new' ? (target.orgId ?? defaultOrgId ?? undefined) : undefined;
  const selectedOrg = catalogue.find((d) => d.id === selectedOrgId);

  const options = [
    { label: t('workbench.importExport.target.current'), value: 'current', disabled: !activeWorkspaceId },
    { label: t('workbench.importExport.target.new'), value: 'new' },
    { label: t('workbench.importExport.target.pickExisting'), value: 'picked', disabled: workspaces.length === 0 },
  ];

  const labelFontSize = size === 'middle' ? 13 : 12;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <Text strong style={{ fontSize: labelFontSize }}>
        {t('workbench.importExport.target.importInto')}
      </Text>
      <Segmented
        size={size}
        value={target.mode}
        onChange={(v) => {
          const mode = v as ImportTargetSelection['mode'];
          if (mode === 'current') onChange({ mode: 'current' });
          else if (mode === 'new')
            onChange({ mode: 'new', name: newName, ...(defaultOrgId ? { orgId: defaultOrgId } : {}) });
          else onChange({ mode: 'picked', workspaceId: workspaces[0]?.id ?? '' });
        }}
        options={options}
      />
      {target.mode === 'current' && (
        // Read-only mirror of the same Select used by `picked`: shows
        // the active workspace pinned in place so the user always sees
        // *which* workspace "current" refers to. Disabled so the only
        // way to change targets is via the segmented control.
        <Select
          size={size}
          value={activeWorkspaceId ?? undefined}
          disabled
          style={{ width: 260 }}
          options={workspaces.map((w) => ({ label: w.name, value: w.id }))}
          placeholder={t('workbench.importExport.target.noActiveWorkspace')}
        />
      )}
      {target.mode === 'new' && (
        <>
          <Input
            size={size}
            value={newName}
            placeholder={exportName}
            onChange={(e) => {
              const v = e.target.value;
              setNewName(v);
              onChange({ mode: 'new', name: v, ...(selectedOrgId ? { orgId: selectedOrgId } : {}) });
            }}
            style={{ width: 260 }}
          />
          {catalogue.length > 1 && (
            <>
              <Select
                size={size}
                value={selectedOrgId}
                onChange={(orgId) => onChange({ mode: 'new', name: newName, orgId })}
                style={{ minWidth: 180 }}
                options={catalogue.map((descriptor) => ({
                  value: descriptor.id,
                  label: (
                    <Space size={6}>
                      <OrgIcon descriptor={descriptor} size={13} />
                      {descriptor.name}
                    </Space>
                  ),
                }))}
              />
              <Text type="secondary" style={{ fontSize: labelFontSize - 1 }}>
                {selectedOrg && !selectedOrg.isHome
                  ? t('workbench.importExport.target.landsOnOrg', { name: selectedOrg.name })
                  : t('workbench.importExport.target.staysLocal')}
              </Text>
            </>
          )}
        </>
      )}
      {target.mode === 'picked' && (
        <Select
          size={size}
          value={target.workspaceId || undefined}
          onChange={(id) => onChange({ mode: 'picked', workspaceId: id })}
          style={{ width: 260 }}
          options={workspaces.map((w) => ({ label: w.name, value: w.id }))}
          placeholder={t('workbench.importExport.target.selectWorkspace')}
        />
      )}
    </div>
  );
};

export default TargetControl;
