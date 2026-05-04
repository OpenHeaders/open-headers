/**
 * VariableTable — shared spreadsheet-style editor for every "list of
 * named values" surface in the workbench.
 *
 * Two modes, picked at the call site:
 *   - `mode="variable"` (default) — env / workspace / collection
 *     variables. Row shape is `V5.Variable`; `allowSecrets` toggles
 *     the per-row sensitive marker.
 *   - `mode="vault"`              — vault secrets. Row shape is the
 *     `V5.VaultSecret` discriminated union; the per-row "kind" picker
 *     swaps between a literal string value and an RFC 6238 TOTP
 *     entry (seed + algorithm/digits/period + a live countdown +
 *     code preview). All rows are implicitly sensitive — vault is
 *     local-per-device by definition.
 *
 * Visual UX is the same across both modes — inline borderless inputs,
 * trailing placeholder row that materializes on type, hover-revealed
 * drag handle / delete. TOTP rows expand a second line below the seed
 * for the algorithm/digits/period collapse + the live preview.
 *
 * State is fully owned by the parent (controlled component). Internal
 * state syncs via fingerprint comparison so an external save doesn't
 * drop in-flight keystrokes.
 */

import {
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  HolderOutlined,
  SecurityScanOutlined,
  SecurityScanTwoTone,
} from '@ant-design/icons';
import type { DragEndEvent, Modifier } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { V5 } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { Collapse, Input, InputNumber, Select, Tooltip, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ConflictDiffChip, EntityField } from '@/shared/awareness';
import type { PathConflict } from '@/shared/conflicts/types';
import TotpPreview from '../totp/TotpPreview';

/** Per-row awareness path generator. Editors pass `VARIABLE_PATHS.row`
 *  (or a curried equivalent) when they want per-row presence chips +
 *  field-focus publishing. Vault mode skips per §14.4 of the sync
 *  design (sensitive entities use entity-level-only awareness). */
export type VariableRowPath = (uid: string, leaf: 'name' | 'value' | 'type') => string;

/** Bridge into the entity-level conflict tracker. Editors expose the
 *  three operations the inline `<ConflictDiffChip>` needs:
 *
 *    - `getLeafConflict(uid, leaf, local)` — null when no conflict.
 *    - `onAcceptTheirs(path, theirs)`     — write into the draft + ack tracker.
 *    - `onDismiss(path)`                  — keep mine, dismiss the chip.
 *
 *  Vault mode passes its own bridge with `secrets.<uid>.<leaf>` paths
 *  via `vaultRowPath`. */
export interface VariableTableConflictBridge {
  getLeafConflict(path: string, local: string): PathConflict | null;
  onAcceptTheirs(path: string, theirs: string): void;
  onDismiss(path: string): void;
}

// ── Types ──────────────────────────────────────────────────────────

type RowKind = 'string' | 'totp';

/**
 * Internal row state — superset of every persisted shape the table
 * supports. Only fields relevant to the row's `kind` matter on
 * serialize-back; the rest are kept around so switching kinds back and
 * forth doesn't lose what the user typed before the toggle.
 */
interface LocalRow {
  uid: string;
  kind: RowKind;
  name: string;
  /** String-kind value, or seed-row stash when kind switches to TOTP and back. */
  value: string;
  isSensitive: boolean;
  isPlaceholder: boolean;
  // ── TOTP-only fields (defaulted on insert; ignored when kind='string') ──
  seed: string;
  algorithm: V5.TotpAlgorithm;
  digits: number;
  period: number;
  issuer?: string;
}

const TOTP_DEFAULTS = { algorithm: 'SHA1' as V5.TotpAlgorithm, digits: 6, period: 30 };

const EMPTY_SECRETS: V5.VaultSecret[] = [];
const EMPTY_VARS: V5.Variable[] = [];

type VariableTableProps =
  | {
      mode?: 'variable';
      variables: V5.Variable[];
      onChange: (next: V5.Variable[]) => void;
      /** Disallow marking rows as secret (used for the collection-vars
       *  editor — collection vars are synced via Git and never encrypted). */
      allowSecrets?: boolean;
      /** Per-row awareness path generator. When provided, name + value
       *  inputs publish focus + render presence chips against
       *  `(entityType, entityId, rowPath(uid, leaf))`. Editors must mount
       *  an `<EntityScopeProvider>` upstream so the entity context is set. */
      rowPath?: VariableRowPath;
      /** Per-leaf conflict bridge into the entity tracker. Optional. */
      conflictBridge?: VariableTableConflictBridge;
    }
  | {
      mode: 'vault';
      secrets: V5.VaultSecret[];
      onChange: (next: V5.VaultSecret[]) => void;
      /** Per-leaf conflict bridge for vault. Path encoding is
       *  `secrets.<uid>.<leaf>` — name + (kind-specific leaves). */
      conflictBridge?: VariableTableConflictBridge;
    };

