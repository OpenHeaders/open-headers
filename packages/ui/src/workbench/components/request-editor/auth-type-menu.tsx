/**
 * The concrete auth types as one pickable list — the icon and label
 * per type, and the antd menu items every type picker shares: the
 * container's empty-state card grid, its `+` and Change dropdowns,
 * and the entry pane's type select. Three sections behind dividers
 * (the reference client's list): the credential schemes, the vendor
 * signatures, then `none` (a real entry, "no auth", never the first
 * offer). Every type select opens the same compact popup — the whole
 * list in view, no inner scroll, option rows at the label size.
 */

import type { Translate } from '@openheaders/ui/context/LocaleContext';
import type { MenuProps, SelectProps } from 'antd';
import type React from 'react';
export type { ConcreteAuthType } from './auth-config-form';
import type { ConcreteAuthType } from './auth-config-form';
import { AuthTypeIcon } from './auth-type-icons';
import { authTypeLabelKey, type InheritSelectItem, ownAuthTypeOptions } from './inherited-auth';

/** The offer in sections — the credential schemes, the vendor
 *  signatures, then `none` apart; a divider between sections. */
export const AUTH_TYPE_SECTIONS: readonly (readonly ConcreteAuthType[])[] = [
  ['api-key', 'basic', 'bearer', 'digest', 'hawk', 'http-signature', 'jwt', 'oauth1', 'oauth2'],
  ['aws-sigv4', 'edgegrid', 'asap'],
  ['none'],
];

/** The offer order without `none`. */
export const AUTH_TYPE_ORDER: readonly Exclude<ConcreteAuthType, 'none'>[] = AUTH_TYPE_SECTIONS.flat().filter(
  (type): type is Exclude<ConcreteAuthType, 'none'> => type !== 'none',
);

/** The popup every auth-type select opens: sized to its longest
 *  label rather than the trigger, tall enough for the whole list
 *  (no virtual window, no inner scroll), rows at the label size and
 *  the section dividers — `.oh-auth-type-popup` in editor.less. */
type AuthTypeSelectPopupProps = Pick<SelectProps, 'classNames' | 'listHeight' | 'popupMatchSelectWidth' | 'virtual'>;

export const AUTH_TYPE_SELECT_POPUP: AuthTypeSelectPopupProps = {
  classNames: { popup: { root: 'oh-auth-type-popup' } },
  listHeight: 480,
  popupMatchSelectWidth: 260,
  virtual: false,
};

/** The type's glyph — see auth-type-icons. */
export function authTypeIcon(type: ConcreteAuthType): React.ReactNode {
  return <AuthTypeIcon type={type} />;
}

/** The type a menu item key names — the dropdowns' `onClick` reads a
 *  string; `null` for a key that is no type. */
export function authTypeFromMenuKey(key: string): ConcreteAuthType | null {
  if (key === 'none') return 'none';
  return AUTH_TYPE_ORDER.find((type) => type === key) ?? null;
}

/** The type list as menu items keyed by type — the sections behind
 *  dividers. */
export function authTypeMenuItems(t: Translate): NonNullable<MenuProps['items']> {
  return AUTH_TYPE_SECTIONS.flatMap((section, i) => [
    ...(i > 0 ? [{ type: 'divider' as const }] : []),
    ...section.map((type) => ({ key: type, icon: authTypeIcon(type), label: t(authTypeLabelKey(type)) })),
  ]);
}

/**
 * A kind's own types as SECTIONED select items — the S15 offer
 * (credential schemes ∥ vendor signature ∥ No Auth) intersected with
 * the kind's own set. The first non-empty section carries
 * `groupLabel` ("This request", or `null` on the flat scratch-draft
 * select); the rest ride as label-less groups the popup sheet draws
 * as 1px rules, so No Auth and the vendor signatures sit apart on
 * every auth-type select, pool or not.
 */
export function sectionedOwnAuthTypeItems(
  t: Translate,
  types: readonly ConcreteAuthType[],
  groupLabel: string | null,
): InheritSelectItem[] {
  const sections = AUTH_TYPE_SECTIONS.map((section) => section.filter((type) => types.includes(type))).filter(
    (section) => section.length > 0,
  );
  return sections.map((section, i) => ({
    label: i === 0 ? groupLabel : null,
    options: ownAuthTypeOptions(t, section),
  }));
}

interface AuthTypeSelectOption {
  value: ConcreteAuthType;
  label: React.ReactNode;
}

/** The select options twin — icon + label per type; the sections
 *  after the first ride as label-less option groups, whose headers
 *  the popup sheet draws as the dividers. */
export function authTypeSelectOptions(
  t: Translate,
): Array<AuthTypeSelectOption | { label: null; options: AuthTypeSelectOption[] }> {
  const option = (type: ConcreteAuthType): AuthTypeSelectOption => ({
    value: type,
    label: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        {authTypeIcon(type)}
        {t(authTypeLabelKey(type))}
      </span>
    ),
  });
  const [first, ...rest] = AUTH_TYPE_SECTIONS;
  return [...first.map(option), ...rest.map((section) => ({ label: null, options: section.map(option) }))];
}
