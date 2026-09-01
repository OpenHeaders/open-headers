/**
 * The pool's right panel — the selected entry: its label as the
 * heading, the Auth type row (switching seeds a fresh config of the
 * new type; an unnamed entry's row label follows), the type's fields,
 * and the Apply-to-host scope. An inherited entry renders the same
 * anatomy with the Inherited tag, the "Edit in parent" opener onto the
 * supplying container, and the form inert (`InheritedAuthForm`).
 */

import { EditOutlined } from '@ant-design/icons';
import type { AuthPoolEntry } from '@openheaders/core/types';
import { Button, Divider, Input, Select, Tag, Typography } from 'antd';
import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { AuthConfigFields, OAuth2RailControls, seedAuthConfig } from '../request-editor/auth-config-form';
import { AUTH_FIELD_DEFAULT_MAX_WIDTH, AuthFormNote, AuthLabeledRow } from '../request-editor/auth-layout';
import { authTypeSelectOptions, type ConcreteAuthType } from '../request-editor/auth-type-menu';
import { authTypeInfo } from '../request-editor/AuthRowInfo';
import InheritedAuthForm from '../request-editor/InheritedAuthForm';
import { authTypeLabelKey } from '../request-editor/inherited-auth';

const { Text } = Typography;

export interface InheritedPoolSource {
  kind: 'collection' | 'folder';
  uid: string;
  name: string;
}

export interface AuthEntryPaneProps {
  entry: AuthPoolEntry;
  /** Absent = read-only (an inherited entry). */
  onChange?: (entry: AuthPoolEntry) => void;
  /** The supplying container of an inherited entry. */
  inheritedFrom?: InheritedPoolSource;
  onOpenSource?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
}

const AuthEntryPane: React.FC<AuthEntryPaneProps> = ({ entry, onChange, inheritedFrom, onOpenSource }) => {
  const t = useT();
  const readOnly = onChange === undefined;
  const label = entry.name !== '' ? entry.name : t(authTypeLabelKey(entry.config.type));

  const setType = (type: ConcreteAuthType) => {
    if (type === entry.config.type) return;
    onChange?.({ ...entry, config: seedAuthConfig(type) });
  };
  const setAppliesTo = (next: string) => {
    if (next === '') {
      const { appliesTo: _omit, ...rest } = entry;
      onChange?.(rest);
      return;
    }
    onChange?.({ ...entry, appliesTo: next });
  };

  const form = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <AuthLabeledRow label={t('workbench.editors.request.auth.typeLabel')} info={authTypeInfo(t, entry.config)}>
        <Select
          size="small"
          data-testid="oh-auth-entry-type"
          value={entry.config.type}
          onChange={setType}
          options={authTypeSelectOptions(t)}
          style={{ width: '100%', maxWidth: AUTH_FIELD_DEFAULT_MAX_WIDTH }}
        />
      </AuthLabeledRow>
      {entry.config.type === 'none' && (
        <AuthFormNote>{t('workbench.editors.requestContainer.auth.noneEntryNote')}</AuthFormNote>
      )}
      {entry.config.type === 'oauth2' && (
        <OAuth2RailControls
          auth={entry.config}
          onChange={(config) => onChange?.({ ...entry, config })}
          layout="rows"
        />
      )}
      <AuthConfigFields auth={entry.config} onChange={(config) => onChange?.({ ...entry, config })} />
      <Divider style={{ margin: '4px 0' }} />
      <AuthLabeledRow label={t('workbench.editors.requestContainer.auth.appliesTo')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Input
            size="small"
            value={entry.appliesTo ?? ''}
            onChange={(e) => setAppliesTo(e.target.value)}
            placeholder={t('workbench.editors.requestContainer.auth.appliesToPlaceholder')}
            style={{ maxWidth: AUTH_FIELD_DEFAULT_MAX_WIDTH, fontFamily: 'monospace', fontSize: 12 }}
            data-testid="oh-auth-entry-applies-to"
          />
          <AuthFormNote>{t('workbench.editors.requestContainer.auth.appliesToHelp')}</AuthFormNote>
        </div>
      </AuthLabeledRow>
    </div>
  );

  return (
    <div data-testid="oh-auth-entry-pane" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
        <Text strong style={{ fontSize: 16 }} ellipsis data-testid="oh-auth-entry-heading">
          {label}
        </Text>
        {inheritedFrom !== undefined && (
          <Tag style={{ marginInlineEnd: 0 }} data-testid="oh-auth-entry-inherited-tag">
            {t('workbench.editors.requestContainer.auth.inheritedTag')}
          </Tag>
        )}
        <span style={{ flex: 1 }} />
        {inheritedFrom !== undefined && onOpenSource !== undefined && (
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            data-testid="oh-auth-pool-edit-in-source"
            onClick={() => onOpenSource(inheritedFrom.kind, inheritedFrom.uid, inheritedFrom.name)}
          >
            {t('workbench.editors.request.auth.editInParent')}
          </Button>
        )}
      </div>
      {readOnly ? (
        <InheritedAuthForm auth={entry.config} appliesTo={entry.appliesTo ?? null} testId="oh-auth-inherited-form" />
      ) : (
        form
      )}
    </div>
  );
};

export default AuthEntryPane;
