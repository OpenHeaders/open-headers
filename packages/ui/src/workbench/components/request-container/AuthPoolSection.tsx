/**
 * AuthPoolSection — the container editor's Authorization section over
 * the whole auth POOL, in three states:
 *   • no pool anywhere — the empty state (a type card grid; a click
 *     mints the first, default entry);
 *   • an own pool — the two panels: the entries list with `+` (a type
 *     dropdown), Make default / Rename / Delete per row, and the
 *     selected entry's pane;
 *   • a folder inheriting — the nearest ancestor's pool in the same
 *     two panels, read-only, with Change (a type dropdown that mints
 *     the folder's own first entry) and Edit in the source.
 * Pure draft surface: every gesture goes through `onChange`; the
 * container editor's one Save persists. Nothing is ever copied down —
 * a folder's own pool overrides the default; the ancestors' entries
 * stay reachable by a request's pick.
 */

import { PlusOutlined } from '@ant-design/icons';
import type { AuthPoolEntry } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Dropdown, Popconfirm, theme } from 'antd';
import type React from 'react';
import { useState } from 'react';
import { seedAuthConfig } from '../request-editor/auth-config-form';
import { authTypeFromMenuKey, authTypeMenuItems, type ConcreteAuthType } from '../request-editor/auth-type-menu';
import { inheritSourceLabel } from '../request-editor/inherited-auth';
import AuthEntryPane, { type InheritedPoolSource } from './AuthEntryPane';
import AuthPoolList from './AuthPoolList';
import AuthTypeGrid from './AuthTypeGrid';

export interface AuthPoolDraft {
  auths: AuthPoolEntry[];
  defaultAuthUid?: string;
}

/** The nearest ancestor holding a pool, as a folder inherits it. */
export interface InheritedPool extends InheritedPoolSource {
  entries: readonly AuthPoolEntry[];
  defaultUid: string;
}

interface AuthPoolSectionProps {
  kind: 'collection' | 'folder';
  pool: AuthPoolDraft;
  onChange: (pool: AuthPoolDraft) => void;
  /** Folder only — the nearest ancestor pool it inherits while its
   *  own is empty; `null` = nothing set anywhere above. */
  inherited?: InheritedPool | null;
  /** Opens a container's Authorization section — Edit in the source. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
}

/** The pool's effective default — `defaultAuthUid` when it names a
 *  live entry, else the first (the `authPoolOf` convention). */
function effectiveDefaultUid(pool: AuthPoolDraft): string | undefined {
  if (pool.auths.length === 0) return undefined;
  return pool.auths.some((e) => e.uid === pool.defaultAuthUid) ? pool.defaultAuthUid : pool.auths[0].uid;
}

const LIST_WIDTH = 260;

const AuthPoolSection: React.FC<AuthPoolSectionProps> = ({ kind, pool, onChange, inherited, onOpenContainerAuth }) => {
  const { token } = theme.useToken();
  const t = useT();
  const [pickedUid, setPickedUid] = useState<string | null>(null);

  const ownsPool = pool.auths.length > 0;
  const inheriting = !ownsPool && kind === 'folder' && inherited != null;

  const mint = (type: ConcreteAuthType) => {
    const uid = generateUid();
    onChange({
      auths: [...pool.auths, { uid, name: '', config: seedAuthConfig(type) }],
      defaultAuthUid: ownsPool ? pool.defaultAuthUid : uid,
    });
    setPickedUid(uid);
  };

  const updateEntry = (next: AuthPoolEntry) => {
    onChange({ ...pool, auths: pool.auths.map((e) => (e.uid === next.uid ? next : e)) });
  };

  const deleteEntry = (uid: string) => {
    const rest = pool.auths.filter((e) => e.uid !== uid);
    onChange({
      auths: rest,
      defaultAuthUid: uid === effectiveDefaultUid(pool) ? rest[0]?.uid : pool.defaultAuthUid,
    });
    if (pickedUid === uid) setPickedUid(null);
  };

  const resetToInherited = () => {
    onChange({ auths: [], defaultAuthUid: undefined });
    setPickedUid(null);
  };

  if (!ownsPool && !inheriting) {
    return <AuthTypeGrid kind={kind} onPick={mint} />;
  }

  const entries = inheriting ? inherited.entries : pool.auths;
  const defaultUid = inheriting ? inherited.defaultUid : effectiveDefaultUid(pool);
  const selected = entries.find((e) => e.uid === pickedUid) ?? entries.find((e) => e.uid === defaultUid) ?? entries[0];

  const onPickType = ({ key }: { key: string }) => {
    const type = authTypeFromMenuKey(key);
    if (type !== null) mint(type);
  };
  const typeMenu = { items: authTypeMenuItems(t), onClick: onPickType };

  const headerAction = inheriting ? (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          {
            type: 'group',
            label: t('workbench.editors.requestContainer.auth.changeHint', {
              source: inheritSourceLabel(t, inherited),
            }),
            children: authTypeMenuItems(t),
          },
        ],
        onClick: onPickType,
      }}
    >
      <Button size="small" data-testid="oh-auth-pool-change">
        {t('workbench.editors.requestContainer.auth.change')}
      </Button>
    </Dropdown>
  ) : (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {kind === 'folder' && (
        <Popconfirm title={t('workbench.editors.requestContainer.auth.resetConfirm')} onConfirm={resetToInherited}>
          <Button size="small" type="text" data-testid="oh-auth-pool-reset">
            {t('workbench.editors.requestContainer.auth.resetToInherited')}
          </Button>
        </Popconfirm>
      )}
      <Dropdown trigger={['click']} menu={typeMenu}>
        <Button
          size="small"
          type="text"
          icon={<PlusOutlined />}
          aria-label={t('workbench.editors.requestContainer.auth.addEntryAria')}
          data-testid="oh-auth-pool-add"
        />
      </Dropdown>
    </span>
  );

  return (
    <div data-testid="oh-auth-pool" style={{ display: 'flex', alignItems: 'stretch', minHeight: 320 }}>
      <div
        style={{
          width: LIST_WIDTH,
          flexShrink: 0,
          paddingRight: 16,
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <AuthPoolList
          entries={entries}
          defaultUid={defaultUid}
          selectedUid={selected?.uid}
          onSelect={setPickedUid}
          headerAction={headerAction}
          {...(inheriting
            ? {}
            : {
                actions: {
                  onSetDefault: (uid: string) => onChange({ ...pool, defaultAuthUid: uid }),
                  onRename: (uid: string, name: string) => {
                    const entry = pool.auths.find((e) => e.uid === uid);
                    if (entry) updateEntry({ ...entry, name });
                  },
                  onDelete: deleteEntry,
                },
              })}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 24 }}>
        {selected !== undefined &&
          (inheriting ? (
            <AuthEntryPane
              key={selected.uid}
              entry={selected}
              inheritedFrom={{ kind: inherited.kind, uid: inherited.uid, name: inherited.name }}
              onOpenSource={onOpenContainerAuth}
            />
          ) : (
            <AuthEntryPane key={selected.uid} entry={selected} onChange={updateEntry} />
          ))}
      </div>
    </div>
  );
};

export default AuthPoolSection;
