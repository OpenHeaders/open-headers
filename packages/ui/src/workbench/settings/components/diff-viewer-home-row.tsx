/**
 * DiffViewerHomeRow — the Workspace Sharing page's pointer to the Diff
 * Viewer page. The import preview renders with the app-wide diff
 * settings, which have ONE home under Editor › Diff Viewer; this row
 * says so and links there instead of duplicating the knobs.
 */

import { theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';
import SettingsCategoryLink from './settings-category-link';

const DIFF_VIEWER_CATEGORY = 'diffViewer';

const DiffViewerHomeRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <FieldRow
      settingKey={def.key}
      label={resolveLabel(def, t)}
      description={resolveDescription(def, t)}
      resettable={false}
      block
    >
      <div style={{ fontSize: 12, color: token.colorTextSecondary }}>
        {t('workbench.settings.workspaceSharingPane.diffViewerHome')}{' '}
        <SettingsCategoryLink categoryId={DIFF_VIEWER_CATEGORY} testid="workspace-sharing-diff-viewer-home" />
      </div>
    </FieldRow>
  );
};

export default DiffViewerHomeRow;