// Local row uid doubles as the persisted schema uid — same shape (8-char
// lowercase-alphanumeric per `UidSchema`) so dnd-kit and the sync-engine
// itemId are the same string. Survives reorders and persists across save.
function genUid(): string {
  return generateUid();
}

// Pin the drag to vertical only; our row layout is a spreadsheet and
// horizontal drift adds noise without any meaningful UX gain. Inlined
// because `@dnd-kit/modifiers` isn't in the extension's dependency
// set and this one-liner is the only modifier we use.
const restrictVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

function emptyRow(isPlaceholder: boolean): LocalRow {
  return {
    uid: genUid(),
    kind: 'string',
    name: '',
    value: '',
    isSensitive: false,
    isPlaceholder,
    seed: '',
    algorithm: TOTP_DEFAULTS.algorithm,
    digits: TOTP_DEFAULTS.digits,
    period: TOTP_DEFAULTS.period,
  };
}

function variablesToLocal(variables: V5.Variable[]): LocalRow[] {
  const rows: LocalRow[] = variables.map((v) => ({
    ...emptyRow(false),
    uid: v.uid,
    name: v.name,
    value: v.value,
    isSensitive: v.type === 'secret',
  }));
  rows.push(emptyRow(true));
  return rows;
}

function variablesFromLocal(rows: LocalRow[]): V5.Variable[] {
  const out: V5.Variable[] = [];
  for (const row of rows) {
    if (row.isPlaceholder || !row.name.trim()) continue;
    out.push({
      uid: row.uid,
      name: row.name.trim(),
      value: row.value,
      type: row.isSensitive ? 'secret' : 'default',
    });
  }
  return out;
}

function variablesFingerprint(vars: V5.Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.uid, v.name, v.value, v.type]));
}

function secretsToLocal(secrets: V5.VaultSecret[]): LocalRow[] {
  const rows: LocalRow[] = secrets.map((s) =>
    s.kind === 'totp'
      ? {
          ...emptyRow(false),
          uid: s.uid,
          kind: 'totp',
          name: s.name,
          isSensitive: true,
          seed: s.seed,
          algorithm: s.algorithm,
          digits: s.digits,
          period: s.period,
          ...(s.issuer ? { issuer: s.issuer } : {}),
        }
      : {
          ...emptyRow(false),
          uid: s.uid,
          kind: 'string',
          name: s.name,
          value: s.value,
          isSensitive: true,
        },
  );
  rows.push(emptyRow(true));
  return rows;
}

function secretsFromLocal(rows: LocalRow[]): V5.VaultSecret[] {
  const out: V5.VaultSecret[] = [];
  for (const row of rows) {
    if (row.isPlaceholder || !row.name.trim()) continue;
    const name = row.name.trim();
    if (row.kind === 'totp') {
      out.push({
        uid: row.uid,
        kind: 'totp',
        name,
        seed: row.seed,
        algorithm: row.algorithm,
        digits: row.digits,
        period: row.period,
        ...(row.issuer ? { issuer: row.issuer } : {}),
      });
    } else {
      out.push({ uid: row.uid, kind: 'string', name, value: row.value });
    }
  }
  return out;
}

function secretsFingerprint(secrets: V5.VaultSecret[]): string {
  return JSON.stringify(
    secrets.map((s) =>
      s.kind === 'totp'
        ? ['totp', s.uid, s.name, s.seed, s.algorithm, s.digits, s.period, s.issuer ?? '']
        : ['string', s.uid, s.name, s.value],
    ),
  );
}

// ── Grid template ──────────────────────────────────────────────────

const GRID_COLS = '28px 1fr 1fr 28px';

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
}

// `-webkit-text-security` isn't in csstype yet, so React.CSSProperties
// rejects the camelCased key. Extend locally rather than reaching for
// `any` — the value set is closed (`disc | circle | square | none`) and
// the property is well-defined in WebKit, Blink, and Gecko (Firefox 124+).
type CSSWithTextSecurity = React.CSSProperties & {
  WebkitTextSecurity?: 'none' | 'disc' | 'circle' | 'square';
};

