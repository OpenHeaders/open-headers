/**
 * Crash-and-error-reports toggle row — the channel's one switch (the
 * error reports plan §5) with the "view every report, byte for byte"
 * affordance folded into its `(i)` popover (law 8: the toggle never
 * ships without it): the popover's "View reports" action opens the
 * shared telemetry inspector on its error-reports section. A plain
 * checkbox either way — off is off at once.
 */

import { Checkbox } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { useLocale } from '@openheaders/ui/context/LocaleContext';
import FieldRow from '../fields/FieldRow';
import { useUntypedSetting } from '../hooks';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';
import TelemetryInspectorModal from './telemetry-inspector-modal';

const ErrorReportsToggleRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { t } = useLocale();
  const [value, setValue] = useUntypedSetting(def.key);
  const [open, setOpen] = useState(false);

  const label = resolveLabel(def, t);

  return (
    <FieldRow
      settingKey={def.key}
      label={label}
      description={resolveDescription(def, t)}
      labelInControl
      infoActions={[
        { label: t('workbench.settings.errorReportsRow.viewReports'), onClick: () => setOpen(true), primary: true },
      ]}
    >
      <Checkbox checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} style={{ fontSize: 13 }}>
        {label}
      </Checkbox>
      <TelemetryInspectorModal open={open} section="reports" onClose={() => setOpen(false)} />
    </FieldRow>
  );
};

export default ErrorReportsToggleRow;
