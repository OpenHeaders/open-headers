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
 * script), matching the tab-label tones. The selected row and the
 * hover fill are the stylesheet's (`.oh-script-rail-row` in
 * editor.less, off `aria-pressed`) — an inline background would sit
 * above the hover rule. A kind header's badge carries the kind's own
 * tint, the tree tags' color.
 *
 * The rail scrolls on its own when it outgrows the pane (the container
 * mount's four groups on a short window) — the editor beside it keeps
 * the pane's height, so its toolbar and corner menus never scroll away.
 */

import type { ScriptKind } from '@openheaders/core/scripts';
import { Divider, theme } from 'antd';
import type { MessageKey } from '@openheaders/i18n';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { InfoTrigger } from '@openheaders/ui/shared/info-popover';
import { requestKindMeta } from '../../request-kind-menu';
import { REQUEST_KIND_COLORS } from '../sidebar/icons';
import { codeBadge } from '../shared/code-badge';
import { scriptSlotInfo } from './script-slot-info';
import type { ScriptSlotDescriptor, ScriptSlotFlags, ScriptSlotGroup, ScriptSlotValues } from './script-slots';

/** The rail's fixed width — the editor pane takes the rest. */
export const SCRIPT_RAIL_WIDTH = 176;

const KIND_BADGE_WIDTH = 36;
/** A kind header's badge names the flavors that run its slots too
 *  ("WS/S.IO") — the name stays the kind's, the rail keeps its width. */
const FAMILY_BADGE_WIDTH = 56;

interface ScriptRailProps {
  groups: readonly ScriptSlotGroup[];
  /** Draw each group under its request-kind header. */
  grouped: boolean;
  active: ScriptKind;
  scripts: ScriptSlotValues;
  /** A flavor's own labels over its family's slots — see ScriptsTab. */
  slotLabels?: Partial<Readonly<Record<ScriptKind, MessageKey>>>;
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
  /** Under a kind header the row sits inset from it — the header keeps
   *  the rail's edge, its slots read as nested. */
  inset: boolean;
  selected: boolean;
  hasScript: boolean;
  unsaved: boolean;
  labelKey: MessageKey;
  onSelect: (kind: ScriptKind) => void;
}> = ({ slot, inset, selected, hasScript, unsaved, labelKey, onSelect }) => {
  const { token } = theme.useToken();
  const t = useT();
  return (
    <div
      role="button"
      tabIndex={0}
      className="oh-script-rail-row"
      aria-pressed={selected}
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
        padding: inset ? '7px 10px 7px 24px' : '7px 10px',
        borderRadius: 4,
        cursor: 'pointer',
        color: token.colorText,
        fontSize: 12,
      }}
    >
      <span>{t(labelKey)}</span>
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
  const flavors = (group.flavors ?? []).map(requestKindMeta);
  const codes = [meta.code, ...flavors.map((flavor) => flavor.code)];
  return (
    <div
      data-testid="oh-script-rail-group"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px 6px',
        color: token.colorText,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {codeBadge(
        codes.join('/'),
        flavors.length > 0 ? FAMILY_BADGE_WIDTH : KIND_BADGE_WIDTH,
        REQUEST_KIND_COLORS[group.requestKind],
      )}
      <span>{t(meta.labelKey)}</span>
    </div>
  );
};

const ScriptRail: React.FC<ScriptRailProps> = ({
  groups,
  grouped,
  active,
  scripts,
  slotLabels,
  unsaved,
  onSelect,
}) => {
  const rows = (group: ScriptSlotGroup) =>
    group.slots.map((slot) => (
      <ScriptRailRow
        key={slot.kind}
        slot={slot}
        inset={grouped}
        selected={active === slot.kind}
        hasScript={scripts[slot.kind].trim() !== ''}
        unsaved={unsaved?.[slot.kind] === true}
        labelKey={slotLabels?.[slot.kind] ?? slot.labelKey}
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
        flexShrink: 0,
        minHeight: 0,
        overflowY: 'auto',
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
