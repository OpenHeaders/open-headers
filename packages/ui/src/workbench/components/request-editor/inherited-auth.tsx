/**
 * inherited-auth — the Inherit machinery every request Auth tab shares
 * (HTTP / WebSocket / gRPC / MQTT): the select's Inherited group over
 * the ancestor pools (the default first, then every named entry per
 * level, inner → outer, entries outside the kind's mask greyed with
 * the refusal), the value ↔ config mapping (`inherit` /
 * `inherit:<entryUid>`), and the Inherit empty state — attribution
 * line, dangling-pick warning, a dashed read-only preview of the
 * resolved entry's fields (secrets masked; editing lives in the
 * container), and the "Edit in …" opener.
 */

import { authAllowedFor, type AuthProtocolKind } from '@openheaders/core/auth-inheritance';
import type { AuthConfig, ConcreteAuthConfig } from '@openheaders/core/types';
import type { MessageKey } from '@openheaders/i18n';
import { Button, Typography, theme } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import { type Translate, useT } from '@openheaders/ui/context/LocaleContext';
import {
  inheritPoolLevels,
  type RequestAncestry,
  resolveInheritedAuthFor,
} from '../request-container/ancestry';
import { AuthEmptyState } from './auth-layout';

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
];

export function authTypeLabelKey(type: AuthKind): MessageKey {
  return AUTH_TYPE_OPTIONS.find((o) => o.value === type)?.labelKey ?? 'workbench.editors.request.auth.type.none';
}

/** What a request set to Inherit resolves to, for the attribution line
 *  under the Inherit empty state: the effective config, the level and
 *  entry that supplied it (`null` = nothing set anywhere above), and a
 *  pick that no longer resolves. */
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
 * The Inherit empty state's detail line for a SESSION kind (the
 * WebSocket / gRPC / MQTT tabs): what the request resolves to and from
 * which level — or, when the resolved type sits outside the kind's
 * mask, the refusal sentence the executor fails the Connect / Invoke
 * with (`unsupported` lets the tab render it in warning tone).
 */
export function useSessionInheritDetail(
  kind: AuthProtocolKind,
  unsupportedKey: MessageKey,
  inheritedFrom: InheritedAuthAttribution | undefined,
): { detail: string; unsupported: boolean } {
  const t = useT();
  return useMemo(() => {
    if (inheritedFrom === undefined) {
      return { detail: t('workbench.editors.request.auth.inheritDetail'), unsupported: false };
    }
    if (inheritedFrom.source === null) {
      return { detail: t('workbench.editors.request.auth.inheritedNone'), unsupported: false };
    }
    const source = inheritSourceLabel(t, inheritedFrom.source);
    const type = t(authTypeLabelKey(inheritedFrom.auth.type));
    if (inheritedFrom.auth.type !== 'inherit' && !authAllowedFor(kind, inheritedFrom.auth)) {
      return { detail: t(unsupportedKey, { type, source }), unsupported: true };
    }
    return { detail: t('workbench.editors.request.auth.inheritedFrom', { type, source }), unsupported: false };
  }, [t, kind, unsupportedKey, inheritedFrom]);
}

// ── The select's Inherited group ───────────────────────────────────

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
  label: string;
  disabled?: boolean;
  /** Native tooltip — the refusal sentence on a greyed entry. */
  title?: string;
}

export interface InheritSelectGroup {
  label: string;
  options: InheritSelectOption[];
}

/**
 * The Inherited group: "Default (Bearer Token — Folder 'Tokens')",
 * then the named entries per level inner → outer ("Folder 'Tokens' ›
 * Service"). On a session kind an entry outside the mask is disabled
 * with the refusal as its tooltip (`unsupportedKey`); HTTP greys
 * nothing. A current pick that no longer resolves renders as its own
 * "Missing entry" option so the select stays honest.
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
  const options: InheritSelectOption[] = [
    {
      value: 'inherit',
      label:
        fallback.source === null
          ? t('workbench.editors.request.auth.optionDefaultNone')
          : t('workbench.editors.request.auth.optionDefault', {
              type: t(authTypeLabelKey(fallback.auth.type)),
              source: inheritSourceLabel(t, fallback.source),
            }),
    },
  ];
  let danglingUid = currentAuthUid;
  for (const level of inheritPoolLevels(ancestry)) {
    const source = inheritSourceLabel(t, level);
    for (const entry of level.entries) {
      if (entry.uid === danglingUid) danglingUid = undefined;
      const type = t(authTypeLabelKey(entry.config.type));
      const refusal =
        unsupportedKey !== undefined && !authAllowedFor(kind, entry.config)
          ? t(unsupportedKey, { type, source })
          : null;
      options.push({
        value: `${INHERIT_ENTRY_PREFIX}${entry.uid}`,
        label: t('workbench.editors.request.auth.optionEntry', {
          source,
          entry: entry.name !== '' ? entry.name : type,
        }),
        ...(refusal !== null ? { disabled: true, title: refusal } : {}),
      });
    }
  }
  if (danglingUid !== undefined) {
    options.push({
      value: `${INHERIT_ENTRY_PREFIX}${danglingUid}`,
      label: t('workbench.editors.request.auth.optionMissingEntry'),
      title: t('workbench.editors.request.auth.danglingPick'),
    });
  }
  return { label: t('workbench.editors.request.auth.groupInherited'), options };
}

// ── The Inherit empty state (attribution · dangling · preview · opener) ──

const SECRET_MASK = '••••••••';

interface PreviewRow {
  label: string;
  value: string;
}

/** The resolved entry's fields as read-only rows — secrets masked (a
 *  view into the parent's credentials; editing and revealing live in
 *  the container editor). */
