/**
 * VariableTable — shared spreadsheet-style editor for every "list of
 * named values" surface in the workbench.
 *
 * Two modes, picked at the call site:
 *   - `mode="variable"` (default) — env / workspace / collection
 *     variables. Row shape is `Variable`; `allowSecrets` toggles
 *     the per-row sensitive marker.
 *   - `mode="vault"`              — vault secrets. Row shape is the
 *     `VaultSecret` discriminated union; the per-row "kind" picker
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
 *
 * The row model + persisted-shape codecs live in
 * `variable-table-rows.ts` (types re-exported here for callers); the
 * row component in `VariableTableRow.tsx`.
 */

import type { DragEndEvent, Modifier } from '@dnd-kit/core';
import { DndContext } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Variable, VaultSecret } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyRow,
  gridColsFor,
  type LocalRow,
  secretsFingerprint,
  secretsFromLocal,
  secretsToLocal,
  TOTP_DEFAULTS,
  type VariableRowPath,
  type VariableTableConflictBridge,
  variablesFingerprint,
  variablesFromLocal,
  variablesToLocal,
} from './variable-table-rows';
import { SortableRow } from './VariableTableRow';

export type { VariableRowPath, VariableTableConflictBridge } from './variable-table-rows';

const EMPTY_SECRETS: VaultSecret[] = [];
const EMPTY_VARS: Variable[] = [];

type VariableTableProps =
  | {
      mode?: 'variable';
      variables: Variable[];
      onChange: (next: Variable[]) => void;
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
      secrets: VaultSecret[];
      onChange: (next: VaultSecret[]) => void;
      /** Per-leaf conflict bridge for vault. Path encoding is
       *  `secrets.<uid>.<leaf>` — name + (kind-specific leaves). */
      conflictBridge?: VariableTableConflictBridge;
    };

// Pin the drag to vertical only; our row layout is a spreadsheet and
// horizontal drift adds noise without any meaningful UX gain. Inlined
// because `@dnd-kit/modifiers` isn't in the extension's dependency
// set and this one-liner is the only modifier we use.
const restrictVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const VariableTable: React.FC<VariableTableProps> = (props) => {
  const { token } = theme.useToken();
  const t = useT();

  // Hoist the mode + raw source out so every downstream useEffect /
  // useCallback closes over a single shape, sidestepping the
  // discriminated-union narrowing pitfall when reading `props.X`
  // inside callbacks that outlive the render.
  const isVaultMode = props.mode === 'vault';
  const sourceSecrets: VaultSecret[] = isVaultMode ? props.secrets : EMPTY_SECRETS;
  const sourceVariables: Variable[] = isVaultMode ? EMPTY_VARS : props.variables;
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
        (onChangeRef.current as (n: VaultSecret[]) => void)(next);
      } else {
        const next = variablesFromLocal(nextRows);
        lastExternalFp.current = variablesFingerprint(next);
        (onChangeRef.current as (n: Variable[]) => void)(next);
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
          } else if (patch.kind === 'client-certificate') {
            row = {
              ...prior,
              ...patch,
              isPlaceholder: false,
              isSensitive: true,
              cert: '',
              certKey: '',
              passphrase: undefined,
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
  const nameHeader = isVaultMode
    ? t('workbench.variables.table.headerSecret')
    : t('workbench.variables.table.headerVariable');
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
          gridTemplateColumns: gridColsFor(mode),
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <div style={{ padding: '6px 8px' }} />
        {!isVaultMode && <div style={{ padding: '6px 8px' }} />}
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
          {t('workbench.variables.table.headerValue')}
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
