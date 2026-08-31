/**
 * The concrete auth types as one pickable list — the icon and label
 * per type, and the antd menu items every type picker shares: the
 * container's empty-state card grid, its `+` and Change dropdowns,
 * and the entry pane's type select. `none` closes the list behind a
 * divider (a real entry, "no auth", never the first offer).
 */

import {
  AmazonOutlined,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { MenuProps } from 'antd';
import type React from 'react';
export type { ConcreteAuthType } from './auth-config-form';
import type { ConcreteAuthType } from './auth-config-form';
import { authTypeLabelKey } from './inherited-auth';

/** The offer order — the credential types, then `none` apart. */
export const AUTH_TYPE_ORDER: readonly Exclude<ConcreteAuthType, 'none'>[] = [
  'api-key',
  'basic',
  'bearer',
  'digest',
  'oauth1',
  'oauth2',
  'aws-sigv4',
];

const AUTH_TYPE_ICONS: Record<ConcreteAuthType, React.ReactNode> = {
  'api-key': <KeyOutlined />,
  basic: <UserOutlined />,
  bearer: <SafetyCertificateOutlined />,
  digest: <LockOutlined />,
  oauth1: <LinkOutlined />,
  oauth2: <LoginOutlined />,
  'aws-sigv4': <AmazonOutlined />,
  none: <StopOutlined />,
};

export function authTypeIcon(type: ConcreteAuthType): React.ReactNode {
  return AUTH_TYPE_ICONS[type];
}

/** The type a menu item key names — the dropdowns' `onClick` reads a
 *  string; `null` for a key that is no type. */
export function authTypeFromMenuKey(key: string): ConcreteAuthType | null {
  if (key === 'none') return 'none';
  return AUTH_TYPE_ORDER.find((type) => type === key) ?? null;
}

/** The type list as menu items keyed by type — the credential types,
 *  a divider, then No Auth. */
export function authTypeMenuItems(t: Translate): NonNullable<MenuProps['items']> {
  return [
    ...AUTH_TYPE_ORDER.map((type) => ({ key: type, icon: authTypeIcon(type), label: t(authTypeLabelKey(type)) })),
    { type: 'divider' as const },
    { key: 'none', icon: authTypeIcon('none'), label: t(authTypeLabelKey('none')) },
  ];
}

/** The select options twin — icon + label per type, `none` last. */
export function authTypeSelectOptions(t: Translate): Array<{ value: ConcreteAuthType; label: React.ReactNode }> {
  const option = (type: ConcreteAuthType) => ({
    value: type,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {authTypeIcon(type)}
        {t(authTypeLabelKey(type))}
      </span>
    ),
  });
  return [...AUTH_TYPE_ORDER.map(option), option('none')];
}
