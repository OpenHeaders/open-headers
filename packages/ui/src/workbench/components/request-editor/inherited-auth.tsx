/**
 * inherited-auth — the Inherit machinery every request Auth tab shares
 * (HTTP / WebSocket / gRPC / MQTT): the select's Inherited group over
 * the ancestor pools (every entry by name with its type icon, inner →
 * outer, the resolved default tagged, entries outside the kind's mask
 * greyed with the refusal), the value ↔ config mapping (`inherit` /
 * `inherit:<entryUid>`), the own-type options with icons, and the
 * Inherit pane — the resolved entry's label with the Inherited tag,
 * the "Edit in parent" opener, the refusal / dangling warnings, and the
 * entry's real form inert (secrets masked; editing lives in the
 * container).
 */

import { EditOutlined, UndoOutlined } from '@ant-design/icons';
import { authAllowedFor, type AuthProtocolKind } from '@openheaders/core/auth-inheritance';
import type { AuthConfig, ConcreteAuthConfig } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  inheritPoolLevels,
  type RequestAncestry,
  resolveInheritedAuthFor,
} from '../request-container/ancestry';
import type { ConcreteAuthType } from './auth-config-form';
import { authTypeIcon } from './auth-type-menu';
import InheritedAuthForm from './InheritedAuthForm';

const { Text } = Typography;

type AuthKind = AuthConfig['type'];

interface AuthTypeOption {
  value: AuthKind;
  labelKey: MessageKey;
}

/** Every auth type with its display key — the HTTP select's own list;
 *  the session tabs pick their subsets. */
export const AUTH_TYPE_OPTIONS: AuthTypeOption[] = [
  { value: 'inherit', labelKey: 'workbench.editors.request.auth.type.inherit' },
  { value: 'none', labelKey: 'workbench.editors.request.auth.type.none' },
  { value: 'basic', labelKey: 'workbench.editors.request.auth.type.basic' },
  { value: 'bearer', labelKey: 'workbench.editors.request.auth.type.bearer' },
  { value: 'api-key', labelKey: 'workbench.editors.request.auth.type.apiKey' },
  { value: 'oauth2', labelKey: 'workbench.editors.request.auth.type.oauth2' },
  { value: 'aws-sigv4', labelKey: 'workbench.editors.request.auth.type.awsSigV4' },
  { value: 'digest', labelKey: 'workbench.editors.request.auth.type.digest' },
  { value: 'oauth1', labelKey: 'workbench.editors.request.auth.type.oauth1' },
  { value: 'hawk', labelKey: 'workbench.editors.request.auth.type.hawk' },
  { value: 'jwt', labelKey: 'workbench.editors.request.auth.type.jwtBearer' },
];

export function authTypeLabelKey(type: AuthKind): MessageKey {
  return AUTH_TYPE_OPTIONS.find((o) => o.value === type)?.labelKey ?? 'workbench.editors.request.auth.type.none';
}

/** What a request set to Inherit resolves to, for the Inherit pane:
 *  the effective config, the level and entry that supplied it (`null`
 *  = nothing set anywhere above), and a pick that no longer resolves. */
export interface InheritedAuthAttribution {
  auth: AuthConfig;
  source: { kind: 'collection' | 'folder'; uid: string; name: string; entryName: string } | null;
  /** The request named a pool entry that no longer exists; the default applied. */
  danglingAuthUid?: string;
}

/** The source's display label — "Collection 'Payments'" / "Folder 'Tokens'". */
export function inheritSourceLabel(t: Translate, source: { kind: 'collection' | 'folder'; name: string }): string {
  return source.kind === 'collection'
    ? t('workbench.editors.request.auth.sourceCollection', { name: source.name })
    : t('workbench.editors.request.auth.sourceFolder', { name: source.name });
}

/**
 * The refusal a SESSION kind's Inherit pane shows (the WebSocket /
 * gRPC / MQTT tabs) when the resolved type sits outside the kind's
 * mask — the sentence the executor fails the Connect / Invoke with;
 * `null` when the resolution can ride the kind.
 */
export function useSessionInheritRefusal(
  kind: AuthProtocolKind,
  unsupportedKey: MessageKey,
  inheritedFrom: InheritedAuthAttribution | undefined,
): string | null {
  const t = useT();
  return useMemo(() => {
    if (inheritedFrom === undefined || inheritedFrom.source === null || inheritedFrom.auth.type === 'inherit') {
      return null;
    }
    if (authAllowedFor(kind, inheritedFrom.auth)) return null;
    return t(unsupportedKey, {
      type: t(authTypeLabelKey(inheritedFrom.auth.type)),
      source: inheritSourceLabel(t, inheritedFrom.source),
    });
  }, [t, kind, unsupportedKey, inheritedFrom]);
}

