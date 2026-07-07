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
  PlusOutlined,
  PushpinFilled,
  PushpinOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import type { Environment } from '@openheaders/core/types';
import type { InputRef } from 'antd';
import { Button, Divider, Dropdown, Input, Popover, Radio, Space, Tooltip, Typography, theme } from 'antd';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useEnvSwitcher } from '../../services/env-switcher';
import { useSetting } from '../../settings/hooks';
import { neutralScopeBadge, scopeBadge } from '../shared/scope-colors';

const { Text } = Typography;

// ── Row sub-components lifted to module scope so React reconciles
// them across re-renders without unmounting (fixes hovered-state flicker).

interface EnvRowProps {
  env: Environment;
  pinned: boolean;
  activeEnvironmentId: string | null;
  activeCollectionId: string | null;
  activeCollectionDefaultEnvId: string | null;
  /** True when the focused tab can carry an env pin — renders the
   *  "Pin to this tab" row action. */
  tabPinnable: boolean;
  /** True when this env is the focused tab's pin. */
  tabPinned: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onTogglePin: () => void;
  onSetDefault: () => void;
  onToggleTabPin: () => void;
}

const EnvRow: React.FC<EnvRowProps> = ({
  env,
  pinned,
  activeEnvironmentId,
  activeCollectionId,
  activeCollectionDefaultEnvId,
  tabPinnable,
  tabPinned,
  onSelect,
  onOpen,
  onTogglePin,
  onSetDefault,
  onToggleTabPin,
}) => {
  const { token } = theme.useToken();
  const isActive = env.uid === activeEnvironmentId;
  const isDefault = env.uid === activeCollectionDefaultEnvId;
  const anyPinned = tabPinned || pinned;
  const showPinAction = tabPinnable || activeCollectionId !== null;

  // Pin colors carry the target: tab pin = primary (same as the tab
  // glyph and the topbar trigger), collection pin = the collection
  // scope gold (same as the "C" badge). Both active → both small pins
  // side by side so the collapsed state stays unambiguous.
  const tabPinColor = token.colorPrimary;
  const collectionPinColor = 'var(--scope-collection-pin)';
  const collapsedPinGlyph =
    tabPinned && pinned ? (
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        <PushpinFilled style={{ fontSize: 10, color: tabPinColor }} />
        <PushpinFilled style={{ fontSize: 10, color: collectionPinColor, marginLeft: -3 }} />
      </span>
    ) : tabPinned ? (
      <PushpinFilled style={{ fontSize: 12, color: tabPinColor }} />
    ) : pinned ? (
      <PushpinFilled style={{ fontSize: 12, color: collectionPinColor }} />
    ) : (
      <PushpinOutlined style={{ fontSize: 12, color: token.colorTextTertiary }} />
    );

  // One row inside the pin flyout — "Pin to this tab" / "Pin to
  // collection" share the layout; a target-colored check marks the
  // active one.
  const pinMenuRow = (
    label: string,
    description: string,
    checked: boolean,
    checkColor: string,
    onClick: () => void,
  ) => (
    <div
      role="menuitem"
      className="oh-env-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 8px',
        cursor: 'pointer',
        borderRadius: token.borderRadiusSM,
      }}
      onClick={onClick}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, lineHeight: 1.3 }}>{label}</div>
        <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3, display: 'block', marginTop: 1 }}>
          {description}
        </Text>
      </div>
      {checked && <CheckCircleFilled style={{ fontSize: 12, color: checkColor, flexShrink: 0 }} />}
    </div>
  );

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
        {showPinAction && (
          <Popover
            trigger="hover"
            placement="bottomRight"
            // Fixed side — auto-flip made the flyout jump between above
            // and below the row depending on viewport space, which reads
            // as inconsistent. The flyout is small; bottom always fits.
            autoAdjustOverflow={false}
            arrow={false}
            getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
            content={
              <div style={{ padding: 2, width: 240 }} onClick={(e) => e.stopPropagation()}>
                {tabPinnable &&
                  pinMenuRow(
                    tabPinned ? 'Unpin from this tab' : 'Pin to this tab',
                    'Switches to this environment whenever the tab is focused.',
                    tabPinned,
                    tabPinColor,
                    onToggleTabPin,
                  )}
                {activeCollectionId &&
                  pinMenuRow(
                    pinned ? 'Unpin from collection' : 'Pin to collection',
                    'Shows this environment in the collection’s pinned list.',
                    pinned,
                    collectionPinColor,
                    onTogglePin,
                  )}
              </div>
            }
          >
            <span
              role="button"
              tabIndex={-1}
              aria-label="Pin environment"
              className="oh-env-row-action"
              style={anyPinned ? { opacity: 1 } : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {collapsedPinGlyph}
            </span>
          </Popover>
        )}
        {activeCollectionId && (
          <>
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
      {neutralScopeBadge('environment', 14)}
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
  /** Opens the Live Variables list. Optional — the footer's "Live"
   *  segment renders only where the host wires it (workbench). */
  onOpenLiveVariables?: () => void;
  onSetCollectionPinnedEnvs: (collectionUid: string, pinnedIds: string[], defaultId: string | null) => Promise<boolean>;
  /** Compact trigger — matches the devpanel toolbar's 24px workspace chip. */
  compact?: boolean;
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
  onOpenLiveVariables,
  onSetCollectionPinnedEnvs,
  compact = false,
}) => {
  const { token } = theme.useToken();
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchRef = useRef<InputRef>(null);
  const [autoSwitchMode, setAutoSwitchMode] = useSetting('general.collectionEnvAutoSwitch');

  // Other surfaces (Scope panel's "Select") open this dropdown through
  // the env-switcher service instead of mounting a picker of their own.
  const { onEnvSelectorOpenRequest, activeTabEnvPinnable, activeTabPinnedEnvId, setActiveTabPinnedEnv } =
    useEnvSwitcher();
  useEffect(() => onEnvSelectorOpenRequest(() => setOpen(true)), [onEnvSelectorOpenRequest]);

  // The focused tab pins the env — the trigger and dropdown surface it
  // so a tab-driven env change is legible ("why did the env just flip?").
  const pinnedByTab = activeTabPinnedEnvId !== undefined;

  function handleToggleTabPin(env: Environment): void {
    // Toggling on takes over the active env immediately (the switcher's
    // auto-switch effect applies the new pin); toggling off falls back
    // to normal collection-mode resolution.
    setActiveTabPinnedEnv(activeTabPinnedEnvId === env.uid ? undefined : env.uid);
  }

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

  // One segment of the compact scope-shortcut row (Vault | Collection |
  // Workspace | Live) — equal-width, centered, same hover treatment as
  // full rows.
  const footerSegment = (scope: 'vault' | 'collection' | 'workspace' | 'live', label: string, onClick: () => void) => (
    <div
      role="menuitem"
      className="oh-env-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        // Equal-width segments that never wrap: the nowrap label sets
        // each segment's min-content, so a crowded row widens the
        // shrink-to-fit popup instead of breaking words.
        flex: 1,
        whiteSpace: 'nowrap',
        padding: '5px 8px',
        cursor: 'pointer',
        borderRadius: token.borderRadiusSM,
        color: token.colorTextSecondary,
      }}
      onClick={() => {
        onClick();
        handleClose();
      }}
    >
      {scopeBadge(scope, 14)}
      <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{label}</Text>
    </div>
  );

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

      {pinnedByTab && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px 5px',
            userSelect: 'none',
          }}
        >
          <PushpinFilled style={{ fontSize: 11, color: token.colorPrimary, flexShrink: 0 }} />
          <Text type="secondary" style={{ fontSize: 11, flex: 1, lineHeight: 1.3 }}>
            Pinned to the current tab — picking an environment moves the pin.
          </Text>
          <Button
            type="link"
            size="small"
            style={{ fontSize: 11, padding: 0, height: 'auto' }}
            onClick={() => setActiveTabPinnedEnv(undefined)}
          >
            Unpin
          </Button>
        </div>
      )}

      <NoEnvRow
        activeEnvironmentId={activeEnvironmentId}
        onSelect={() => {
          onSwitch(null);
          handleClose();
        }}
      />

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
        <Text style={{ fontSize: 13 }}>Create new environment</Text>
      </div>

      {hasPinnedSection ? (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <div style={sectionLabelStyle}>Pinned to this collection</div>
          {/* Cap each section at ~3 rows; taller lists scroll. Each row
           *  is ~32px (5px padding × 2 + 22px content). */}
          <div className="oh-env-scroll" style={{ maxHeight: 108 }}>
            {pinnedEnvs.map((env) => (
              <EnvRow
                key={env.uid}
                env={env}
                pinned={true}
                activeEnvironmentId={activeEnvironmentId}
                activeCollectionId={activeCollectionId}
                activeCollectionDefaultEnvId={activeCollectionDefaultEnvId}
                tabPinnable={activeTabEnvPinnable}
                tabPinned={activeTabPinnedEnvId === env.uid}
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
                onToggleTabPin={() => handleToggleTabPin(env)}
              />
            ))}
          </div>
          {otherEnvs.length > 0 && (
            <>
              <Divider style={{ margin: '4px 0' }} />
              <div style={sectionLabelStyle}>Other environments</div>
              <div className="oh-env-scroll" style={{ maxHeight: 108 }}>
                {otherEnvs.map((env) => (
                  <EnvRow
                    key={env.uid}
                    env={env}
                    pinned={false}
                    activeEnvironmentId={activeEnvironmentId}
                    activeCollectionId={activeCollectionId}
                    activeCollectionDefaultEnvId={activeCollectionDefaultEnvId}
                    tabPinnable={activeTabEnvPinnable}
                    tabPinned={activeTabPinnedEnvId === env.uid}
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
                    onToggleTabPin={() => handleToggleTabPin(env)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          {filteredEnvs.length > 0 && <Divider style={{ margin: '4px 0' }} />}
          <div className="oh-env-scroll" style={{ maxHeight: 108 }}>
            {filteredEnvs.map((env) => (
              <EnvRow
                key={env.uid}
                env={env}
                pinned={false}
                activeEnvironmentId={activeEnvironmentId}
                activeCollectionId={activeCollectionId}
                activeCollectionDefaultEnvId={activeCollectionDefaultEnvId}
                tabPinnable={activeTabEnvPinnable}
                tabPinned={activeTabPinnedEnvId === env.uid}
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
                onToggleTabPin={() => handleToggleTabPin(env)}
              />
            ))}
          </div>
        </>
      )}

      <Divider style={{ margin: '4px 0' }} />
      {/* Compact scope shortcuts — one row, segments split by vertical
          dividers (Vault | Collection | Workspace | Live). Collection
          joins only while a collection is active; Live only where the
          host wires an opener (workbench; the devpanel routes by
          intent and has none for the LV list yet). */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {footerSegment('vault', 'Vault', onOpenVault)}
        {activeCollectionId && (
          <>
            <Divider type="vertical" style={{ height: 'auto', margin: '4px 0', alignSelf: 'stretch' }} />
            {footerSegment('collection', 'Collection', onOpenCollectionVariables)}
          </>
        )}
        <Divider type="vertical" style={{ height: 'auto', margin: '4px 0', alignSelf: 'stretch' }} />
        {footerSegment('workspace', 'Workspace', onOpenWorkspaceVariables)}
        {onOpenLiveVariables && (
          <>
            <Divider type="vertical" style={{ height: 'auto', margin: '4px 0', alignSelf: 'stretch' }} />
            {footerSegment('live', 'Live', onOpenLiveVariables)}
          </>
        )}
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
        aria-label={
          active
            ? `Active environment: ${active.name}${pinnedByTab ? ' (pinned by this tab)' : ''}`
            : `No environment selected${pinnedByTab ? ' (pinned by this tab)' : ''}`
        }
        style={{
          padding: '0 8px',
          height: compact ? 24 : 28,
          display: 'inline-flex',
          alignItems: 'center',
        }}
      >
        <Space size={compact ? 4 : 6}>
          {pinnedByTab && <PushpinFilled style={{ fontSize: 10, color: token.colorPrimary }} />}
          {/* Optical lift: flex centers the badge against the text's full
            * line box (descender leading included), so a mathematically
            * centered badge reads low next to the cap glyphs. Relative
            * offset, not margin — margin on the sole child of a centered
            * flex item is swallowed by re-centering. */}
          <span style={{ display: 'inline-flex', position: 'relative', top: -1 }}>
            {active ? scopeBadge('environment', 12) : neutralScopeBadge('environment', 12)}
          </span>
          <Text
            style={{
              maxWidth: compact ? 120 : 140,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: active ? token.colorText : token.colorTextSecondary,
              fontSize: compact ? 12 : 13,
            }}
          >
            {active?.name ?? 'No environment'}
          </Text>
          <DownOutlined style={{ fontSize: compact ? 9 : 10, color: token.colorTextTertiary }} />
        </Space>
      </Button>
    </Dropdown>
  );
};

export default EnvironmentSelector;
