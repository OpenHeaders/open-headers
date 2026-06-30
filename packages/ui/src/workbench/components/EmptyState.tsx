/**
 * EmptyState — shown in an editor leaf with no open tabs. A minimalist
 * landing: a grayscale brand mark over the four primary "create"
 * gestures — rules (all types, via a dropdown), API requests, workflows,
 * and variables (all scopes, via a dropdown). Icons mirror the matching
 * sidebar tool windows so the actions read as shortcuts into those
 * surfaces.
 */

import { ApiOutlined, CodeOutlined, FileTextOutlined, RightOutlined, SisternodeOutlined } from '@ant-design/icons';
import { hostAssets } from '@openheaders/core/assets';
import { Dropdown, type MenuProps, Tooltip, Typography } from 'antd';
import type React from 'react';
import { forwardRef } from 'react';
import { buildRuleTypeMenuItems } from '../rule-type-menu';
import { useSettingValue } from '../settings/hooks';
import { scopeBadge } from './shared/scope-colors';

const { Text } = Typography;

/** Variable scopes a user can create from scratch here. Collection
 *  variables are excluded — they only exist inside a collection, so the
 *  menu offers them as a disabled, explained entry instead. */
export type VariableCreateScope = 'environment' | 'workspace' | 'live' | 'vault';

interface EmptyStateProps {
  onCreateRule: (type: string) => void;
  onCreateRequest: () => void;
  onCreateWorkflow: () => void;
  onCreateVariable: (scope: VariableCreateScope) => void;
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

const EmptyState: React.FC<EmptyStateProps> = ({
  onCreateRule,
  onCreateRequest,
  onCreateWorkflow,
  onCreateVariable,
}) => {
  const showHints = useSettingValue('general.showEmptyStateHints');
  return (
    <div className="oh-empty-state">
      <img src={hostAssets.resolveUrl('images/logo-pixel.svg')} alt="" aria-hidden="true" className="oh-empty-logo" />
      {/* Reserve the line the heading used to occupy so the logo keeps its
          breathing room above the actions. */}
      <div className="oh-empty-heading-spacer" aria-hidden="true" />
      <div className="oh-empty-actions">
        <Dropdown menu={{ items: buildRuleTypeMenuItems(onCreateRule) }} trigger={['click']}>
          <ActionRow
            icon={<FileTextOutlined />}
            label="Create rule"
            description="Headers, redirects, blocking, and more"
            showDescription={showHints}
            hasMenu
          />
        </Dropdown>
        <Dropdown menu={{ items: buildVariableScopeMenuItems(onCreateVariable) }} trigger={['click']}>
          <ActionRow
            icon={<CodeOutlined />}
            label="Create variable"
            description="Environment, workspace, live, and more"
            showDescription={showHints}
            hasMenu
          />
        </Dropdown>
        <ActionRow
          icon={<ApiOutlined />}
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
      </div>
    </div>
  );
};

export default EmptyState;