// ── The rail header (label + reset-to-inherited) ───────────────────

/**
 * The rail's "Auth Type" label row. Whenever the select sits on
 * anything but plain follow-the-default — a pinned inherited entry or
 * the request's own config — a ↺ button rides the row's right edge
 * ("Reset to inherited auth"), writing `{ type: 'inherit' }` back.
 */
export const AuthTypeRailHeader: React.FC<{
  label: string;
  auth: { type: string; authUid?: string };
  onChange: (auth: { type: 'inherit' }) => void;
}> = ({ label, auth, onChange }) => {
  const t = useT();
  const resettable = inheritSelectValue(auth) !== 'inherit';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 24 }}>
      <Text strong style={{ fontSize: 12 }}>
        {label}
      </Text>
      <span style={{ flex: 1 }} />
      {resettable && (
        <Tooltip title={t('workbench.editors.request.auth.resetToInheritedAuth')}>
          <Button
            size="small"
            type="text"
            icon={<UndoOutlined />}
            aria-label={t('workbench.editors.request.auth.resetToInheritedAuth')}
            data-testid="oh-auth-reset-inherit"
            onClick={() => onChange({ type: 'inherit' })}
          />
        </Tooltip>
      )}
    </div>
  );
};

// ── The select's options ───────────────────────────────────────────

const INHERIT_ENTRY_PREFIX = 'inherit:';

/** The select value a request auth renders as: `inherit`,
 *  `inherit:<entryUid>` for a named pick, or the concrete type. */
export function inheritSelectValue(auth: { type: string; authUid?: string }): string {
  if (auth.type !== 'inherit') return auth.type;
  return auth.authUid === undefined ? 'inherit' : `${INHERIT_ENTRY_PREFIX}${auth.authUid}`;
}

/** A picked select value's Inherit half — `null` when it names a
 *  concrete type instead. */
export function parseInheritSelectValue(value: string): { authUid?: string } | null {
  if (value === 'inherit') return {};
  if (value.startsWith(INHERIT_ENTRY_PREFIX)) return { authUid: value.slice(INHERIT_ENTRY_PREFIX.length) };
  return null;
}

export interface InheritSelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
  /** Native tooltip — the refusal sentence on a greyed entry. */
  title?: string;
}

export interface InheritSelectGroup {
  label: string;
  options: InheritSelectOption[];
}

/** One item of a tab's select — a flat option or a labelled group. */
export type InheritSelectItem = InheritSelectOption | InheritSelectGroup;

const OptionLabel: React.FC<{
  type: ConcreteAuthType;
  text: string;
  /** The level, shown muted when more than one level holds entries. */
  level?: string;
  isDefault?: boolean;
}> = ({ type, text, level, isDefault }) => {
  const t = useT();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: '100%' }}>
      {authTypeIcon(type)}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</span>
      {level !== undefined && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {level}
        </Text>
      )}
      {isDefault === true && (
        <Tag style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: '18px' }}>
          {t('workbench.editors.requestContainer.auth.defaultTag')}
        </Tag>
      )}
    </span>
  );
};

/** The kind's own types as select options — icon + label. */
export function ownAuthTypeOptions(t: Translate, types: readonly ConcreteAuthType[]): InheritSelectOption[] {
  return types.map((type) => ({
    value: type,
    label: <OptionLabel type={type} text={t(authTypeLabelKey(type))} />,
  }));
}

/** The plain Inherit option — the flat select without ancestry. */
export function plainInheritOption(t: Translate): InheritSelectOption {
  return { value: 'inherit', label: t('workbench.editors.request.auth.type.inherit') };
}

/** The own types as the second group under the Inherited one. */
export function ownAuthTypeGroup(t: Translate, types: readonly ConcreteAuthType[]): InheritSelectGroup {
  return { label: t('workbench.editors.request.auth.groupOwn'), options: ownAuthTypeOptions(t, types) };
}

/**
 * The Inherited group: every ancestor entry by name (else its type's
 * label) with its type icon, inner → outer; the entry the default
 * RESOLVES to (a host-scoped match first) carries the Default tag and
 * the `inherit` value — picking it follows the default; every other
 * entry is a named pick by uid. When more than one level holds
 * entries each row names its level. On a session kind an entry outside
 * the mask is disabled with the refusal as its tooltip
 * (`unsupportedKey`); HTTP greys nothing. A current pick that no
 * longer resolves renders as its own "Missing entry" option so the
 * select stays honest; nothing set anywhere above = the plain Inherit
 * option.
 */
