/**
 * EnvironmentSelector — TopBar dropdown for switching the active
 * environment. Supports collection-context pinned envs + override
 * persistence. "No environment" is a valid choice.
 */

import {
  CheckOutlined,
  DownOutlined,
  FolderOpenFilled,
  GlobalOutlined,
  PlusOutlined,
  PushpinFilled,
  PushpinTwoTone,
  SettingOutlined,
} from '@ant-design/icons';
import type { V5 } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import { Button, Divider, Dropdown, Input, Space, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { scopeBadge } from './shared/scope-colors';

const { Text } = Typography;

// ── Row sub-components lifted to module scope so React reconciles
// them across re-renders without unmounting (fixes hovered-state flicker).

interface EnvRowProps {
  env: V5.Environment;
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
      className="oh-env-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        cursor: 'pointer',
        borderRadius: token.borderRadiusSM,
        minWidth: 220,
      }}
      onClick={onSelect}
    >
      <span style={{ width: 14, flexShrink: 0 }}>
        {isActive && <CheckOutlined style={{ fontSize: 12, color: token.colorPrimary }} />}
      </span>
      {scopeBadge('environment', 14)}
      <Text style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
        {env.name}
      </Text>
      {isDefault && (
        <Text
          style={{
            fontSize: 10,
            color: token.colorTextTertiary,
            flexShrink: 0,
          }}
        >
          DEFAULT
        </Text>
      )}
      <Space size={2} className="oh-env-row-actions" style={{ flexShrink: 0 }}>
        <Tooltip title={`Open ${env.name}`} placement="top" mouseEnterDelay={0.5}>
          <Button
            size="small"
            type="text"
            icon={<SettingOutlined style={{ fontSize: 11 }} />}
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            aria-label={`Open ${env.name}`}
            style={{ padding: '0 2px', height: 20, minWidth: 20 }}
          />
        </Tooltip>
        {activeCollectionId && (
          <>
            <Tooltip title={pinned ? 'Unpin from collection' : 'Pin to collection'} placement="top" mouseEnterDelay={0.5}>
              <Button
                size="small"
                type="text"
                icon={
                  pinned ? (
                    <PushpinFilled style={{ fontSize: 11, color: token.colorPrimary }} />
                  ) : (
                    <PushpinTwoTone style={{ fontSize: 11 }} />
                  )
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin();
                }}
                aria-label={pinned ? 'Unpin from collection' : 'Pin to collection'}
                style={{ padding: '0 2px', height: 20, minWidth: 20 }}
              />
            </Tooltip>
            {pinned && (
              <Tooltip title={isDefault ? 'Clear collection default' : 'Set as collection default'} placement="top" mouseEnterDelay={0.5}>
                <Button
                  size="small"
                  type="text"
                  icon={
                    <FolderOpenFilled
                      style={{ fontSize: 11, color: isDefault ? token.colorPrimary : token.colorTextTertiary }}
                    />
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetDefault();
                  }}
                  aria-label={isDefault ? 'Clear collection default' : 'Set as collection default'}
                  style={{ padding: '0 2px', height: 20, minWidth: 20 }}
                />
              </Tooltip>
            )}
          </>
        )}
      </Space>
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px',
        cursor: 'pointer',
        borderRadius: token.borderRadiusSM,
        minWidth: 220,
        background: hovered ? token.colorBgTextHover : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      <span style={{ width: 14, flexShrink: 0 }}>
        {isActive && <CheckOutlined style={{ fontSize: 12, color: token.colorPrimary }} />}
      </span>
      <GlobalOutlined style={{ fontSize: 14, color: token.colorTextQuaternary }} />
      <Text style={{ flex: 1, color: token.colorTextSecondary, fontSize: 13 }}>No environment</Text>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────

interface EnvironmentSelectorProps {
  environments: V5.Environment[];
  activeEnvironmentId: string | null;
  activeCollectionId: string | null;
  activeCollectionPinnedEnvIds: string[];
  activeCollectionDefaultEnvId: string | null;
  onSwitch: (uid: string | null) => void;
  onCreateEnvironment: () => void;
  onOpenEnvironment: (uid: string) => void;
  onOpenWorkspaceVariables: () => void;
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
  onOpenVault,
  onSetCollectionPinnedEnvs,
}) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const searchRef = useRef<InputRef>(null);

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

  function handleTogglePin(env: V5.Environment, currentlyPinned: boolean): void {
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

  function handleSetDefault(env: V5.Environment): void {
    if (!activeCollectionId) return;
    const isCurrentDefault = activeCollectionDefaultEnvId === env.uid;
    const nextDefault = isCurrentDefault ? null : env.uid;
    void onSetCollectionPinnedEnvs(activeCollectionId, activeCollectionPinnedEnvIds, nextDefault);
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
      <div style={{ padding: '0 4px 6px' }}>
        <Input
          ref={searchRef}
          size="small"
          placeholder="Search environments…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          style={{ fontSize: 12 }}
          autoFocus
        />
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
          {otherEnvs.length > 0 && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <div style={sectionLabelStyle}>Other environments</div>
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
            </>
          )}
        </>
      ) : (
        <>
          {filteredEnvs.length > 0 && <Divider style={{ margin: '4px 0' }} />}
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
        </>
      )}

      <Divider style={{ margin: '4px 0' }} />
      <div
        role="menuitem"
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
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          onOpenWorkspaceVariables();
          handleClose();
        }}
      >
        {scopeBadge('workspace', 14)}
        <Text style={{ fontSize: 13 }}>Workspace variables…</Text>
      </div>
      <div
        role="menuitem"
        style={{ ...rowStyle, color: token.colorTextSecondary }}
        onClick={() => {
          onOpenVault();
          handleClose();
        }}
      >
        {scopeBadge('vault', 14)}
        <Text style={{ fontSize: 13 }}>Vault…</Text>
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
        type="text"
        size="small"
        aria-label={active ? `Active environment: ${active.name}` : 'No environment selected'}
        style={{
          padding: '0 8px',
          height: 28,
          display: 'inline-flex',
          alignItems: 'center',
          border: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
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
