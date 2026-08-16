/**
 * VariableTableRow — one sortable row of `VariableTable`: drag handle,
 * name input (with sensitive marker in variable mode), the mode-aware
 * value column (string ValueCell or the TOTP seed + advanced collapse),
 * inline conflict chips, and delete.
 */

import {
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HolderOutlined,
  SecurityScanOutlined,
  SecurityScanTwoTone,
} from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  buildSecretLocator,
  formatSecretLocator,
  isSecretLocatorComplete,
  SECRET_LOCATOR_FIELDS,
  SECRET_PROVIDER_IDS,
} from '@openheaders/core/secret-providers';
import type { SecretProviderId } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { MessageKey } from '@openheaders/i18n';
import { Collapse, Input, InputNumber, Select, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback } from 'react';
import { ConflictDiffChip, EntityField, SetRowConflictChip } from '@openheaders/ui/shared/awareness';
import TotpPreview from '../totp/TotpPreview';
import SecretProviderStatusChip from './SecretProviderStatusChip';
import {
  gridColsFor,
  type LocalRow,
  type RowKind,
  type VariableRowPath,
  type VariableTableConflictBridge,
} from './variable-table-rows';

// ── Value cell ─────────────────────────────────────────────────────
//
// Always-mounted `<Input.TextArea>` — no display→edit swap. Three
// reasons over the previous div→textarea pattern:
//   1. Awareness signal quality. Per-field focus publishes synchronously
//      on the real `focus` event with no remount in between, so peer
//      presence chips don't race the swap mid-rebroadcast.
//   2. Single render path. Less state (no `editing` flag), less reconciliation
//      under high-concurrency rebroadcast — fewer surfaces for races to land on.
//   3. Native UX. Browser handles click→caret-position natively; no
//      `setSelectionRange`, no `useEffect`, no caret-on-mount workaround.
// Masking for sensitive values uses `WebkitTextSecurity: 'disc'` — the
// real value stays in the DOM (same as the previous edit-mode textarea)
// and CSS replaces glyphs with bullets when masked.

interface ValueCellProps {
  value: string;
  masked: boolean;
  onChange: (next: string) => void;
  onReveal?: () => void;
  /** Field hint; defaults to "Value" (the PEM cells name their field). */
  placeholder?: string;
}

// `-webkit-text-security` isn't in csstype yet, so React.CSSProperties
// rejects the camelCased key. Extend locally rather than reaching for
// `any` — the value set is closed (`disc | circle | square | none`) and
// the property is well-defined in WebKit, Blink, and Gecko (Firefox 124+).
type CSSWithTextSecurity = React.CSSProperties & {
  WebkitTextSecurity?: 'none' | 'disc' | 'circle' | 'square';
};

function ValueCell({ value, masked, onChange, onReveal, placeholder }: ValueCellProps) {
  const t = useT();
  const handleFocus = useCallback(() => {
    if (masked) onReveal?.();
  }, [masked, onReveal]);

  const style: CSSWithTextSecurity = {
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    fontSize: 12,
    padding: '4px 6px',
    resize: 'none',
    width: '100%',
    // Bullets in place of real glyphs when masked. Chromium / Safari /
    // Edge native; Firefox 124+ (early 2024). On older Firefox the
    // value renders unmasked — graceful degradation, not a security
    // failure (it's the user's own machine, secrets never crossed a
    // trust boundary anyway).
    WebkitTextSecurity: masked ? 'disc' : undefined,
  };

  return (
    <Input.TextArea
      value={value}
      placeholder={placeholder ?? t('workbench.variables.table.valuePlaceholder')}
      variant="borderless"
      autoSize={{ minRows: 1, maxRows: 4 }}
      onChange={(e) => onChange(e.target.value)}
      onFocus={handleFocus}
      style={style}
    />
  );
}

// ── Secret-manager label catalogs ──────────────────────────────────
// Explicit key maps (never computed template keys) so the message-key
// union stays typecheckable — same idiom as the conflict adapters.

const SM_PROVIDER_LABEL: Record<SecretProviderId, MessageKey> = {
  onepassword: 'workbench.variables.table.smProvider.onepassword',
  bitwarden: 'workbench.variables.table.smProvider.bitwarden',
  oskeychain: 'workbench.variables.table.smProvider.oskeychain',
  awssm: 'workbench.variables.table.smProvider.awssm',
  azurekv: 'workbench.variables.table.smProvider.azurekv',
  hashivault: 'workbench.variables.table.smProvider.hashivault',
};

