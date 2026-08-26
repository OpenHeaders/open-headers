/**
 * Third-party software row — custom editor for `about.openSource`.
 * Renders the generated third-party manifest (name / version / license)
 * filtered to the packages bundled in the running host. The manifest is
 * loaded on demand so the list never rides the boot bundle; regenerate
 * it with `node scripts/generate-third-party-notices.mjs --ui-manifest`.
 */

import { theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import * as v from 'valibot';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '../../../shared/host-vocabulary';
import FieldRow from '../fields/FieldRow';
import { resolveDescription, resolveLabel } from '../localize';
import type { SettingDef } from '../types';

const entrySchema = v.object({
  name: v.string(),
  version: v.string(),
  license: v.string(),
  hosts: v.array(v.picklist(['desktop', 'extension', 'web'])),
});
const manifestSchema = v.object({ entries: v.array(entrySchema) });

export type ThirdPartyEntry = v.InferOutput<typeof entrySchema>;

/** The generated manifest, validated at the load boundary. */
export async function loadThirdPartySoftware(): Promise<readonly ThirdPartyEntry[]> {
  const manifest = await import('./third-party-manifest.json');
  return v.parse(manifestSchema, manifest.default).entries;
}

const GRID_COLUMNS = 'minmax(0, 1fr) 130px';

const ThirdPartySoftwareRow: React.FC<{ def: SettingDef }> = ({ def }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [entries, setEntries] = useState<readonly ThirdPartyEntry[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void loadThirdPartySoftware().then((list) => {
      if (!cancelled) setEntries(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const host = getCurrentHost();
  const visible = useMemo(() => (entries ?? []).filter((entry) => entry.hosts.includes(host)), [entries, host]);

  if (entries === null) return null;
  return (
    <FieldRow settingKey={def.key} label={resolveLabel(def, t)} description={resolveDescription(def, t)} block>
      <div
        data-testid="third-party-software"
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadius,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID_COLUMNS,
            columnGap: 12,
            padding: '5px 10px',
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorFillQuaternary,
            fontSize: 11,
            fontWeight: 600,
            color: token.colorTextSecondary,
          }}
        >
          <span>{t('workbench.settings.thirdParty.software')}</span>
          <span>{t('workbench.settings.thirdParty.license')}</span>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', padding: '3px 0' }}>
          {visible.map((entry) => (
            <div
              key={`${entry.name}@${entry.version}`}
              style={{
                display: 'grid',
                gridTemplateColumns: GRID_COLUMNS,
                columnGap: 12,
                padding: '2px 10px',
                fontSize: 12,
              }}
            >
              <span style={{ color: token.colorText, minWidth: 0, overflowWrap: 'anywhere' }}>
                {entry.name}
                {entry.version && <span style={{ color: token.colorTextSecondary }}>{` ${entry.version}`}</span>}
              </span>
              <span style={{ color: token.colorTextSecondary }}>{entry.license}</span>
            </div>
          ))}
        </div>
      </div>
    </FieldRow>
  );
};

export default ThirdPartySoftwareRow;