function ValueCell({ value, masked, onChange, onReveal }: ValueCellProps) {
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
      placeholder="Value"
      variant="borderless"
      autoSize={{ minRows: 1, maxRows: 4 }}
      onChange={(e) => onChange(e.target.value)}
      onFocus={handleFocus}
      style={style}
    />
  );
}

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

function SortableRow({
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
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: row.uid,
    disabled: row.isPlaceholder,
  });

  const isVault = mode === 'vault';
  const isTotp = isVault && row.kind === 'totp' && !row.isPlaceholder;
  const setPathPrefix = isVault ? 'secrets' : 'variables';
  const conflictPathFor = (leaf: string) => `${setPathPrefix}.${row.uid}.${leaf}`;
  const nameConflict =
    !row.isPlaceholder && conflictBridge
      ? conflictBridge.getLeafConflict(conflictPathFor('name'), row.name)
      : null;
  const valueConflict =
    !row.isPlaceholder && conflictBridge && !isTotp
      ? conflictBridge.getLeafConflict(conflictPathFor('value'), row.value)
      : null;

  const style: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: GRID_COLS,
    borderBottom: isLast ? undefined : `1px solid ${token.colorBorderSecondary}`,
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative' as const, zIndex: 50, opacity: 0.85 } : {}),
    alignItems: isTotp ? 'flex-start' : 'stretch',
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

      <div
        style={{
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderLeft: `1px solid ${token.colorBorderSecondary}`,
          minHeight: 30,
        }}
      >
        {(() => {
          const nameInput = (
            <input
              value={row.name}
              placeholder={row.isPlaceholder ? (isVault ? 'Add secret…' : 'Add variable…') : 'Name'}
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
        {!isVault && allowSecrets && !row.isPlaceholder && (
          <Tooltip title={row.isSensitive ? 'Unmark as sensitive' : 'Mark as sensitive'}>
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
                { value: 'string', label: 'Text' },
                { value: 'totp', label: 'TOTP' },
              ]}
              style={{ width: 72, flexShrink: 0 }}
              disabled={row.isPlaceholder}
              popupMatchSelectWidth={false}
            />
          )}
          {isTotp ? (
            <>
              <input
                value={row.seed}
                type={isSeedRevealed ? 'text' : 'password'}
                placeholder="Base32 seed"
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
              <Tooltip title={isSeedRevealed ? 'Hide seed' : 'Show seed'}>
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
                <Tooltip title={isRevealed ? 'Hide value' : 'Show value'}>
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
                    {row.algorithm} · {row.digits} digits · {row.period}s{row.issuer ? ` · ${row.issuer}` : ''}
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
                      placeholder="Issuer"
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

// ── Table ──────────────────────────────────────────────────────────

const VariableTable: React.FC<VariableTableProps> = (props) => {
  const { token } = theme.useToken();

  // Hoist the mode + raw source out so every downstream useEffect /
  // useCallback closes over a single shape, sidestepping the
  // discriminated-union narrowing pitfall when reading `props.X`
  // inside callbacks that outlive the render.
  const isVaultMode = props.mode === 'vault';
  const sourceSecrets: V5.VaultSecret[] = isVaultMode ? props.secrets : EMPTY_SECRETS;
  const sourceVariables: V5.Variable[] = isVaultMode ? EMPTY_VARS : props.variables;
  const onChangeRef = useRef(props.onChange);
  onChangeRef.current = props.onChange;

  const initialFp = isVaultMode ? secretsFingerprint(sourceSecrets) : variablesFingerprint(sourceVariables);
  const initialRows = isVaultMode ? secretsToLocal(sourceSecrets) : variablesToLocal(sourceVariables);

  const [rows, setRows] = useState<LocalRow[]>(initialRows);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [seedRevealed, setSeedRevealed] = useState<Set<string>>(new Set());
  const lastExternalFp = useRef<string>(initialFp);

  // Re-sync when the controlling prop changes from outside (workspace
  // switch, external save). Comparing fingerprints avoids clobbering
  // in-flight edits on re-renders where the prop object identity
  // changes but the data is equivalent.
  useEffect(() => {
    const nextFp = isVaultMode ? secretsFingerprint(sourceSecrets) : variablesFingerprint(sourceVariables);
    if (nextFp !== lastExternalFp.current) {
      lastExternalFp.current = nextFp;
      setRows(isVaultMode ? secretsToLocal(sourceSecrets) : variablesToLocal(sourceVariables));
      setRevealed(new Set());
      setSeedRevealed(new Set());
    }
  }, [isVaultMode, sourceSecrets, sourceVariables]);

  // Push row changes back to the parent in the right shape for the mode.
  const pushUp = useCallback(
    (nextRows: LocalRow[]) => {
      if (isVaultMode) {
        const next = secretsFromLocal(nextRows);
        lastExternalFp.current = secretsFingerprint(next);
        (onChangeRef.current as (n: V5.VaultSecret[]) => void)(next);
      } else {
        const next = variablesFromLocal(nextRows);
        lastExternalFp.current = variablesFingerprint(next);
        (onChangeRef.current as (n: V5.Variable[]) => void)(next);
      }
    },
    [isVaultMode],
  );

  const update = useCallback(
    (index: number, patch: Partial<LocalRow>) => {
      setRows((prev) => {
        const prior = prev[index];
        if (!prior) return prev;

        // Switching kind in vault mode: keep the row's name but reset
        // kind-specific fields so cross-kind ghosts can't appear in
        // the persisted shape (e.g. a seed lingering on a re-string'd
        // row would never serialize, but we'd rather keep the local
        // state honest).
        let row: LocalRow = { ...prior, ...patch };
        if (patch.kind && patch.kind !== prior.kind) {
          if (patch.kind === 'totp') {
            row = {
              ...prior,
              ...patch,
              isPlaceholder: false,
              isSensitive: true,
              seed: '',
              algorithm: TOTP_DEFAULTS.algorithm,
              digits: TOTP_DEFAULTS.digits,
              period: TOTP_DEFAULTS.period,
              issuer: undefined,
            };
          } else {
            row = { ...prior, ...patch, value: '', isPlaceholder: false };
          }
        }

        const next = [...prev];
        next[index] = row;

        // Materialize placeholder → real row + append a fresh placeholder.
        if (prior.isPlaceholder && (row.name || row.value)) {
          row.isPlaceholder = false;
          next[index] = row;
          next.push(emptyRow(true));
        }
        pushUp(next);
        return next;
      });
    },
    [pushUp],
  );

  const remove = useCallback(
    (index: number) => {
      setRows((prev) => {
        const next = prev.filter((_, i) => i !== index);
        if (!next.some((r) => r.isPlaceholder)) {
          next.push(emptyRow(true));
        }
        pushUp(next);
        return next;
      });
    },
    [pushUp],
  );

  const toggleReveal = useCallback((uid: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);
  const toggleSeedReveal = useCallback((uid: string) => {
    setSeedRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over || active.id === over.id) return;
      setRows((prev) => {
        const oldIndex = prev.findIndex((r) => r.uid === active.id);
        const newIndex = prev.findIndex((r) => r.uid === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const next = arrayMove(prev, oldIndex, newIndex);
        pushUp(next);
        return next;
      });
    },
    [pushUp],
  );

  const allowSecrets = !isVaultMode && (props.allowSecrets ?? true);
  const nameHeader = isVaultMode ? 'Secret' : 'Variable';
  const mode: 'variable' | 'vault' = isVaultMode ? 'vault' : 'variable';
  const rowPath = isVaultMode ? undefined : props.rowPath;
  const conflictBridge = props.conflictBridge;

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID_COLS,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <div style={{ padding: '6px 8px' }} />
        <div
          style={{
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: token.colorTextSecondary,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          {nameHeader}
        </div>
        <div
          style={{
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 600,
            color: token.colorTextSecondary,
            borderLeft: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          Value
        </div>
        <div style={{ padding: '6px 8px' }} />
      </div>

      <DndContext modifiers={[restrictVertical]} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.uid)} strategy={verticalListSortingStrategy}>
          {rows.map((row, index) => (
            <SortableRow
              key={row.uid}
              row={row}
              index={index}
              isLast={index === rows.length - 1}
              isRevealed={revealed.has(row.uid)}
              isSeedRevealed={seedRevealed.has(row.uid)}
              mode={mode}
              allowSecrets={allowSecrets}
              rowPath={rowPath}
              conflictBridge={conflictBridge}
              update={update}
              remove={remove}
              toggleReveal={toggleReveal}
              toggleSeedReveal={toggleSeedReveal}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default VariableTable;
