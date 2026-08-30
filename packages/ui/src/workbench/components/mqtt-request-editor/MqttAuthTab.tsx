/**
 * MqttAuthTab — the session credential on the shared `auth-layout`
 * anatomy: Inherit (the ancestor pool's default or a named entry,
 * resolved at Connect under the MQTT mask — Basic only), none, or an
 * own Basic pair (the CONNECT packet's User Name and Password — both
 * MQTT versions carry them; `{{refs}}` resolve at Connect and saved
 * examples never capture the credential — the rail note names all of
 * it). With ancestry the select leads with the Inherited group
 * (entries outside the mask greyed with the refusal); an inherited
 * type outside the mask is named on the empty state in warning tone —
 * Connect fails with the same sentence.
 */

import type { MqttAuth } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { Select } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import type { RequestAncestry } from '../request-container/ancestry';
import {
  buildInheritedGroup,
  type InheritedAuthAttribution,
  InheritedAuthEmptyState,
  inheritSelectValue,
  parseInheritSelectValue,
  useSessionInheritDetail,
} from '../request-editor/inherited-auth';
import {
  AUTH_FIELD_DEFAULT_MAX_WIDTH,
  AuthEmptyState,
  AuthForm,
  AuthLabeledRow,
  AuthRailNote,
  AuthSecretField,
  AuthTabShell,
  AuthTypeLabel,
} from '../request-editor/auth-layout';
import { TemplateInput } from '../template-input';

interface MqttAuthTabProps {
  auth: MqttAuth;
  /** What Inherit resolves to and from which level; absent = unknown
   *  (a scratch draft, or a tree still hydrating). */
  inheritedFrom?: InheritedAuthAttribution;
  /** The ancestor chain behind the select's Inherited group; absent =
   *  the flat select. */
  ancestry?: RequestAncestry | null;
  /** The broker URL — host-scoped entries resolve against it for the
   *  Default option's label. */
  url?: string;
  /** Opens the supplying container's Authorization section. */
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  onChange: (auth: MqttAuth) => void;
}

const MqttAuthTab: React.FC<MqttAuthTabProps> = ({
  auth,
  inheritedFrom,
  ancestry,
  url = '',
  onOpenContainerAuth,
  onChange,
}) => {
  const t = useT();
  const inherit = useSessionInheritDetail('mqtt', 'workbench.editors.mqtt.auth.inheritUnsupported', inheritedFrom);
  const options = useMemo(() => {
    const own = [
      { value: 'none', label: t('workbench.editors.request.auth.type.none') },
      { value: 'basic', label: t('workbench.editors.request.auth.type.basic') },
    ];
    if (ancestry === undefined) {
      return [{ value: 'inherit', label: t('workbench.editors.request.auth.type.inherit') }, ...own];
    }
    return [
      buildInheritedGroup({
        t,
        kind: 'mqtt',
        ancestry,
        url,
        unsupportedKey: 'workbench.editors.mqtt.auth.inheritUnsupported',
        ...(auth.type === 'inherit' && auth.authUid !== undefined ? { currentAuthUid: auth.authUid } : {}),
      }),
      ...own,
    ];
  }, [t, ancestry, url, auth]);
  const handleSelect = (value: string) => {
    const pick = parseInheritSelectValue(value);
    if (pick !== null) {
      onChange({ type: 'inherit', ...(pick.authUid !== undefined ? { authUid: pick.authUid } : {}) });
      return;
    }
    onChange(
      value === 'basic'
        ? {
            type: 'basic',
            username: auth.type === 'basic' ? auth.username : '',
            password: auth.type === 'basic' ? auth.password : '',
          }
        : { type: 'none' },
    );
  };
  return (
    <AuthTabShell
      rail={
        <>
          <AuthTypeLabel>{t('workbench.editors.request.auth.typeLabel')}</AuthTypeLabel>
          <Select
            size="middle"
            data-testid="mqtt-auth-type"
            value={inheritSelectValue(auth)}
            options={options}
            onChange={handleSelect}
            style={{ width: '100%' }}
          />
          {auth.type === 'inherit' && <AuthRailNote>{t('workbench.editors.request.auth.inheritNote')}</AuthRailNote>}
          {auth.type === 'none' && <AuthRailNote>{t('workbench.editors.request.auth.noneNote')}</AuthRailNote>}
          {auth.type === 'basic' && <AuthRailNote>{t('workbench.editors.mqtt.auth.help')}</AuthRailNote>}
        </>
      }
    >
      {auth.type === 'inherit' && (
        <InheritedAuthEmptyState
          title={t('workbench.editors.request.auth.type.inherit')}
          detail={inherit.detail}
          unsupported={inherit.unsupported}
          inheritedFrom={inheritedFrom}
          onOpenContainerAuth={onOpenContainerAuth}
          testId="mqtt-auth-inherit-state"
        />
      )}
      {auth.type === 'none' && (
        <AuthEmptyState
          glyph="—"
          title={t('workbench.editors.request.auth.type.none')}
          note={t('workbench.editors.request.auth.noneNote')}
        />
      )}
      {auth.type === 'basic' && (
        <AuthForm>
          <AuthLabeledRow label={t('workbench.editors.request.auth.username')}>
            <TemplateInput
              size="small"
              value={auth.username}
              onChange={(next) => onChange({ type: 'basic', username: next, password: auth.password })}
              placeholder={t('workbench.editors.request.auth.usernamePlaceholder')}
              style={{ maxWidth: AUTH_FIELD_DEFAULT_MAX_WIDTH }}
              data-testid="mqtt-auth-username"
            />
          </AuthLabeledRow>
          <AuthLabeledRow label={t('workbench.editors.request.auth.password')}>
            <AuthSecretField
              value={auth.password}
              onChange={(next) => onChange({ type: 'basic', username: auth.username, password: next })}
              placeholder={t('workbench.editors.request.auth.passwordPlaceholder')}
              data-testid="mqtt-auth-password"
            />
          </AuthLabeledRow>
        </AuthForm>
      )}
    </AuthTabShell>
  );
};

export default MqttAuthTab;
