/**
 * RuntimeManagedSheet — the request Settings tabs' read-only fact
 * sheet: what the executing runtime fixes for every request or
 * session, "shown so you know what is not negotiable". One reveal
 * button ("N runtime-managed" / "Hide runtime-managed settings"),
 * then the intro line and the facts under the tab's OWN group
 * sections — every tab hands it rows in its own group vocabulary and
 * the sheet orders the groups as the tab does, skipping groups with
 * no fact. The reveal copy keys off the runtime (browser vs node);
 * the fold state stays the tab's (its session store).
 */

import { EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons';
import type { RequestRuntimeKind } from '@openheaders/core/capabilities';
import type { MessageKey } from '@openheaders/i18n';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { EXAMPLE_CARD_POPOVER_WIDTH, InfoTrigger, type InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import GroupSection from './GroupSection';

const { Text } = Typography;

export interface RuntimeManagedRowDef<G extends string> {
  labelKey: MessageKey;
  /** Effective behavior shown in the muted value column. */
  valueKey: MessageKey;
  descriptionKey: MessageKey;
  /** Topic sub-header the fact renders under inside the revealed
   *  sheet — same vocabulary as the tab's live knob groups. */
  group: G;
  /** Optional diagram under the popover summary (the tab's example
   *  card with the fact's slice lit — the popover widens to the card). */
  diagram?: React.ReactElement;
  /** Row anchor for e2e assertions on posture facts. */
  testId?: string;
}

interface SheetCopy {
  /** Reveal-toggle variants: "N <noun>" collapsed / "Hide <noun> settings" open. */
  countKey: MessageKey;
  hideKey: MessageKey;
  /** Kicker on each row's info popover. */
  kickerKey: MessageKey;
  /** Intro line above the read-only rows. */
  introKey: MessageKey;
}

/** The reveal + popover copy per runtime — shared by every tab's sheet. */
const SHEET_COPY: Record<RequestRuntimeKind, SheetCopy> = {
  browser: {
    countKey: 'workbench.editors.request.settings.managed.countBrowser',
    hideKey: 'workbench.editors.request.settings.managed.hideBrowser',
    kickerKey: 'workbench.editors.request.settings.managed.browserKicker',
    introKey: 'workbench.editors.request.settings.managed.browserIntro',
  },
  node: {
    countKey: 'workbench.editors.request.settings.managed.countNode',
    hideKey: 'workbench.editors.request.settings.managed.hideNode',
    kickerKey: 'workbench.editors.request.settings.managed.nodeKicker',
    introKey: 'workbench.editors.request.settings.managed.nodeIntro',
  },
};

export interface RuntimeManagedSheetProps<G extends string> {
  runtime: RequestRuntimeKind;
  rows: ReadonlyArray<RuntimeManagedRowDef<G>>;
  /** The tab's group order — the sheet renders the groups its rows
   *  name, in this order. */
  groupOrder: ReadonlyArray<G>;
  groupLabel: (group: G) => string;
  groupInfo: (group: G) => InfoPopoverContent;
  expanded: (group: G) => boolean;
  onToggle: (group: G) => void;
}

const RuntimeManagedRow = <G extends string>({
  def,
  kicker,
}: {
  def: RuntimeManagedRowDef<G>;
  kicker: string;
}): React.ReactElement => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
      className="rules-settings-row"
      data-testid={def.testId}
      style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 26 }}
    >
      <Text style={{ fontSize: 12, color: token.colorTextSecondary }}>{t(def.labelKey)}</Text>
      <InfoTrigger
        content={{
          title: t(def.labelKey),
          kicker,
          summary: t(def.descriptionKey),
          ...(def.diagram !== undefined ? { diagram: def.diagram, maxWidth: EXAMPLE_CARD_POPOVER_WIDTH } : {}),
        }}
      />
      <span style={{ flex: 1 }} />
      <Text style={{ fontSize: 12, color: token.colorTextTertiary }}>{t(def.valueKey)}</Text>
    </div>
  );
};

function RuntimeManagedSheet<G extends string>({
  runtime,
  rows,
  groupOrder,
  groupLabel,
  groupInfo,
  expanded,
  onToggle,
}: RuntimeManagedSheetProps<G>): React.ReactElement | null {
  const { token } = theme.useToken();
  const t = useT();
  const [shown, setShown] = useState(false);
  if (rows.length === 0) return null;
  const copy = SHEET_COPY[runtime];
  return (
    <>
      <div style={{ marginTop: 8 }}>
        <Button
          size="small"
          type="text"
          icon={shown ? <EyeInvisibleOutlined /> : <EyeOutlined />}
          onClick={() => setShown((s) => !s)}
          style={{ color: token.colorTextSecondary, fontSize: 12 }}
        >
          {shown ? t(copy.hideKey) : t(copy.countKey, { count: rows.length })}
        </Button>
      </div>
      {shown && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '6px 10px',
            borderRadius: 6,
            background: token.colorFillQuaternary,
          }}
        >
          <Text style={{ fontSize: 11, color: token.colorTextTertiary, marginBottom: 2 }}>{t(copy.introKey)}</Text>
          {groupOrder
            .filter((group) => rows.some((r) => r.group === group))
            .map((group) => (
              <GroupSection
                key={group}
                label={groupLabel(group)}
                expanded={expanded(group)}
                onToggle={() => onToggle(group)}
                info={groupInfo(group)}
              >
                {rows
                  .filter((r) => r.group === group)
                  .map((def) => (
                    <RuntimeManagedRow key={def.labelKey} def={def} kicker={t(copy.kickerKey)} />
                  ))}
              </GroupSection>
            ))}
        </div>
      )}
    </>
  );
}

export default RuntimeManagedSheet;
