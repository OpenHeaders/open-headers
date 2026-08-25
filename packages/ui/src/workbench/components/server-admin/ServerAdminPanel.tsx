/**
 * Server admin dock panel — the administration nav. One row per
 * administration domain (the section registry); a click opens that
 * domain's own slim workbench tab. The panel itself holds no admin
 * data: it is pure navigation, so it renders instantly and the domain
 * tabs own their loading states.
 *
 * The window only exists for server admins (`availableToolWindows`
 * filters it on the shared admin-status store), so the body renders no
 * second gate — an admin revoked mid-session keeps the nav but every
 * domain tab answers with its denied state.
 */

import { List, theme } from 'antd';
import { useMemo } from 'react';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { createPanelHeaderWiring, PanelHeader } from '@openheaders/ui/shared/dock-layout';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { SERVER_ADMIN_SECTIONS, type ServerAdminSection } from './sections';

interface ServerAdminPanelProps {
  /** Title-bar `(i)` popover copy. */
  info: InfoPopoverContent;
  onClose: () => void;
  onOpenSection: (section: ServerAdminSection) => void;
}

const ServerAdminPanel: React.FC<ServerAdminPanelProps> = ({ info, onClose, onOpenSection }) => {
  const t = useT();
  const { token } = theme.useToken();
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }} data-testid="server-admin-panel">
      <PanelHeader title={t('workbench.toolWindows.serverAdmin')} info={info} wiring={wiring} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <List
          size="small"
          split={false}
          dataSource={[...SERVER_ADMIN_SECTIONS]}
          renderItem={(def) => (
            <List.Item
              onClick={() => onOpenSection(def.id)}
              style={{ cursor: 'pointer', padding: '6px 12px' }}
              data-testid={`server-admin-panel-${def.id}`}
            >
              <List.Item.Meta
                avatar={<span style={{ fontSize: 14, color: token.colorTextSecondary }}>{def.icon}</span>}
                title={<span style={{ fontSize: 12.5 }}>{t(def.labelKey)}</span>}
                description={
                  <span style={{ fontSize: 11, color: token.colorTextTertiary }}>{t(def.hintKey)}</span>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </div>
  );
};

export default ServerAdminPanel;
