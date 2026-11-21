/**
 * Administration dock panel — the administration nav. One row per
 * administration domain (the section registry); a click opens that
 * domain's own slim workbench tab. The panel itself holds no admin
 * data: it is pure navigation, so it renders instantly and the domain
 * tabs own their loading states.
 *
 * A row is its icon and its name on one line — what each domain covers
 * lives in the title bar's `(i)`. The row whose tab is in front reads
 * as selected.
 *
 * The window only exists for admins (`availableToolWindows` filters it
 * on the shared admin-status store), so the body renders no second
 * gate — an admin revoked mid-session keeps the nav but every domain
 * tab answers with its denied state.
 */

import { theme } from 'antd';
import { useMemo, useState } from 'react';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { type ServerAdminSection, type ServerAdminSectionDef, visibleServerAdminSections } from './sections';

interface ServerAdminPanelProps {
  /** Title-bar `(i)` popover copy. */
  info: InfoPopoverContent;
  /** The domain whose tab is in front, if one is. */
  activeSection: ServerAdminSection | null;
  onClose: () => void;
  onOpenSection: (section: ServerAdminSection) => void;
}

const ServerAdminNavRow: React.FC<{
  def: ServerAdminSectionDef;
  active: boolean;
  onOpenSection: (section: ServerAdminSection) => void;
}> = ({ def, active, onOpenSection }) => {
  const t = useT();
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onOpenSection(def.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={active ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '5px 8px',
        marginBottom: 1,
        border: 'none',
        borderRadius: 5,
        background: active ? token.colorFillSecondary : hovered ? token.colorBgTextHover : 'transparent',
        color: active ? token.colorText : token.colorTextSecondary,
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        transition: 'background 80ms ease, color 80ms ease',
      }}
      data-testid={`server-admin-panel-${def.id}`}
    >
      <span aria-hidden style={{ flex: 'none', display: 'inline-flex', fontSize: 14 }}>
        {def.icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {t(def.labelKey)}
      </span>
    </button>
  );
};

const ServerAdminPanel: React.FC<ServerAdminPanelProps> = ({ info, activeSection, onClose, onOpenSection }) => {
  const t = useT();
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const title = t('workbench.toolWindows.serverAdmin');

  return (
    <div
      className="rules-right-panel rules-right-panel--server-admin"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
      data-testid="server-admin-panel"
    >
      <PanelHeader title={title} info={info} wiring={wiring} />
      <nav aria-label={title} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 6px 6px' }}>
        {visibleServerAdminSections().map((def) => (
          <ServerAdminNavRow key={def.id} def={def} active={def.id === activeSection} onOpenSection={onOpenSection} />
        ))}
      </nav>
    </div>
  );
};

export default ServerAdminPanel;