const SM_FIELD_LABEL: Record<string, MessageKey> = {
  vault: 'workbench.variables.table.smField.vault',
  item: 'workbench.variables.table.smField.item',
  field: 'workbench.variables.table.smField.field',
  account: 'workbench.variables.table.smField.account',
  secretId: 'workbench.variables.table.smField.secretId',
  service: 'workbench.variables.table.smField.service',
  name: 'workbench.variables.table.smField.name',
  stage: 'workbench.variables.table.smField.stage',
  region: 'workbench.variables.table.smField.region',
  profile: 'workbench.variables.table.smField.profile',
  vaultUrl: 'workbench.variables.table.smField.vaultUrl',
  version: 'workbench.variables.table.smField.version',
  mount: 'workbench.variables.table.smField.mount',
  path: 'workbench.variables.table.smField.path',
  key: 'workbench.variables.table.smField.key',
  serverUrl: 'workbench.variables.table.smField.serverUrl',
};

// ── Sortable row ───────────────────────────────────────────────────

interface SortableRowProps {
  row: LocalRow;
  index: number;
  isLast: boolean;
  isRevealed: boolean;
  isSeedRevealed: boolean;
  mode: 'variable' | 'vault';
  allowSecrets: boolean;
  rowPath?: VariableRowPath;
  conflictBridge?: VariableTableConflictBridge;
  update: (i: number, patch: Partial<LocalRow>) => void;
  remove: (i: number) => void;
  toggleReveal: (uid: string) => void;
  toggleSeedReveal: (uid: string) => void;
}

