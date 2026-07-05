/**
 * EnvironmentSelector — TopBar dropdown for switching the active
 * environment. Supports collection-context pinned envs + override
 * persistence. "No environment" is a valid choice.
 */

import {
  CheckCircleFilled,
  DownOutlined,
  EditOutlined,
  FolderOpenFilled,
  FolderOpenOutlined,
  GlobalOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { Environment } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import { Button, Divider, Dropdown, Input, Popover, Radio, Space, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useSetting } from '../../settings/hooks';
import { scopeBadge } from '../shared/scope-colors';

const { Text } = Typography;

// ── Row sub-components lifted to module scope so React reconciles
// them across re-renders without unmounting (fixes hovered-state flicker).

interface EnvRowProps {
  env: Environment;
  pinned: boolean;
  activeEnvironmentId: string | null;
  activeCollectionId: string | null;
  activeCollectionDefaultEnvId: string | null;
  onSelect: () => void;
  onOpen: () => void;
  onTogglePin: () => void;
  onSetDefault: () => void;
}

const EnvRow: React.FC<EnvRowProps> = ({
  env,
  pinned,
  activeEnvironmentId,
  activeCollectionId,
  activeCollectionDefaultEnvId,
  onSelect,
  onOpen,
  onTogglePin,
  onSetDefault,
}) => {
  const { token } = theme.useToken();
  const isActive = env.uid === activeEnvironmentId;
  const isDefault = env.uid === activeCollectionDefaultEnvId;

  return (
    <div
      role="menuitem"
      aria-current={isActive ? 'true' : undefined}
      className="oh-env-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        cursor: 'pointer',
        borderRadius: token.borderRadiusSM,
        minWidth: 220,
        ...(isActive
          ? {
              background: token.colorPrimaryBg,
              color: token.colorPrimaryText,
            }
          : null),
      }}
      onClick={onSelect}
    >
      {scopeBadge('environment', 14)}
      <Text
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
          color: 'inherit',
          fontWeight: isActive ? 500 : 400,
        }}
      >
        {env.name}
      </Text>
      {isActive && (
        <CheckCircleFilled style={{ fontSize: 14, color: token.colorPrimary, flexShrink: 0 }} />
      )}
      {isDefault && (
        <Tooltip title="Default environment is auto-selected while working with the collection." placement="top">
          <Text
            style={{
              fontSize: 10,
              color: isActive ? token.colorPrimaryText : token.colorTextTertiary,
              flexShrink: 0,
              cursor: 'help',
              letterSpacing: 0.5,
            }}
          >
            DEFAULT
          </Text>
        </Tooltip>
      )}
      <div className="oh-env-row-actions">
        <Tooltip title={`Open ${env.name}`} placement="top" mouseEnterDelay={0.5}>
          <span
            role="button"
            tabIndex={-1}
            aria-label={`Open ${env.name}`}
            className="oh-env-row-action"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            <EditOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
          </span>
        </Tooltip>
        {activeCollectionId && (
          <>
            <Tooltip
              title={pinned ? 'Unpin from collection' : 'Pin to collection'}
              placement="top"
              mouseEnterDelay={0.5}
            >
              <span
                role="button"
                tabIndex={-1}
                aria-label={pinned ? 'Unpin from collection' : 'Pin to collection'}
                className="oh-env-row-action"
                style={pinned ? { opacity: 1 } : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
              >
                {pinned ? (
                  <PushpinFilled style={{ fontSize: 12, color: token.colorPrimary }} />
                ) : (
                  <PushpinOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                )}
              </span>
            </Tooltip>
            <Tooltip
              title={isDefault ? 'Clear collection default' : 'Set as collection default'}
              placement="top"
              mouseEnterDelay={0.5}
            >
              <span
                role="button"
                tabIndex={-1}
                aria-label={isDefault ? 'Clear collection default' : 'Set as collection default'}
                className="oh-env-row-action"
                style={isDefault ? { opacity: 1 } : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onSetDefault();
                }}
              >
                {isDefault ? (
                  <FolderOpenFilled style={{ fontSize: 12, color: token.colorPrimary }} />
                ) : (
                  <FolderOpenOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
                )}
              </span>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
};

interface NoEnvRowProps {
  activeEnvironmentId: string | null;
  onSelect: () => void;
}

const NoEnvRow: React.FC<NoEnvRowProps> = ({ activeEnvironmentId, onSelect }) => {
  const { token } = theme.useToken();
  const [hovered, setHovered] = useState(false);
  const isActive = activeEnvironmentId === null;

  return (
    <div
      role="menuitem"
      aria-current={isActive ? 'true' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        cursor: 'pointer',
        borderRadius: token.borderRadiusSM,
        minWidth: 220,
        ...(isActive
          ? {
              background: token.colorPrimaryBg,
              color: token.colorPrimaryText,
            }
          : { background: hovered ? token.colorBgTextHover : 'transparent' }),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      <GlobalOutlined
        style={{ fontSize: 14, color: isActive ? token.colorPrimaryText : token.colorTextQuaternary }}
      />
      <Text
        style={{
          flex: 1,
          color: isActive ? 'inherit' : token.colorTextSecondary,
          fontSize: 13,
          fontWeight: isActive ? 500 : 400,
        }}
      >
        No environment
      </Text>
      {isActive && (
        <CheckCircleFilled style={{ fontSize: 14, color: token.colorPrimary, flexShrink: 0 }} />
      )}
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────

interface EnvironmentSelectorProps {
  environments: Environment[];
  activeEnvironmentId: string | null;
  activeCollectionId: string | null;
  activeCollectionPinnedEnvIds: string[];
  activeCollectionDefaultEnvId: string | null;
  onSwitch: (uid: string | null) => void;
  onCreateEnvironment: () => void;
  onOpenEnvironment: (uid: string) => void;
  onOpenWorkspaceVariables: () => void;
  onOpenCollectionVariables: () => void;
  onOpenVault: () => void;
  onSetCollectionPinnedEnvs: (collectionUid: string, pinnedIds: string[], defaultId: string | null) => Promise<boolean>;
}

const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  environments,
  activeEnvironmentId,
  activeCollectionId,
  activeCollectionPinnedEnvIds,
  activeCollectionDefaultEnvId,
  onSwitch,
  onCreateEnvironment,
  onOpenEnvironment,
  onOpenWorkspaceVariables,
  onOpenCollectionVariables,
  onOpenVault,
  onSetCollectionPinnedEnvs,
}) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef<InputRef>(null);
  const [autoSwitchMode, setAutoSwitchMode] = useSetting('general.collectionEnvAutoSwitch');

  const active = activeEnvironmentId ? (environments.find((e) => e.uid === activeEnvironmentId) ?? null) : null;

  const filteredEnvs = useMemo(() => {
    const q = searchText.toLowerCase().trim();
    if (!q) return environments;
    return environments.filter((e) => e.name.toLowerCase().includes(q));
  }, [environments, searchText]);

  const pinnedSet = new Set(activeCollectionPinnedEnvIds);

  const pinnedEnvs = useMemo(
    () => filteredEnvs.filter((e) => pinnedSet.has(e.uid)),
    [filteredEnvs, activeCollectionPinnedEnvIds],
  );
  const otherEnvs = useMemo(
    () => filteredEnvs.filter((e) => !pinnedSet.has(e.uid)),
    [filteredEnvs, activeCollectionPinnedEnvIds],
  );

  const hasPinnedSection = activeCollectionId !== null && pinnedEnvs.length > 0;

  function handleTogglePin(env: Environment, currentlyPinned: boolean): void {
    if (!activeCollectionId) return;
    let nextPinned: string[];
    let nextDefault: string | null = activeCollectionDefaultEnvId;
    if (currentlyPinned) {
      nextPinned = activeCollectionPinnedEnvIds.filter((id) => id !== env.uid);
      if (nextDefault === env.uid) nextDefault = null;
    } else {
      nextPinned = [...activeCollectionPinnedEnvIds, env.uid];
    }
    void onSetCollectionPinnedEnvs(activeCollectionId, nextPinned, nextDefault);
  }

  function handleSetDefault(env: Environment): void {
    if (!activeCollectionId) return;
    const isCurrentDefault = activeCollectionDefaultEnvId === env.uid;
    const nextDefault = isCurrentDefault ? null : env.uid;
    const nextPinned =
      !isCurrentDefault && !activeCollectionPinnedEnvIds.includes(env.uid)
        ? [...activeCollectionPinnedEnvIds, env.uid]
        : activeCollectionPinnedEnvIds;
    void onSetCollectionPinnedEnvs(activeCollectionId, nextPinned, nextDefault);
  }

  function handleClose(): void {
    setOpen(false);
    setSearchText('');
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    cursor: 'pointer',
    borderRadius: token.borderRadiusSM,
    minWidth: 220,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    color: token.colorTextTertiary,
    padding: '4px 8px 2px',
    userSelect: 'none',
  };

  const dropdownContent = (
    <div
      style={{
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: '6px 4px',
        minWidth: 340,
        maxWidth: 480,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '0 4px 6px', display: 'flex', alignItems: 'center', gap: 4 }}>
        <Input
          ref={searchRef}
          size="small"
          placeholder="Search environments…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ fontSize: 12, flex: 1 }}
          autoFocus
        />
        <Text type="secondary" style={{ fontSize: 11, userSelect: 'none' }}>
          Mode: {autoSwitchMode}
        </Text>
        <Popover
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          trigger="click"
          placement="bottomRight"
          arrow={false}
          getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
          content={
            <div style={{ padding: 2, width: 320 }} onClick={(e) => e.stopPropagation()}>
              <Text strong style={{ display: 'block', padding: '4px 8px 6px', fontSize: 12 }}>
                When switching between collections
              </Text>
              <div
                className="oh-env-row"
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: token.borderRadiusSM,
                }}
                onClick={() => {
                  setAutoSwitchMode('keep-selection');
                  setSettingsOpen(false);
                }}
              >
                <Radio
                  checked={autoSwitchMode === 'keep-selection'}
                  style={{ marginRight: 0, pointerEvents: 'none' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.3 }}>Keep selected environment</div>
                  <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                    Your selection stays put across collections and everything inside them.
                  </Text>
                </div>
              </div>
              <div
                className="oh-env-row"
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: token.borderRadiusSM,
                }}
                onClick={() => {
                  setAutoSwitchMode('apply-defaults');
                  setSettingsOpen(false);
                }}
              >
                <Radio
                  checked={autoSwitchMode === 'apply-defaults'}
                  style={{ marginRight: 0, pointerEvents: 'none' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.3 }}>Apply collection defaults</div>
                  <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                    Defaults take over while inside. Your last manual pick is restored elsewhere.
                  </Text>
                </div>
              </div>
              <div
                className="oh-env-row"
                style={{
                  display: 'flex',
                  gap: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  borderRadius: token.borderRadiusSM,
                }}
                onClick={() => {
                  setAutoSwitchMode('follow-collection');
                  setSettingsOpen(false);
                }}
              >
                <Radio
                  checked={autoSwitchMode === 'follow-collection'}
                  style={{ marginRight: 0, pointerEvents: 'none' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, lineHeight: 1.3 }}>Follow each collection</div>
                  <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3, display: 'block', marginTop: 2 }}>
                    Collections with a default switch to it (and remember your picks). Others don't switch.
                  </Text>
                </div>
              </div>
            </div>
          }
        >
          <Tooltip title="Environment switching behavior" placement="top" mouseEnterDelay={0.3}>
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />}
              aria-label="Environment switching behavior"
            />
          </Tooltip>
        </Popover>
      </div>

      <NoEnvRow
        activeEnvironmentId={activeEnvironmentId}
        onSelect={() => {
          onSwitch(null);
          handleClose();
        }}
      />

      {hasPinnedSection ? (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <div style={sectionLabelStyle}>Pinned to this collection</div>
          {/* Cap each section at ~3 rows; taller lists scroll. Each row
           *  is ~32px (5px padding × 2 + 22px content). */}
          <div style={{ maxHeight: 108, overflowY: 'auto' }}>
            {pinnedEnvs.map((env) => (
              <EnvRow
                key={env.uid}
                env={env}
                pinned={true}
                activeEnvironmentId={activeEnvironmentId}
                activeCollectionId={activeCollectionId}
                activeCollectionDefaultEnvId={activeCollectionDefaultEnvId}
                onSelect={() => {
                  onSwitch(env.uid);
                  handleClose();
                }}
                onOpen={() => {
                  onOpenEnvironment(env.uid);
                  handleClose();
                }}
                onTogglePin={() => handleTogglePin(env, true)}
                onSetDefault={() => handleSetDefault(env)}
              />
            ))}
          </div>
          {otherEnvs.length > 0 && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <div style={sectionLabelStyle}>Other environments</div>
              <div style={{ maxHeight: 108, overflowY: 'auto' }}>
                {otherEnvs.map((env) => (
                  <EnvRow
                    key={env.uid}
                    env={env}
                    pinned={false}
                    activeEnvironmentId={activeEnvironmentId}
                    activeCollectionId={activeCollectionId}
                    activeCollectionDefaultEnvId={activeCollectionDefaultEnvId}
                    onSelect={() => {
                      onSwitch(env.uid);
                      handleClose();
                    }}
                    onOpen={() => {
                      onOpenEnvironment(env.uid);
                      handleClose();
                    }}
                    onTogglePin={() => handleTogglePin(env, false)}
                    onSetDefault={() => handleSetDefault(env)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {filteredEnvs.length > 0 && <Divider style={{ margin: '4px 0' }} />}
          <div style={{ maxHeight: 108, overflowY: 'auto' }}>
            {filteredEnvs.map((env) => (
              <EnvRow
                key={env.uid}
                env={env}
                pinned={false}
                activeEnvironmentId={activeEnvironmentId}
                activeCollectionId={activeCollectionId}
                activeCollectionDefaultEnvId={activeCollectionDefaultEnvId}
                onSelect={() => {
                  onSwitch(env.uid);
                  handleClose();
                }}
                onOpen={() => {
                  onOpenEnvironment(env.uid);
                  handleClose();
                }}
                onTogglePin={() => handleTogglePin(env, false)}
                onSetDefault={() => handleSetDefault(env)}
              />
            ))}
          </div>
        </>
      )}

      <Divider style={{ margin: '4px 0' }} />
      <div
        role="menuitem"
        className="oh-env-row"
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          onCreateEnvironment();
          handleClose();
        }}
      >
        <PlusOutlined style={{ fontSize: 12 }} />
        <Text style={{ fontSize: 13 }}>New environment</Text>
      </div>
      <div
        role="menuitem"
        className="oh-env-row"
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          onOpenVault();
          handleClose();
        }}
      >
        {scopeBadge('vault', 14)}
        <Text style={{ fontSize: 13 }}>Vault</Text>
      </div>
      {activeCollectionId && (
        <div
          role="menuitem"
          className="oh-env-row"
          style={{ ...rowStyle, color: token.colorTextSecondary }}
          onClick={() => {
            onOpenCollectionVariables();
            handleClose();
          }}
        >
          {scopeBadge('collection', 14)}
          <Text style={{ fontSize: 13 }}>Collection variables</Text>
        </div>
      )}
      <div
        role="menuitem"
        className="oh-env-row"
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          onOpenWorkspaceVariables();
          handleClose();
        }}
      >
        {scopeBadge('workspace', 14)}
        <Text style={{ fontSize: 13 }}>Workspace variables</Text>
      </div>
    </div>
  );

  return (
    <Dropdown
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearchText('');
      }}
      popupRender={() => dropdownContent}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button
        size="small"
        aria-label={active ? `Active environment: ${active.name}` : 'No environment selected'}
        style={{
          padding: '0 8px',
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <Space size={6}>
          {active ? (
            scopeBadge('environment', 12)
          ) : (
            <GlobalOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
          )}
          <Text
            style={{
              maxWidth: 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: active ? token.colorText : token.colorTextSecondary,
              fontSize: 13,
            }}
          >
            {active?.name ?? 'No environment'}
          </Text>
          <DownOutlined style={{ fontSize: 10, color: token.colorTextTertiary }} />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default EnvironmentSelector;
