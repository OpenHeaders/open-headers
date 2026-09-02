/**
 * ScriptRail — the Scripts tab's left rail: one row per script slot,
 * drawn from the slot groups (`script-slots.ts`). Grouped, each request
 * kind's slots sit under a kind header (badge + name) with a divider
 * between kinds — the container editor's anatomy, where a collection's
 * HTTP scripts are visibly HTTP's. Flat, the rows stand alone — a
 * request's tab, whose kind the header would only repeat.
 *
 * A row carries the slot's label, its `(i)` card and a dot: the
 * has-script primary dot, or the unsaved salmon dot when the slot
 * differs from the saved entity (shown even on an emptied-but-unsaved
 * script), matching the tab-label tones.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import { Divider, theme } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { requestKindMeta } from '../../request-kind-menu';
import { codeBadge } from '../shared/code-badge';
import { scriptSlotInfo } from './script-slot-info';
import type { ScriptSlotDescriptor, ScriptSlotFlags, ScriptSlotGroup, ScriptSlotValues } from './script-slots';

/** The rail's fixed width — the editor pane takes the rest. */
export const SCRIPT_RAIL_WIDTH = 176;

const KIND_BADGE_WIDTH = 36;

interface ScriptRailProps {
  groups: readonly ScriptSlotGroup[];
  /** Draw each group under its request-kind header. */
  grouped: boolean;
  active: ScriptKind;
  scripts: ScriptSlotValues;
  unsaved?: ScriptSlotFlags;
  onSelect: (kind: ScriptKind) => void;
}

// Row is a `role="button"` div (not a real <button>) so the
// InfoTrigger — itself a <button> — can sit inline right after the
// label without nesting interactive elements. Module-scope on purpose:
// defined inside the rail its component type would change identity
// every render, remounting the rows — and closing an open (i) popover
// on any re-render of the tab.
const ScriptRailRow: React.FC<{
  slot: ScriptSlotDescriptor;
  selected: boolean;
  hasScript: boolean;
  unsaved: boolean;
  onSelect: (kind: ScriptKind) => void;
}> = ({ slot, selected, hasScript, unsaved, onSelect }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
      role="button"
      tabIndex={0}
      data-testid="oh-script-rail-row"
      onClick={() => onSelect(slot.kind)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(slot.kind);
        }
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 10px',
        background: selected ? token.colorFillTertiary : 'transparent',
        borderRadius: 4,
        cursor: 'pointer',
        color: token.colorText,
        fontSize: 13,
      }}
    >
      <span>{t(slot.labelKey)}</span>
      <InfoTrigger content={scriptSlotInfo(slot.kind, t)} />
      <span style={{ flex: 1 }} />
      {(unsaved || hasScript) && (
        <span
          data-testid={unsaved ? 'oh-script-unsaved-dot' : undefined}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: unsaved ? '#ff7875' : token.colorPrimary,
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
};

const ScriptRailGroupHeader: React.FC<{ group: ScriptSlotGroup }> = ({ group }) => {
  const { token } = theme.useToken();
  const t = useT();
  const meta = requestKindMeta(group.requestKind);
  return (
    <div
      data-testid="oh-script-rail-group"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 6px',
        color: token.colorText,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {codeBadge(meta.code, KIND_BADGE_WIDTH)}
      <span>{t(meta.labelKey)}</span>
    </div>
  );
};

const ScriptRail: React.FC<ScriptRailProps> = ({ groups, grouped, active, scripts, unsaved, onSelect }) => {
  const rows = (group: ScriptSlotGroup) =>
    group.slots.map((slot) => (
      <ScriptRailRow
        key={slot.kind}
        slot={slot}
        selected={active === slot.kind}
        hasScript={scripts[slot.kind].trim() !== ''}
        unsaved={unsaved?.[slot.kind] === true}
        onSelect={onSelect}
      />
    ));
  return (
    <div
      data-testid="oh-script-rail"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        width: SCRIPT_RAIL_WIDTH,
        position: 'sticky',
        top: 0,
        alignSelf: 'start',
      }}
    >
      {grouped
        ? groups.map((group, i) => (
            <div key={group.requestKind} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {i > 0 && <Divider style={{ margin: '4px 0' }} />}
              <ScriptRailGroupHeader group={group} />
              {rows(group)}
            </div>
          ))
        : groups.map(rows)}
    </div>
  );
};

export default ScriptRail;
