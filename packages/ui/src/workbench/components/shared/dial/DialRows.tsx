/**
 * DialRows — the dial block's shared rows every request editor's
 * Settings tab renders inside its Connection group (HTTP, WebSocket /
 * Socket.IO, gRPC, MQTT): ONE component for the one dial policy the
 * request kinds share, so the rows, their order, their validation,
 * the tri-state proxy pair write and their dots never drift between
 * editors again.
 *
 *   Resolve to address · Proxy · [Proxy URL · Proxy credentials]
 *
 * A row set rather than a group: the Connection group each tab owns
 * carries protocol-specific rows around these (HTTP's version row
 * before, the Unix socket and the connect timeout after), so the tab
 * renders the group and seats the rows. Same contract as the TLS &
 * trust block: the rows edit a `DialValue` and hand the WHOLE next
 * value back — the host merges it into its draft; the Proxy row
 * always writes the mode + URL PAIR (Inherit and Direct clear the URL
 * and its credential ref — a hidden row must not keep a dormant URL
 * or a stale ref alive; Custom keeps whatever URL is set); modified
 * dots track distance from the runtime defaults; the optional
 * `unsaved` set (the HTTP tab's saved-baseline plane) adds the unsaved
 * marker per row. Labels, placeholders and warnings come from the
 * request-settings catalog; an editor with richer popover copy passes
 * `rowInfo` and falls back to the shared copy for the keys it leaves
 * undefined.
 */

import {
  isValidProxyUrl,
  MAX_PROXY_URL_LENGTH,
  MAX_RESOLVE_TO_ADDRESS_LENGTH,
  RESOLVE_TO_ADDRESS_PATTERN,
} from '@openheaders/core/schemas';
import type { ProxyMode } from '@openheaders/core/types';
import { useVaultContext } from '@openheaders/ui/context';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { SelectKnobRow, TextKnobRow } from '@openheaders/ui/shared/settings-rows';
import { Typography } from 'antd';
import type React from 'react';
import VaultSelectFooter from '../../variables/VaultSelectFooter';
import { type InheritedSettingsView, inheritedRowsFor } from '../inherited-settings/inherited-settings';
import { type DialInfoKey, dialRowInfo } from './dial-row-info';

const { Text } = Typography;

/** The policy slice the rows edit — every key optional, `undefined`
 *  = the runtime default (system DNS, the host's proxy planes). */
export interface DialValue {
  resolveToAddress?: string | undefined;
  proxyMode?: ProxyMode | undefined;
  proxyUrl?: string | undefined;
  proxyCredentialRef?: string | undefined;
}

export const DIAL_KEYS = ['resolveToAddress', 'proxyMode', 'proxyUrl', 'proxyCredentialRef'] as const;

export type DialKey = (typeof DIAL_KEYS)[number];

/** Whether any row sits off its runtime default. */
export function isDialModified(value: DialValue): boolean {
  return (
    value.resolveToAddress !== undefined ||
    value.proxyMode !== undefined ||
    value.proxyUrl !== undefined ||
    value.proxyCredentialRef !== undefined
  );
}

export interface DialRowsProps {
  /** The host group's label — the popovers' kicker. */
  groupLabel: string;
  value: DialValue;
  /** The whole next value — the host merges it into its own draft. */
  onChange: (next: DialValue) => void;
  /** Editor-specific popover copy; `undefined` for a key falls back
   *  to the shared request-settings copy. */
  rowInfo?: (key: DialInfoKey) => InfoPopoverContent | undefined;
  /** Keys whose value differs from the saved baseline (the HTTP tab's
   *  unsaved plane); absent = no such plane. */
  unsaved?: ReadonlySet<string>;
  /** The ancestor plane: inherited values as placeholders with their
   *  source line. The proxy trio is one unit — an inherited mode's URL
   *  reads in the Proxy row's placeholder; the URL rows render for an
   *  OWN Custom mode alone (a URL never rides another level's mode). */
  inherited?: InheritedSettingsView;
  /** `<prefix>-resolve-to-address`, `<prefix>-proxy-mode`, … */
  testIdPrefix: string;
}