export function SortableRow({
  row,
  index,
  isLast,
  isRevealed,
  isSeedRevealed,
  mode,
  allowSecrets,
  rowPath,
  conflictBridge,
  update,
  remove,
  toggleReveal,
  toggleSeedReveal,
}: SortableRowProps) {
  const { token } = theme.useToken();
  const t = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.uid,
    disabled: row.isPlaceholder,
  });

  const isVault = mode === 'vault';
  const isTotp = isVault && row.kind === 'totp' && !row.isPlaceholder;
  const isCert = isVault && row.kind === 'client-certificate' && !row.isPlaceholder;
  const isSecretManager = isVault && row.kind === 'secret-manager' && !row.isPlaceholder;
  const setPathPrefix = isVault ? 'secrets' : 'variables';
  const conflictPathFor = (leaf: string) => `${setPathPrefix}.${row.uid}.${leaf}`;
  const nameConflict =
    !row.isPlaceholder && conflictBridge
      ? conflictBridge.getLeafConflict(conflictPathFor('name'), row.name)
      : null;
  const valueConflict =
    !row.isPlaceholder && conflictBridge && !isTotp && !isCert && !isSecretManager
      ? conflictBridge.getLeafConflict(conflictPathFor('value'), row.value)
      : null;
  // Set-level conflict: this row was removed externally while still in
  // the local form. Surfaces inline beside the row name; "Use saved"
  // drops the row + acks the conflict, "Keep mine" dismisses (the next
  // save will recreate the row in canonical state via LWW).
  const setRemoveConflict =
    !row.isPlaceholder && conflictBridge?.getSetConflict
      ? conflictBridge.getSetConflict(setPathPrefix, row.uid, true)
      : null;
  const setRemove = setRemoveConflict?.kind === 'set-remove' ? setRemoveConflict : null;

  // Disabled rows dim their content but keep every control interactive —
  // the checkbox is the way back on.
  const rowDimmed = !isVault && !row.isPlaceholder && !row.isEnabled;

  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: gridColsFor(mode),
    borderBottom: isLast ? undefined : `1px solid ${token.colorBorderSecondary}`,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative' as const, zIndex: 50, opacity: 0.85 } : {}),
    alignItems: isTotp || isCert || isSecretManager ? 'flex-start' : 'stretch',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 30 }}>
        {!row.isPlaceholder && (
          <span ref={setActivatorNodeRef} {...listeners} style={{ cursor: 'grab', display: 'flex' }}>
            <HolderOutlined style={{ fontSize: 12, color: token.colorTextQuaternary }} />
          </span>
        )}
      </div>

      {!isVault && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 30 }}>
          {!row.isPlaceholder && (
            <input
              type="checkbox"
              checked={row.isEnabled}
              onChange={(e) => update(index, { isEnabled: e.target.checked })}
              aria-label={
                row.isEnabled
                  ? t('workbench.variables.table.disableRow')
                  : t('workbench.variables.table.enableRow')
              }
              title={
                row.isEnabled
                  ? t('workbench.variables.table.disableRow')
                  : t('workbench.variables.table.enableRow')
              }
              style={{ width: 14, height: 14, cursor: 'pointer' }}
            />
          )}
        </div>
      )}

      <div
        style={{
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          minHeight: 30,
          opacity: rowDimmed ? 0.55 : 1,
        }}
      >
        {(() => {
          const nameInput = (
            <input
              value={row.name}
              placeholder={
                row.isPlaceholder
                  ? isVault
                    ? t('workbench.variables.table.addSecret')
                    : t('workbench.variables.table.addVariable')
                  : t('workbench.variables.table.namePlaceholder')
              }
              onChange={(e) => update(index, { name: e.target.value, isPlaceholder: false })}
              style={{
                fontFamily: "'SF Mono', 'Fira Code', monospace",
                fontSize: 12,
                fontWeight: row.isPlaceholder ? 400 : 500,
                color: row.isPlaceholder ? token.colorTextQuaternary : token.colorText,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                flex: 1,
                minWidth: 0,
                padding: '6px',
              }}
            />
          );
          // Wrap unconditionally when rowPath is set (vault skips because
          // it doesn't pass rowPath, per §14.4). Conditioning on
          // `!row.isPlaceholder` would remount the input on first
          // keystroke (placeholder→real transition flips the wrapper),
          // dropping focus mid-type. The placeholder uid is already
          // generateUid()-shaped and is the same uid that persists once
          // the row materializes — publishing focus from it is harmless.
          return rowPath
            ? <EntityField path={rowPath(row.uid, 'name')}>{nameInput}</EntityField>
            : nameInput;
        })()}
        {nameConflict && conflictBridge && (
          <ConflictDiffChip
            theirs={nameConflict.theirs}
            base={nameConflict.base}
            local={row.name}
            remote={nameConflict.remote}
            onTakeTheirs={() => conflictBridge.onAcceptTheirs(conflictPathFor('name'), nameConflict.theirs)}
            onKeepMine={() => conflictBridge.onDismiss(conflictPathFor('name'))}
          />
        )}
        {setRemove && conflictBridge && (
          <SetRowConflictChip
            baseSummary={setRemove.base}
            remote={setRemove.remote}
            onUseSaved={() => {
              remove(index);
              conflictBridge.onAcceptTheirs(`set:${setPathPrefix}.${row.uid}`, '');
            }}
            onKeepMine={() => conflictBridge.onDismiss(`set:${setPathPrefix}.${row.uid}`)}
          />
        )}
        {!isVault && allowSecrets && !row.isPlaceholder && (
          <Tooltip
            title={
              row.isSensitive
                ? t('workbench.variables.table.unmarkSensitive')
                : t('workbench.variables.table.markSensitive')
            }
          >
            {row.isSensitive ? (
              <SecurityScanTwoTone
                twoToneColor={token.colorPrimary}
                style={{ fontSize: 14, cursor: 'pointer' }}
                onClick={() => update(index, { isSensitive: false })}
              />
            ) : (
              <SecurityScanOutlined
                style={{ fontSize: 14, cursor: 'pointer', color: token.colorTextQuaternary }}
                onClick={() => update(index, { isSensitive: true })}
              />
            )}
          </Tooltip>
        )}
      </div>

      <div
        style={{
          padding: '2px 4px',
          display: 'flex',
          flexDirection: isTotp ? 'column' : 'row',
          alignItems: isTotp ? 'stretch' : 'center',
          gap: 4,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          overflow: 'hidden',
          minWidth: 0,
          opacity: rowDimmed ? 0.55 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
          {isVault && (
            <Select
              variant="borderless"
              size="small"
              value={row.kind}
              onChange={(v) => update(index, { kind: v as RowKind })}
              options={[
                { value: 'string', label: t('workbench.variables.table.kindText') },
                { value: 'totp', label: t('workbench.variables.table.kindTotp') },
                { value: 'client-certificate', label: t('workbench.variables.table.kindCertificate') },
                { value: 'secret-manager', label: t('workbench.variables.table.kindSecretManager') },
              ]}
              style={{ width: 112, flexShrink: 0 }}
              disabled={row.isPlaceholder}
              popupMatchSelectWidth={false}
            />
          )}
          {isSecretManager ? (
            (() => {
              const locator = buildSecretLocator(row.smProvider, row.smFields);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Select
                      variant="borderless"
                      size="small"
                      value={row.smProvider}
                      onChange={(v) => update(index, { smProvider: v as SecretProviderId, smFields: {} })}
                      options={SECRET_PROVIDER_IDS.map((id) => ({ value: id, label: t(SM_PROVIDER_LABEL[id]) }))}
                      style={{ minWidth: 140, flexShrink: 0 }}
                      popupMatchSelectWidth={false}
                      data-testid="vault-sm-provider"
                    />
                    <SecretProviderStatusChip provider={row.smProvider} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {SECRET_LOCATOR_FIELDS[row.smProvider].map((spec) => (
                      <Input
                        key={spec.key}
                        size="small"
                        variant="borderless"
                        value={row.smFields[spec.key] ?? ''}
                        placeholder={
                          spec.required
                            ? t(SM_FIELD_LABEL[spec.key])
                            : t('workbench.variables.table.smFieldOptional', { label: t(SM_FIELD_LABEL[spec.key]) })
                        }
                        onChange={(e) => update(index, { smFields: { ...row.smFields, [spec.key]: e.target.value } })}
                        style={{
                          fontFamily: "'SF Mono', 'Fira Code', monospace",
                          fontSize: 12,
                          padding: '4px 6px',
                          flex: '1 1 140px',
                          minWidth: 120,
                        }}
                        data-testid={`vault-sm-field-${spec.key}`}
                      />
                    ))}
                  </div>
                  {isSecretLocatorComplete(locator) && (
                    <span
                      style={{
                        fontFamily: "'SF Mono', 'Fira Code', monospace",
                        fontSize: 11,
                        color: token.colorTextTertiary,
                        padding: '0 6px 2px',
                        overflowWrap: 'anywhere',
                      }}
                      data-testid="vault-sm-reference"
                    >
                      {formatSecretLocator(locator)}
                    </span>
                  )}
                </div>
              );
            })()
          ) : isCert ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 }}>
                <ValueCell
                  value={row.cert}
                  masked={!isRevealed}
                  placeholder={t('workbench.variables.table.certPlaceholder')}
                  onChange={(v) => update(index, { cert: v })}
                  onReveal={() => {
                    if (!isRevealed) toggleReveal(row.uid);
                  }}
                />
                <ValueCell
                  value={row.certKey}
                  masked={!isRevealed}
                  placeholder={t('workbench.variables.table.certKeyPlaceholder')}
                  onChange={(v) => update(index, { certKey: v })}
                  onReveal={() => {
                    if (!isRevealed) toggleReveal(row.uid);
                  }}
                />
                <Input
                  size="small"
                  type={isRevealed ? 'text' : 'password'}
                  variant="borderless"
                  value={row.passphrase ?? ''}
                  placeholder={t('workbench.variables.table.passphrasePlaceholder')}
                  onChange={(e) => update(index, { passphrase: e.target.value === '' ? undefined : e.target.value })}
                  style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12, padding: '4px 6px' }}
                />
              </div>
              <Tooltip
                title={
                  isRevealed
                    ? t('workbench.variables.table.hideCertificate')
                    : t('workbench.variables.table.showCertificate')
                }
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleReveal(row.uid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') toggleReveal(row.uid);
                  }}
                  style={{ cursor: 'pointer', fontSize: 12, color: token.colorTextTertiary, padding: '0 4px' }}
                >
                  {isRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </span>
              </Tooltip>
            </>
          ) : isTotp ? (
            <>
              <input
                value={row.seed}
                type={isSeedRevealed ? 'text' : 'password'}
                placeholder={t('workbench.variables.table.seedPlaceholder')}
                onChange={(e) => update(index, { seed: e.target.value.toUpperCase().replace(/\s/g, '') })}
                style={{
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 12,
                  color: token.colorText,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  flex: 1,
                  minWidth: 0,
                  padding: '4px 6px',
                  letterSpacing: 1,
                }}
              />
              <Tooltip
                title={
                  isSeedRevealed ? t('workbench.variables.table.hideSeed') : t('workbench.variables.table.showSeed')
                }
              >
                <span
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleSeedReveal(row.uid)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') toggleSeedReveal(row.uid);
                  }}
                  style={{ cursor: 'pointer', fontSize: 12, color: token.colorTextTertiary, padding: '0 4px' }}
                >
                  {isSeedRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                </span>
              </Tooltip>
              <span style={{ flexShrink: 0 }}>
                <TotpPreview
                  seed={row.seed}
                  algorithm={row.algorithm}
                  digits={row.digits}
                  period={row.period}
                  density="compact"
                />
              </span>
            </>
          ) : (
            <>
              {(() => {
                // Wrap the flex-1 value container in EntityField (not the
                // inner ValueCell). EntityField uses `display: contents`,
                // so its FieldPresenceChip lands as a flex sibling of the
                // wrapper div in the row's value-column flex container —
                // inline with the input on the same row, matching the
                // rule editor's UX. Wrapping the inner cell instead would
                // put the chip inside the wrapper div (block layout) and
                // it would stack BELOW the textarea.
                const valueWrapper = (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ValueCell
                      value={row.value}
                      masked={row.isSensitive && !isRevealed && !row.isPlaceholder}
                      onChange={(v) => update(index, { value: v, isPlaceholder: false })}
                      onReveal={() => {
                        if (row.isSensitive && !isRevealed) toggleReveal(row.uid);
                      }}
                    />
                  </div>
                );
                return rowPath
                  ? <EntityField path={rowPath(row.uid, 'value')}>{valueWrapper}</EntityField>
                  : valueWrapper;
              })()}
              {row.isSensitive && !row.isPlaceholder && (
                <Tooltip
                  title={
                    isRevealed ? t('workbench.variables.table.hideValue') : t('workbench.variables.table.showValue')
                  }
                >
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleReveal(row.uid)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') toggleReveal(row.uid);
                    }}
                    style={{ cursor: 'pointer', fontSize: 12, color: token.colorTextTertiary, padding: '0 4px' }}
                  >
                    {isRevealed ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  </span>
                </Tooltip>
              )}
              {valueConflict && conflictBridge && (
                <ConflictDiffChip
                  theirs={valueConflict.theirs}
                  base={valueConflict.base}
                  local={row.value}
                  remote={valueConflict.remote}
                  onTakeTheirs={() => conflictBridge.onAcceptTheirs(conflictPathFor('value'), valueConflict.theirs)}
                  onKeepMine={() => conflictBridge.onDismiss(conflictPathFor('value'))}
                />
              )}
            </>
          )}
        </div>
        {isTotp && (
          <Collapse
            size="small"
            ghost
            items={[
              {
                key: 'advanced',
                label: (
                  <span style={{ fontSize: 10, color: token.colorTextSecondary }}>
                    {row.issuer
                      ? t('workbench.variables.table.totpSummaryIssuer', {
                          algorithm: row.algorithm,
                          digits: row.digits,
                          period: row.period,
                          issuer: row.issuer,
                        })
                      : t('workbench.variables.table.totpSummary', {
                          algorithm: row.algorithm,
                          digits: row.digits,
                          period: row.period,
                        })}
                  </span>
                ),
                children: (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    <Select
                      size="small"
                      value={row.algorithm}
                      onChange={(v) => update(index, { algorithm: v })}
                      options={[
                        { label: 'SHA1', value: 'SHA1' },
                        { label: 'SHA256', value: 'SHA256' },
                        { label: 'SHA512', value: 'SHA512' },
                      ]}
                      style={{ flex: '1 1 96px', minWidth: 96 }}
                    />
                    <InputNumber
                      size="small"
                      min={6}
                      max={10}
                      value={row.digits}
                      onChange={(v) => v !== null && update(index, { digits: v })}
                      style={{ flex: '0 0 70px', width: 70 }}
                    />
                    <InputNumber
                      size="small"
                      min={1}
                      max={300}
                      value={row.period}
                      onChange={(v) => v !== null && update(index, { period: v })}
                      style={{ flex: '0 0 70px', width: 70 }}
                    />
                    <Input
                      size="small"
                      value={row.issuer ?? ''}
                      placeholder={t('workbench.variables.table.issuerPlaceholder')}
                      onChange={(e) =>
                        update(index, { issuer: e.target.value.trim() === '' ? undefined : e.target.value })
                      }
                      style={{ flex: '2 1 140px', minWidth: 140 }}
                    />
                  </div>
                ),
              },
            ]}
          />
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 30 }}>
        {!row.isPlaceholder && (
          <DeleteOutlined
            style={{ fontSize: 12, color: token.colorErrorText, cursor: 'pointer' }}
            onClick={() => remove(index)}
          />
        )}
      </div>
    </div>
  );
}