function previewRows(auth: ConcreteAuthConfig, t: Translate): PreviewRow[] {
  switch (auth.type) {
    case 'none':
      return [];
    case 'basic':
    case 'digest':
      return [
        { label: t('workbench.editors.request.auth.username'), value: auth.username },
        { label: t('workbench.editors.request.auth.password'), value: SECRET_MASK },
      ];
    case 'bearer':
      return [{ label: t('workbench.editors.request.auth.token'), value: SECRET_MASK }];
    case 'api-key':
      return [
        { label: t('workbench.editors.request.auth.key'), value: auth.key },
        { label: t('workbench.editors.request.auth.value'), value: SECRET_MASK },
        {
          label: t('workbench.editors.request.auth.addTo'),
          value:
            auth.in === 'header'
              ? t('workbench.editors.request.auth.addToHeader')
              : t('workbench.editors.request.auth.addToQuery'),
        },
      ];
    case 'oauth2':
      return [
        { label: t('workbench.editors.request.oauth.grantType'), value: auth.flow },
        { label: t('workbench.editors.request.oauth.clientId'), value: auth.clientId },
      ];
    case 'aws-sigv4':
      return [
        { label: t('workbench.editors.request.auth.awsAccessKey'), value: auth.accessKeyId },
        { label: t('workbench.editors.request.auth.awsSecretKey'), value: SECRET_MASK },
        { label: t('workbench.editors.request.auth.awsService'), value: auth.service },
        { label: t('workbench.editors.request.auth.awsRegion'), value: auth.region },
      ];
    case 'oauth1':
      return [
        { label: t('workbench.editors.request.auth.oauth1ConsumerKey'), value: auth.consumerKey },
        { label: t('workbench.editors.request.auth.oauth1ConsumerSecret'), value: SECRET_MASK },
        { label: t('workbench.editors.request.auth.oauth1SignatureMethod'), value: auth.signatureMethod },
      ];
    default: {
      const _exhaustive: never = auth;
      void _exhaustive;
      return [];
    }
  }
}

/**
 * The Inherit empty state every Auth tab renders: the attribution line
 * (warning tone when the kind refuses the resolved type), the
 * dangling-pick warning, the dashed read-only preview of the resolved
 * entry, and the "Edit in …" opener into the supplying container.
 */
export const InheritedAuthEmptyState: React.FC<{
  title: string;
  detail: string;
  unsupported?: boolean;
  inheritedFrom?: InheritedAuthAttribution;
  onOpenContainerAuth?: (kind: 'collection' | 'folder', uid: string, name: string) => void;
  testId?: string;
}> = ({ title, detail, unsupported = false, inheritedFrom, onOpenContainerAuth, testId }) => {
  const { token } = theme.useToken();
  const t = useT();
  const source = inheritedFrom?.source ?? null;
  const resolved = inheritedFrom !== undefined && inheritedFrom.auth.type !== 'inherit' ? inheritedFrom.auth : null;
  const rows = resolved !== null && source !== null && !unsupported ? previewRows(resolved, t) : [];
  return (
    <AuthEmptyState title={title} note={unsupported ? <Text type="warning">{detail}</Text> : detail} testId={testId}>
      {inheritedFrom?.danglingAuthUid !== undefined && (
        <Text
          type="warning"
          style={{ fontSize: 12, textAlign: 'center', maxWidth: 360 }}
          data-testid="oh-auth-dangling"
        >
          {t('workbench.editors.request.auth.danglingPick')}
        </Text>
      )}
      {rows.length > 0 && (
        <div
          data-testid="oh-auth-inherited-preview"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '10px 14px',
            border: `1px dashed ${token.colorBorder}`,
            borderRadius: token.borderRadius,
            minWidth: 240,
            maxWidth: 360,
          }}
        >
          {rows.map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'baseline', gap: 12, fontSize: 12 }}>
              <span style={{ width: 110, flexShrink: 0, textAlign: 'left', color: token.colorTextSecondary }}>
                {row.label}
              </span>
              <span style={{ fontFamily: 'monospace', wordBreak: 'break-all', textAlign: 'left' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
      {source !== null && onOpenContainerAuth !== undefined && (
        <Button
          size="small"
          data-testid="oh-auth-edit-in-source"
          onClick={() => onOpenContainerAuth(source.kind, source.uid, source.name)}
        >
          {t('workbench.editors.request.auth.editInSource', { source: inheritSourceLabel(t, source) })}
        </Button>
      )}
    </AuthEmptyState>
  );
};
