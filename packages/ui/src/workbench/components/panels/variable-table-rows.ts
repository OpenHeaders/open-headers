/**
 * Row model + codecs for `VariableTable` — the internal `LocalRow`
 * superset shape, the per-mode conversions to/from the persisted
 * `Variable` / `VaultSecret` shapes, and the fingerprints the table
 * uses to detect external changes without clobbering in-flight edits.
 */

import type { TotpAlgorithm, Variable, VaultSecret } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import type { PathConflict } from '@openheaders/ui/shared/conflicts/types';

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
  /** Optional row-level lookup: returns a `set-remove` conflict when the
   *  saved version dropped this row but the form still has it. Renders
   *  the inline `<SetRowConflictChip>` beside the row name. Mirrors the
   *  HeaderRuleFields surface — set-level conflicts surface inline next
   *  to the row identity, parallel to the leaf chip on the value side. */
  getSetConflict?(setPath: string, uid: string, formContainsUid: boolean): PathConflict | null;
  onAcceptTheirs(path: string, theirs: string): void;
  onDismiss(path: string): void;
}

export type RowKind = 'string' | 'totp';

/**
 * Internal row state — superset of every persisted shape the table
 * supports. Only fields relevant to the row's `kind` matter on
 * serialize-back; the rest are kept around so switching kinds back and
 * forth doesn't lose what the user typed before the toggle.
 */
export interface LocalRow {
  uid: string;
  kind: RowKind;
  name: string;
  /** String-kind value, or seed-row stash when kind switches to TOTP and back. */
  value: string;
  isSensitive: boolean;
  isPlaceholder: boolean;
  // ── TOTP-only fields (defaulted on insert; ignored when kind='string') ──
  seed: string;
  algorithm: TotpAlgorithm;
  digits: number;
  period: number;
  issuer?: string;
}

export const TOTP_DEFAULTS = { algorithm: 'SHA1' as TotpAlgorithm, digits: 6, period: 30 };

export const GRID_COLS = '28px 1fr 1fr 28px';

// Local row uid doubles as the persisted schema uid — same shape (8-char
// lowercase-alphanumeric per `UidSchema`) so dnd-kit and the sync-engine
// itemId are the same string. Survives reorders and persists across save.
function genUid(): string {
  return generateUid();
}

export function emptyRow(isPlaceholder: boolean): LocalRow {
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

export function variablesToLocal(variables: Variable[]): LocalRow[] {
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

export function variablesFromLocal(rows: LocalRow[]): Variable[] {
  const out: Variable[] = [];
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

export function variablesFingerprint(vars: Variable[]): string {
  return JSON.stringify(vars.map((v) => [v.uid, v.name, v.value, v.type]));
}

export function secretsToLocal(secrets: VaultSecret[]): LocalRow[] {
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

export function secretsFromLocal(rows: LocalRow[]): VaultSecret[] {
  const out: VaultSecret[] = [];
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

export function secretsFingerprint(secrets: VaultSecret[]): string {
  return JSON.stringify(
    secrets.map((s) =>
      s.kind === 'totp'
        ? ['totp', s.uid, s.name, s.seed, s.algorithm, s.digits, s.period, s.issuer ?? '']
        : ['string', s.uid, s.name, s.value],
    ),
  );
}