const DialRows: React.FC<DialRowsProps> = ({
  groupLabel,
  value,
  onChange,
  rowInfo,
  unsaved,
  inherited,
  testIdPrefix,
}) => {
  const t = useT();
  const info = (key: DialInfoKey): InfoPopoverContent => rowInfo?.(key) ?? dialRowInfo(t, key, groupLabel);
  const isUnsaved = (key: DialKey): boolean => unsaved?.has(key) === true;
  const rows = inheritedRowsFor(inherited);
  const proxyModeLabel = (mode: ProxyMode): string => {
    if (mode === 'direct') return t('workbench.editors.request.settings.proxyModeDirect');
    const url = inherited?.settings.proxyUrl;
    const custom = t('workbench.editors.request.settings.proxyModeCustom');
    return url === undefined ? custom : `${custom} — ${url}`;
  };
  // Vault string entries feed the proxy-credentials picker — a
  // `user:password` pair is string-shaped, no dedicated entry kind. The
  // context defaults to an empty vault when no provider is mounted, so
  // the rows stay renderable everywhere; a ref with no entry here warns
  // in place.
  const { vault } = useVaultContext();
  const proxyCredentialOptions = vault.secrets
    .filter((s) => s.kind === 'string')
    .map((s) => ({ value: s.name, label: s.name }));
  const proxyCredentialRefDangling =
    value.proxyCredentialRef !== undefined && !proxyCredentialOptions.some((o) => o.value === value.proxyCredentialRef);
  const set = (patch: DialValue): void => onChange({ ...value, ...patch });

  return (
    <>
      <TextKnobRow
        label={t('workbench.editors.request.settings.resolveToAddress')}
        value={value.resolveToAddress}
        onChange={(resolveToAddress) => set({ resolveToAddress })}
        info={info('resolveToAddress')}
        {...rows.field(
          'resolveToAddress',
          value.resolveToAddress,
          t('workbench.editors.request.settings.resolveToAddressPlaceholder'),
          String,
        )}
        maxLength={MAX_RESOLVE_TO_ADDRESS_LENGTH}
        error={
          value.resolveToAddress !== undefined && !RESOLVE_TO_ADDRESS_PATTERN.test(value.resolveToAddress)
            ? t('workbench.editors.request.settings.resolveToAddressError')
            : undefined
        }
        example={t('workbench.editors.request.settings.resolveToAddressExample')}
        unsaved={isUnsaved('resolveToAddress')}
        testId={`${testIdPrefix}-resolve-to-address`}
      />
      <SelectKnobRow
        label={t('workbench.editors.request.settings.proxy')}
        value={value.proxyMode}
        onChange={(v) =>
          v === 'url'
            ? set({ proxyMode: 'url' })
            : set({
                proxyMode: v === 'direct' ? 'direct' : undefined,
                proxyUrl: undefined,
                proxyCredentialRef: undefined,
              })
        }
        info={info('proxy')}
        options={[
          { value: 'inherit', label: t('workbench.editors.request.settings.proxyModePlaceholder') },
          { value: 'direct', label: t('workbench.editors.request.settings.proxyModeDirect') },
          { value: 'url', label: t('workbench.editors.request.settings.proxyModeCustom') },
        ]}
        {...rows.field(
          'proxyMode',
          value.proxyMode,
          t('workbench.editors.request.settings.proxyModePlaceholder'),
          proxyModeLabel,
        )}
        modified={value.proxyMode !== undefined || value.proxyUrl !== undefined}
        unsaved={isUnsaved('proxyMode')}
        onReset={() => set({ proxyMode: undefined, proxyUrl: undefined, proxyCredentialRef: undefined })}
        testId={`${testIdPrefix}-proxy-mode`}
      />
      {value.proxyMode === 'url' && (
        <>
          <TextKnobRow
            label={t('workbench.editors.request.settings.proxyUrl')}
            value={value.proxyUrl}
            onChange={(proxyUrl) =>
              // Clearing the URL also clears its credentials — they
              // have nothing to authenticate against.
              set(proxyUrl === undefined ? { proxyUrl, proxyCredentialRef: undefined } : { proxyUrl })
            }
            info={info('proxyUrl')}
            placeholder={t('workbench.editors.request.settings.proxyUrlPlaceholder')}
            testId={`${testIdPrefix}-proxy-url`}
            onReset={() => set({ proxyUrl: undefined, proxyCredentialRef: undefined })}
            unsaved={isUnsaved('proxyUrl')}
            maxLength={MAX_PROXY_URL_LENGTH}
            error={
              value.proxyUrl === undefined
                ? t('workbench.editors.request.settings.proxyUrlMissing')
                : !isValidProxyUrl(value.proxyUrl)
                  ? t('workbench.editors.request.settings.proxyError')
                  : undefined
            }
            warning={
              value.proxyUrl !== undefined && value.resolveToAddress !== undefined
                ? t('workbench.editors.request.settings.proxyResolveConflict')
                : undefined
            }
            example={t('workbench.editors.request.settings.proxyUrlExample')}
          />
          {value.proxyUrl !== undefined && (
            <SelectKnobRow
              label={t('workbench.editors.request.settings.proxyCredentials')}
              value={value.proxyCredentialRef}
              onChange={(proxyCredentialRef) => set({ proxyCredentialRef })}
              info={info('proxyCredentials')}
              options={proxyCredentialOptions}
              placeholder={t('workbench.editors.request.settings.proxyCredentialsPlaceholder')}
              searchable
              notFoundContent={
                <Text type="secondary" style={{ fontSize: 12, padding: '6px 8px' }}>
                  {t('workbench.editors.request.settings.proxyCredentialsEmpty')}
                </Text>
              }
              popupFooter={(close) => (
                <VaultSelectFooter
                  label={t('workbench.editors.request.settings.vaultManageCredentials')}
                  testId={`${testIdPrefix}-proxy-credentials-manage`}
                  onNavigate={close}
                />
              )}
              unsaved={isUnsaved('proxyCredentialRef')}
              warning={
                proxyCredentialRefDangling
                  ? t('workbench.editors.request.settings.proxyCredentialsDangling', {
                      name: value.proxyCredentialRef ?? '',
                    })
                  : undefined
              }
              testId={`${testIdPrefix}-proxy-credentials`}
            />
          )}
        </>
      )}
    </>
  );
};

export default DialRows;
