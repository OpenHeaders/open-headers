/**
 * AuthPoolSection — the container editor's Authorization section over
 * the whole auth POOL: the entries list (name · type · host scope ·
 * Default), add / set-default / delete per row, and the selected
 * entry's editor (name, `appliesTo` host pattern, the config through
 * AuthorizationTab). An empty pool renders the level-honest
 * transparent state — picking a type mints the first (default) entry,
 * exactly the pre-pool flow. A folder header names the inherited
 * collection default (Edit in collection / Override) or the override
 * (Reset to inherited). Pure draft surface: every gesture goes
 * through `onChange`; the container editor's one Save persists.
 */

import { EllipsisOutlined, PlusOutlined } from '@ant-design/icons';
import type { AuthConfig, AuthPoolEntry } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Input, Popconfirm, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import AuthorizationTab from '../request-editor/AuthorizationTab';
import { AuthLabeledRow } from '../request-editor/auth-layout';
import { authTypeLabelKey } from '../request-editor/inherited-auth';

const { Text } = Typography;

export interface AuthPoolDraft {
  auths: AuthPoolEntry[];
  defaultAuthUid?: string;
}

interface AuthPoolSectionProps {
  kind: 'collection' | 'folder';
  pool: AuthPoolDraft;
  onChange: (pool: AuthPoolDraft) => void;
  /** Folder only — the owning collection and its default entry, for
   *  the inherited / overriding header. `null` = no tree holds the
   *  folder yet. */
  inheritedCollection?: { uid: string; name: string; defaultEntry: AuthPoolEntry | null } | null;
  /** Opens the owning collection's Authorization section. */
  onEditInCollection?: (uid: string, name: string) => void;
}

/** The pool's effective default — `defaultAuthUid` when it names a
 *  live entry, else the first (the `authPoolOf` convention). */
function effectiveDefaultUid(pool: AuthPoolDraft): string | undefined {
  if (pool.auths.length === 0) return undefined;
  return pool.auths.some((e) => e.uid === pool.defaultAuthUid) ? pool.defaultAuthUid : pool.auths[0].uid;
}

const TRANSPARENT: AuthConfig = { type: 'inherit' };