export function buildInheritedGroup(opts: {
  t: Translate;
  kind: AuthProtocolKind;
  ancestry: RequestAncestry | null;
  url: string;
  currentAuthUid?: string;
  unsupportedKey?: MessageKey;
}): InheritSelectGroup {
  const { t, kind, ancestry, url, currentAuthUid, unsupportedKey } = opts;
  const fallback = resolveInheritedAuthFor(ancestry, {}, url);
  const levels = inheritPoolLevels(ancestry);
  const options: InheritSelectOption[] = [];
  let danglingUid = currentAuthUid;
  for (const level of levels) {
    const source = inheritSourceLabel(t, level);
    for (const entry of level.entries) {
      if (entry.uid === danglingUid) danglingUid = undefined;
      const type = t(authTypeLabelKey(entry.config.type));
      const refusal =
        unsupportedKey !== undefined && !authAllowedFor(kind, entry.config)
          ? t(unsupportedKey, { type, source })
          : null;
      // The resolved default follows the default (`inherit`) — unless
      // the request pinned that very entry by uid, which keeps its own
      // value so the select shows the pin.
      const isDefault =
        fallback.source !== null && fallback.source.uid === level.uid && fallback.source.entryUid === entry.uid;
      const follows = isDefault && currentAuthUid !== entry.uid;
      options.push({
        value: follows ? 'inherit' : `${INHERIT_ENTRY_PREFIX}${entry.uid}`,
        label: (
          <OptionLabel
            type={entry.config.type}
            text={entry.name !== '' ? entry.name : type}
            {...(levels.length > 1 ? { level: source } : {})}
            isDefault={isDefault}
          />
        ),
        ...(refusal !== null ? { disabled: true, title: refusal } : {}),
      });
    }
  }
  if (options.length === 0) options.push(plainInheritOption(t));
  if (danglingUid !== undefined) {
    options.push({
      value: `${INHERIT_ENTRY_PREFIX}${danglingUid}`,
      label: t('workbench.editors.request.auth.optionMissingEntry'),
      title: t('workbench.editors.request.auth.danglingPick'),
    });
  }
  return { label: t('workbench.editors.request.auth.groupInherited'), options };
}

// ── The Inherit pane (heading · tag · opener · warnings · inert form) ──

/**
 * The Inherit pane every Auth tab renders: the resolved entry's label
 * with the Inherited tag and the "Edit in parent" opener onto the supplying
 * container, the refusal (a session kind whose mask excludes the
 * resolved type, warning tone) and the dangling-pick warning, and the
 * entry's real form inert. Without a resolution the pane states the
 * fact instead: the generic parent note (a scratch draft), or that
 * nothing is set above the request.
 */
export const InheritedAuthPane: React.FC<{
  inheritedFrom?: InheritedAuthAttribution;
  /** The session mask's refusal, `null` when the resolution applies. */
  refusal?: string | null;
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  testId?: string;
}> = ({ inheritedFrom, refusal = null, onOpenContainerAuth, testId }) => {
  const t = useT();
  const source = inheritedFrom?.source ?? null;
  const resolved = inheritedFrom !== undefined && inheritedFrom.auth.type !== 'inherit' ? inheritedFrom.auth : null;
  const heading =
    source !== null && resolved !== null
      ? source.entryName !== ''
        ? source.entryName
        : t(authTypeLabelKey(resolved.type))
      : t('workbench.editors.request.auth.type.inherit');
  return (
    <div data-testid={testId} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
        <Text strong style={{ fontSize: 16 }} ellipsis data-testid="oh-auth-inherit-heading">
          {heading}
        </Text>
        {source !== null && (
          <Tag style={{ marginInlineEnd: 0 }} data-testid="oh-auth-inherited-tag">
            {t('workbench.editors.requestContainer.auth.inheritedTag')}
          </Tag>
        )}
        <span style={{ flex: 1 }} />
        {source !== null && onOpenContainerAuth !== undefined && (
          <Button
            size="small"
            type="link"
            icon={<EditOutlined />}
            data-testid="oh-auth-edit-in-source"
            onClick={() => onOpenContainerAuth(source.kind, source.uid, source.name)}
          >
            {t('workbench.editors.request.auth.editInParent')}
          </Button>
        )}
      </div>
      {refusal !== null && (
        <Text type="warning" style={{ fontSize: 12 }} data-testid="oh-auth-inherit-refusal">
          {refusal}
        </Text>
      )}
      {inheritedFrom?.danglingAuthUid !== undefined && (
        <Text type="warning" style={{ fontSize: 12 }} data-testid="oh-auth-dangling">
          {t('workbench.editors.request.auth.danglingPick')}
        </Text>
      )}
      {inheritedFrom === undefined && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.request.auth.inheritDetail')}
        </Text>
      )}
      {inheritedFrom !== undefined && source === null && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {t('workbench.editors.request.auth.inheritedNone')}
        </Text>
      )}
      {source !== null && resolved !== null && <InheritedAuthForm auth={resolved} testId="oh-auth-inherited-form" />}
    </div>
  );
};
