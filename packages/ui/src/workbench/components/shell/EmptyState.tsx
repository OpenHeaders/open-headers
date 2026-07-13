/**
 * EmptyState — shown in an editor leaf with no open tabs. A minimalist
 * landing: a grayscale brand mark over the primary "create" gestures —
 * rules (all types, via a dropdown), API requests, workflows, and
 * variables (all scopes, via a dropdown) — plus the import hub. Icons
 * mirror the matching sidebar tool windows so the actions read as
 * shortcuts into those surfaces.
 */

import { ImportOutlined, RightOutlined, SisternodeOutlined, SwapOutlined } from '@ant-design/icons';
import { hostAssets } from '@openheaders/core/assets';
import { ApiRequestsIcon, RequestRulesIcon, VariablesIcon } from '@openheaders/ui/shared/icons';
import { usePopoverViewportFit } from '@openheaders/ui/shared/popover';
import { Dropdown, type MenuProps, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { forwardRef, useState } from 'react';
import { buildRuleTypeMenuItemsWithTemplates, templatesBadge } from '../../rule-type-menu';
import { useSettingValue } from '../../settings/hooks';
import CappedMenuPopup from '../shared/CappedMenuPopup';
import { scopeBadge } from '../shared/scope-colors';

const { Text } = Typography;

/** Variable scopes a user can create from scratch here. Collection
 *  variables are excluded — they only exist inside a collection, so the
 *  menu offers them as a disabled, explained entry instead. */
export type VariableCreateScope = 'environment' | 'workspace' | 'live' | 'vault';

interface EmptyStateProps {
  onCreateRule: (type: string) => void;
  onCreateRuleFromTemplate: (type: string, templateKey: string) => void;
  onBrowseTemplates: () => void;
  onCreateRequest: () => void;
  onCreateWorkflow: () => void;
  onCreateVariable: (scope: VariableCreateScope) => void;
  /** Opens the import hub — formats are auto-detected there. */
  onImport: () => void;
  /** First-run migration offer (MIGRATION_STATUS.md S5 addendum) —
   *  present only on hosts with the migration ladder while the
   *  workspace has no data yet. */
  onMigrate?: () => void;
}

/** Variable-scope dropdown, mirroring the rule-type menu. Scope badges
 *  match the sidebar's Variables view; the collection entry is disabled
 *  with a tooltip since it can only be authored within a collection. */
function buildVariableScopeMenuItems(onCreateVariable: (scope: VariableCreateScope) => void): MenuProps['items'] {
  return [
    {
      key: 'environment',
      icon: scopeBadge('environment'),
      label: 'Environment variable',
      onClick: () => onCreateVariable('environment'),
    },
    {
      key: 'workspace',
      icon: scopeBadge('workspace'),
      label: 'Workspace variable',
      onClick: () => onCreateVariable('workspace'),
    },
    { key: 'live', icon: scopeBadge('live'), label: 'Live variable', onClick: () => onCreateVariable('live') },
    { key: 'vault', icon: scopeBadge('vault'), label: 'Vault secret', onClick: () => onCreateVariable('vault') },
    {
      key: 'collection',
      icon: scopeBadge('collection'),
      disabled: true,
      label: (
        <Tooltip title="Collection variables are created from within a collection.">
          {/* pointer-events kept on so the tooltip still fires over the disabled row */}
          <span style={{ pointerEvents: 'auto' }}>Collection variable</span>
        </Tooltip>
      ),
    },
  ];
}

interface ActionRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  description: string;
  showDescription: boolean;
  hasMenu?: boolean;
}

/**
 * One create gesture. A native button so it works both standalone
 * (`onClick`) and as an Ant `Dropdown` trigger (ref + injected handlers
 * flow through `...rest`).
 */
const ActionRow = forwardRef<HTMLButtonElement, ActionRowProps>(
  ({ icon, label, description, showDescription, hasMenu, className, ...rest }, ref) => (
    // `className` is merged, not overwritten — when this row is an Ant
    // `Dropdown` trigger, Ant clones it with its own `ant-dropdown-trigger`
    // class; dropping `oh-empty-action` here would strip the flex layout.
    <button type="button" className={`oh-empty-action${className ? ` ${className}` : ''}`} ref={ref} {...rest}>
      <span className="oh-empty-action-icon">{icon}</span>
      <span className="oh-empty-action-text">
        <span className="oh-empty-action-label">{label}</span>
        {showDescription && (
          <Text type="secondary" className="oh-empty-action-desc">
            {description}
          </Text>
        )}
      </span>
      {hasMenu && <RightOutlined className="oh-empty-action-chevron" aria-hidden="true" />}
    </button>
  ),
);
ActionRow.displayName = 'ActionRow';