const AuthPoolSection: React.FC<AuthPoolSectionProps> = ({
  kind,
  pool,
  onChange,
  inheritedCollection,
  onEditInCollection,
}) => {
  const { token } = theme.useToken();
  const t = useT();
  const [pickedUid, setPickedUid] = useState<string | null>(null);

  const defaultUid = effectiveDefaultUid(pool);
  const selected =
    pool.auths.find((e) => e.uid === pickedUid) ?? pool.auths.find((e) => e.uid === defaultUid) ?? pool.auths[0];

  const updateEntry = (uid: string, patch: (entry: AuthPoolEntry) => AuthPoolEntry) => {
    onChange({ ...pool, auths: pool.auths.map((e) => (e.uid === uid ? patch(e) : e)) });
  };

  const addEntry = () => {
    const uid = generateUid();
    onChange({
      auths: [...pool.auths, { uid, name: '', config: { type: 'none' } }],
      ...(pool.auths.length === 0 ? { defaultAuthUid: uid } : { defaultAuthUid: pool.defaultAuthUid }),
    });
    setPickedUid(uid);
  };

  const deleteEntry = (uid: string) => {
    const rest = pool.auths.filter((e) => e.uid !== uid);
    onChange({
      auths: rest,
      defaultAuthUid: uid === defaultUid ? rest[0]?.uid : pool.defaultAuthUid,
    });
    if (pickedUid === uid) setPickedUid(null);
  };

  // The type editor's transparent choice on the DEFAULT entry is the
  // "remove the default" gesture (the shipped semantic): the entry
  // leaves the pool, the next entry (if any) becomes the default.
  const handleConfig = (uid: string) => (auth: AuthConfig) => {
    if (auth.type === 'inherit') {
      deleteEntry(uid);
      return;
    }
    updateEntry(uid, (e) => ({ ...e, config: auth }));
  };

  // An empty pool: picking a type mints the first (default) entry.
  const handleFirstConfig = (auth: AuthConfig) => {
    if (auth.type === 'inherit') return;
    const uid = generateUid();
    onChange({ auths: [{ uid, name: '', config: auth }], defaultAuthUid: uid });
    setPickedUid(uid);
  };

  const overrideFromCollection = () => {
    const entry = inheritedCollection?.defaultEntry ?? null;
    if (entry === null) return;
    const uid = generateUid();
    onChange({
      auths: [{ ...entry, uid }],
      defaultAuthUid: uid,
    });
    setPickedUid(uid);
  };

  const folderHeader =
    kind === 'folder' && inheritedCollection != null ? (
      <div
        data-testid="oh-auth-pool-folder-header"
        style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
      >
        {pool.auths.length === 0 ? (
          <>
            <Text type="secondary">
              {t('workbench.editors.requestContainer.auth.inheritedFromCollection', {
                name: inheritedCollection.name,
              })}
            </Text>
            {onEditInCollection !== undefined && (
              <Button
                size="small"
                data-testid="oh-auth-pool-edit-in-collection"
                onClick={() => onEditInCollection(inheritedCollection.uid, inheritedCollection.name)}
              >
                {t('workbench.editors.requestContainer.auth.editInCollection')}
              </Button>
            )}
            {inheritedCollection.defaultEntry !== null && (
              <Button size="small" data-testid="oh-auth-pool-override" onClick={overrideFromCollection}>
                {t('workbench.editors.requestContainer.auth.override')}
              </Button>
            )}
          </>
        ) : (
          <>
            <Text type="secondary">
              {t('workbench.editors.requestContainer.auth.overridingCollection', { name: inheritedCollection.name })}
            </Text>
            <Popconfirm
              title={t('workbench.editors.requestContainer.auth.resetConfirm')}
              onConfirm={() => {
                onChange({ auths: [], defaultAuthUid: undefined });
                setPickedUid(null);
              }}
            >
              <Button size="small" data-testid="oh-auth-pool-reset">
                {t('workbench.editors.requestContainer.auth.resetToInherited')}
              </Button>
            </Popconfirm>
          </>
        )}
      </div>
    ) : null;

  if (pool.auths.length === 0 || selected === undefined) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {folderHeader}
        <AuthorizationTab auth={TRANSPARENT} level={kind} onChange={handleFirstConfig} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {folderHeader}
      <div data-testid="oh-auth-pool-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pool.auths.map((entry) => {
          const isSelected = entry.uid === selected.uid;
          const label = entry.name !== '' ? entry.name : t(authTypeLabelKey(entry.config.type));
          return (
            <div
              key={entry.uid}
              role="button"
              tabIndex={0}
              data-testid="oh-auth-pool-entry"
              data-uid={entry.uid}
              aria-pressed={isSelected}
              onClick={() => setPickedUid(entry.uid)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') setPickedUid(entry.uid);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 8px',
                borderRadius: token.borderRadiusSM,
                border: `1px solid ${isSelected ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
                background: isSelected ? token.colorPrimaryBg : 'transparent',
                cursor: 'pointer',
                maxWidth: 560,
              }}
            >
              <Text style={{ fontSize: 12 }} strong={isSelected}>
                {label}
              </Text>
              {entry.name !== '' && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t(authTypeLabelKey(entry.config.type))}
                </Text>
              )}
              {entry.appliesTo !== undefined && entry.appliesTo !== '' && (
                <Tag style={{ marginInlineEnd: 0, fontFamily: 'monospace', fontSize: 11 }}>{entry.appliesTo}</Tag>
              )}
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {entry.uid === defaultUid && (
                  <Tag color="blue" style={{ marginInlineEnd: 0 }} data-testid="oh-auth-pool-default-tag">
                    {t('workbench.editors.requestContainer.auth.defaultTag')}
                  </Tag>
                )}
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      {
                        key: 'default',
                        label: t('workbench.editors.requestContainer.auth.setDefault'),
                        disabled: entry.uid === defaultUid,
                        onClick: () => onChange({ ...pool, defaultAuthUid: entry.uid }),
                      },
                      {
                        key: 'delete',
                        label: t('workbench.editors.requestContainer.auth.deleteEntry'),
                        danger: true,
                        onClick: () => deleteEntry(entry.uid),
                      },
                    ],
                  }}
                >
                  <Button
                    size="small"
                    type="text"
                    icon={<EllipsisOutlined />}
                    aria-label={t('workbench.editors.requestContainer.auth.entryActionsAria')}
                    data-testid="oh-auth-pool-entry-actions"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              </span>
            </div>
          );
        })}
        <Button
          size="small"
          type="dashed"
          icon={<PlusOutlined />}
          onClick={addEntry}
          data-testid="oh-auth-pool-add"
          style={{ alignSelf: 'flex-start' }}
        >
          {t('workbench.editors.requestContainer.auth.addEntry')}
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AuthLabeledRow label={t('workbench.editors.requestContainer.auth.entryName')}>
          <Input
            size="small"
            value={selected.name}
            onChange={(e) => updateEntry(selected.uid, (entry) => ({ ...entry, name: e.target.value }))}
            placeholder={t('workbench.editors.requestContainer.auth.entryNamePlaceholder')}
            style={{ maxWidth: 320 }}
            data-testid="oh-auth-entry-name"
          />
        </AuthLabeledRow>
        <AuthLabeledRow label={t('workbench.editors.requestContainer.auth.appliesTo')}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Input
              size="small"
              value={selected.appliesTo ?? ''}
              onChange={(e) =>
                updateEntry(selected.uid, (entry) => {
                  const next = e.target.value;
                  if (next === '') {
                    const { appliesTo: _omit, ...rest } = entry;
                    return rest;
                  }
                  return { ...entry, appliesTo: next };
                })
              }
              placeholder={t('workbench.editors.requestContainer.auth.appliesToPlaceholder')}
              style={{ maxWidth: 320, fontFamily: 'monospace' }}
              data-testid="oh-auth-entry-applies-to"
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {t('workbench.editors.requestContainer.auth.appliesToHelp')}
            </Text>
          </div>
        </AuthLabeledRow>
        <AuthorizationTab
          auth={selected.config}
          level={kind}
          allowTransparent={selected.uid === defaultUid}
          onChange={handleConfig(selected.uid)}
        />
      </div>
    </div>
  );
};

export default AuthPoolSection;