/** Sticky footer row for the Create-rule menu — styled like a dropdown
 *  item but rendered outside the scroller so it never scrolls away. */
const BrowseTemplatesRow: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { token } = theme.useToken();
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        background: hover ? token.colorBgTextHover : 'transparent',
        borderRadius: token.borderRadiusSM,
        padding: '5px 12px',
        color: token.colorText,
        fontSize: token.fontSize,
      }}
    >
      {templatesBadge()}
      <span>Browse all templates…</span>
    </button>
  );
};

const EmptyState: React.FC<EmptyStateProps> = ({
  onCreateRule,
  onCreateRuleFromTemplate,
  onBrowseTemplates,
  onCreateRequest,
  onCreateWorkflow,
  onCreateVariable,
  onImport,
  onMigrate,
}) => {
  const showHints = useSettingValue('general.showEmptyStateHints');
  // Viewport fit for the two dropdown menus — caps each menu to the room
  // below its trigger so it shrinks + scrolls internally (persistent
  // scrollbar) instead of getting clipped on short windows.
  const ruleMenuFit = usePopoverViewportFit<HTMLButtonElement>();
  const variableMenuFit = usePopoverViewportFit<HTMLButtonElement>();
  // Controlled so the sticky "Browse all templates…" footer — which is
  // not an antd menu item — can close the dropdown when clicked.
  const [ruleMenuOpen, setRuleMenuOpen] = useState(false);
  return (
    <div className="oh-empty-state">
      <img src={hostAssets.resolveUrl('images/logo-pixel.svg')} alt="" aria-hidden="true" className="oh-empty-logo" />
      {/* Reserve the line the heading used to occupy so the logo keeps its
          breathing room above the actions. */}
      <div className="oh-empty-heading-spacer" aria-hidden="true" />
      <div className="oh-empty-actions">
        <Dropdown
          // Each templated rule type expands into Blank + its
          // templates — the onboarding path into a working rule (the
          // sidebar's template tree starts collapsed on a fresh
          // profile). The sticky "Browse all templates…" footer hands
          // off to the sidebar for exploration.
          menu={{ items: buildRuleTypeMenuItemsWithTemplates(onCreateRule, onCreateRuleFromTemplate) }}
          popupRender={(menu) => (
            <CappedMenuPopup
              menu={menu}
              maxHeight={ruleMenuFit.maxHeight}
              footer={
                <BrowseTemplatesRow
                  onClick={() => {
                    setRuleMenuOpen(false);
                    onBrowseTemplates();
                  }}
                />
              }
            />
          )}
          trigger={['click']}
          autoAdjustOverflow={false}
          open={ruleMenuOpen}
          onOpenChange={(open) => {
            setRuleMenuOpen(open);
            ruleMenuFit.onOpenChange(open);
          }}
        >
          <ActionRow
            ref={ruleMenuFit.triggerRef}
            icon={<RequestRulesIcon />}
            label="Create rule"
            description="Headers, redirects, blocking, and more"
            showDescription={showHints}
            hasMenu
          />
        </Dropdown>
        <Dropdown
          menu={{ items: buildVariableScopeMenuItems(onCreateVariable) }}
          popupRender={(menu) => <CappedMenuPopup menu={menu} maxHeight={variableMenuFit.maxHeight} />}
          trigger={['click']}
          autoAdjustOverflow={false}
          onOpenChange={variableMenuFit.onOpenChange}
        >
          <ActionRow
            ref={variableMenuFit.triggerRef}
            icon={<VariablesIcon />}
            label="Create variable"
            description="Environment, workspace, live, and more"
            showDescription={showHints}
            hasMenu
          />
        </Dropdown>
        <ActionRow
          icon={<ApiRequestsIcon />}
          label="Create API request"
          description="Build, send, and save HTTP requests"
          showDescription={showHints}
          onClick={onCreateRequest}
        />
        <ActionRow
          icon={<SisternodeOutlined />}
          label="Create workflow"
          description="Chain and schedule API requests"
          showDescription={showHints}
          onClick={onCreateWorkflow}
        />
        <ActionRow
          icon={<ImportOutlined />}
          label="Import"
          description="Curl, HAR, Postman, and more"
          showDescription={showHints}
          onClick={onImport}
        />
        {onMigrate && (
          <ActionRow
            icon={<SwapOutlined />}
            label="Migrate from another tool"
            description="Bring your Postman, Insomnia, or Bruno data"
            showDescription={showHints}
            onClick={onMigrate}
          />
        )}
      </div>
    </div>
  );
};

export default EmptyState;
