/**
 * VariableHoverPopover — Postman-style popover that appears when a
 * `{{ref}}` token is hovered. Shows the resolved value as a directly
 * editable textarea + a Save button + the scope it resolves from.
 *
 * Editable scopes (vault `string`, environment, collection, workspace,
 * live override) write through the same versioned bridge RPCs the
 * dedicated editors use. Read-only scopes (vault `totp`, step, file,
 * reserved/dynamic) disable the textarea and hide Save.
 */

import { SaveOutlined } from '@ant-design/icons';
import { ShortcutHintTitle } from '@components/ShortcutKbd';
import { useEnvironments } from '@hooks/useEnvironments';
import { useRules } from '@hooks/useRules';
import { useVariableLookup, type VariableCandidate, type VariableLookupResult } from '@hooks/useVariableLookup';
import { type MutationResult, useVariableMutator } from '@hooks/useVariableMutator';
import type { V5 } from '@openheaders/core/types';
import type { VariableNamespace } from '@openheaders/core/variables';
import { App, Button, Dropdown, Input, type MenuProps, Tag, Tooltip, theme } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildChordsFromEvent, useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { useSettingValue } from '../../settings/hooks';
import { type ScopeKey, scopeBadge } from '../shared/scope-colors';

/** Always mounted by `VariablePopoverHost` only when an open session
 *  is active — the host uses `key={reference}` so each open session
 *  gets a fresh mount and resets state implicitly. There is no `open`
 *  prop because the component never renders in a "closed" state. */
export interface VariableHoverPopoverProps {
  anchorEl: HTMLElement;
  reference: string;
  collectionId?: string;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/** Map a resolver scope (`V5.VariableScope`) plus the popover-only
 *  `'reserved'` / `'none'` discriminators to the canonical `ScopeKey`.
 *  `'reserved'` represents `{{dynamic.X}}` references which use the
 *  shared 'dynamic' palette entry. `'none'` (truly unresolved) returns
 *  null and the caller renders a neutral Tag. */
function toScopeKey(scope: V5.VariableScope | 'reserved' | 'none'): ScopeKey | null {
  if (scope === 'none') return null;
  if (scope === 'reserved') return 'dynamic';
  return scope;
}

const POPOVER_WIDTH = 380;
const POPOVER_GAP = 6;

function initialPosition(anchorEl: HTMLElement): { top: number; left: number } {
  const rect = anchorEl.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - POPOVER_WIDTH - 8, rect.left));
  return { top: rect.bottom + POPOVER_GAP, left };
}

const VariableHoverPopover: React.FC<VariableHoverPopoverProps> = ({
  anchorEl,
  reference,
  collectionId,
  onClose,
  onMouseEnter,
  onMouseLeave,
}) => {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const lookup = useVariableLookup(reference, collectionId);

  // Pull the popover's own data snapshot from `useEnvironments` /
  // `useRules`. The mutator's writes use ITS OWN copies of these
  // hooks under the hood — those are independent state instances that
  // hydrate via post-mount effects, racing with our render. The
  // popover passes the FULL list it sees to the mutator's
  // `replace*` methods (which are pure write wrappers) so there's
  // exactly one source of truth for the read-modify-write.
  const { activeEnvironmentId, activeEnvironment, setActiveEnvironment, environments, workspaceVariables, vault } =
    useEnvironments();
  const { localCollections } = useRules();
  const mutator = useVariableMutator();

  // Initial draft primed once at mount from the resolver — the host
  // remounts this component for each open session (key={reference}),
  // so we don't need a re-prime effect.
  const candidate = useMemo<VariableCandidate | null>(() => {
    if (lookup.candidates.length === 0) return null;
    if (lookup.active) {
      const i = lookup.candidates.findIndex((c) => c.scope === lookup.active!.scope);
      if (i !== -1) return lookup.candidates[i];
    }
    return lookup.candidates[0];
  }, [lookup]);

  const [position, setPosition] = useState<{ top: number; left: number }>(() => initialPosition(anchorEl));
  const [draft, setDraft] = useState<string>(() => currentValue(candidate, lookup.active?.value ?? ''));
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Ref-mirror of `draft` updated synchronously in onChange, so the
  // save path (Enter hotkey OR Save click) always reads the most
  // recent text. Reading `draft` from closure is unsafe: the keydown
  // for Enter can fire before React commits the input event's
  // setDraft, and the closure would still see the pre-typing value.
  const draftRef = useRef(draft);
  // Create-flow add-to target — only meaningful when the variable is
  // unresolved. Falls back to the first available target each render.
  const [addTo, setAddTo] = useState<CreateScope | null>(null);

  // Re-prime the draft once the variable stores hydrate. The
  // `useState` initializer above runs at first mount, but the
  // resolver hooks (`useEnvironments`, `useRules`, …) populate their
  // state via post-mount effects — on first paint the candidate may
  // be null and the resolved value empty. As soon as the candidate
  // resolves, prime from it. The `!draftDirty` guard means user
  // typing is never clobbered by a hydration race or by a concurrent
  // external update.
  // biome-ignore lint/correctness/useExhaustiveDependencies: prime only when the underlying value or candidate changes.
  useEffect(() => {
    if (draftDirty) return;
    const next = currentValue(candidate, lookup.active?.value ?? '');
    draftRef.current = next;
    setDraft(next);
  }, [candidate, lookup.active?.value]);

  useEffect(() => {
    const update = () => {
      const rect = anchorEl.getBoundingClientRect();
      const left = Math.max(8, Math.min(window.innerWidth - POPOVER_WIDTH - 8, rect.left));
      const top = rect.bottom + POPOVER_GAP;
      setPosition({ top, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorEl]);

  // Save-chord + Escape listener. While the popover is mounted, the
  // user's bound save chord (default Cmd/Ctrl+S) saves whatever is in
  // the textarea regardless of focus, and Escape dismisses. We
  // `stopPropagation` + `preventDefault` so the workspace-level save
  // shortcut (which would save the underlying editor tab) doesn't
  // also fire — the popover's edit takes priority while it's open.
  const saveLabel = useShortcutLabel('save');
  const saveChord = useSettingValue('keyboard.save');
  // Ref-mirror of `handleSave` so the keydown listener (which is set
  // up once per popover mount) always calls the latest closure.
  const handleSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (typeof saveChord !== 'string' || !saveChord) return;
      const chords = buildChordsFromEvent(e);
      if (chords.includes(saveChord)) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current?.();
      }
    };
    // Capture phase so we beat the workspace-level shortcut handler —
    // while the popover is open, the chord saves the popover, not the
    // underlying editor.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, saveChord]);

  const editable = candidate ? isCandidateEditable(candidate) : false;
  const resolvedScope: V5.VariableScope | 'reserved' | 'none' = lookup.active?.scope ?? candidate?.scope ?? 'none';
  const scopeKey = toScopeKey(resolvedScope);
  const scopeLabel = candidate ? scopeLabelFor(candidate) : 'Unresolved';

  // Resolved-from-default badge: active env doesn't define this name,
  // but the default env does. The resolver fell through.
  const resolvedFromDefault =
    lookup.namespace !== 'env' &&
    candidate?.scope === 'environment' &&
    !candidate.isActive &&
    candidate.isDefault &&
    !!lookup.active;
  const noActiveEnv = lookup.activeEnvName === null && resolvedFromDefault;

  // Create-flow: only when the ref is unresolved AND the namespace
  // (if any) maps to a creatable scope.
  const isUnresolved = !lookup.active && !lookup.parseError;
  const createOptions = isUnresolved ? buildCreateOptions(lookup, !!activeEnvironmentId, !!collectionId) : [];
  const effectiveAddTo: CreateScope | null =
    addTo && createOptions.some((o) => o.key === addTo && !o.disabled)
      ? addTo
      : (createOptions.find((o) => !o.disabled)?.key ?? null);

  // Envs that DEFINE this name but aren't the active resolution target
  // (e.g. user is in dev env, but staging defines it). Click → switch.
  const envSuggestions = isUnresolved
    ? lookup.candidates.filter(
        (c): c is Extract<VariableCandidate, { scope: 'environment' }> => c.scope === 'environment',
      )
    : [];

  const handleSave = async () => {
    // Read the latest text from the ref, NOT the closure's `draft`.
    // The Enter hotkey's keydown handler can run before React commits
    // the keystroke event's setDraft, so the closure is one keystroke
    // behind. The ref is mutated synchronously in onChange.
    const liveDraft = draftRef.current;
    setSaving(true);
    try {
      let result: MutationResult;
      if (isUnresolved) {
        if (!effectiveAddTo) {
          result = { ok: false, reason: 'other', message: 'Pick a scope from "Add to"' };
        } else {
          result = await runCreate(mutator, effectiveAddTo, lookup.name, liveDraft, {
            activeEnvironment,
            workspaceVariables,
            vault,
            localCollections,
            collectionId,
          });
        }
      } else if (candidate) {
        result = await runUpdate(mutator, candidate, liveDraft, {
          environments,
          workspaceVariables,
          vault,
          localCollections,
        });
      } else {
        result = { ok: false, reason: 'not-found' };
      }
      surfaceResult(result, message, () => {
        setDraftDirty(false);
        onClose();
      });
    } finally {
      setSaving(false);
    }
  };

  const canSave = isUnresolved ? draftDirty && !!effectiveAddTo && !saving : editable && draftDirty && !saving;

  // Mirror handleSave into the ref each render so the keydown listener
  // sees the latest closure (current draft, candidate, isUnresolved, …).
  // Gated on `canSave` so the chord no-ops when there's nothing to save.
  handleSaveRef.current = canSave ? () => void handleSave() : null;

  return (
    <div
      role="dialog"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        zIndex: 1080,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 4,
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            border: `1px solid ${token.colorPrimaryBorder}`,
            fontFamily: token.fontFamilyCode,
            fontSize: 12,
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {`{{${lookup.reference}}}`}
        </span>
      </div>

      <Input.TextArea
        value={draft}
        onChange={(e) => {
          draftRef.current = e.target.value;
          setDraft(e.target.value);
          setDraftDirty(true);
        }}
        autoSize={{ minRows: 3, maxRows: 8 }}
        disabled={!isUnresolved && !editable}
        placeholder={isUnresolved ? 'Enter value' : ''}
        style={{ fontFamily: token.fontFamilyCode, fontSize: 12 }}
      />

      {isUnresolved && envSuggestions.length > 0 && (
        <div
          style={{
            marginTop: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            fontSize: 11,
            color: token.colorTextSecondary,
          }}
        >
          <span>Defined in:</span>
          {envSuggestions.map((c) => (
            <button
              key={c.envUid}
              type="button"
              onClick={async () => {
                await setActiveEnvironment(c.envUid);
                message.info(`Switched to "${c.envName}"`);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: token.colorLink,
                fontSize: 11,
              }}
            >
              {scopeBadge('environment', 14)}
              {c.envName} →
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 10,
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          {isUnresolved ? (
            createOptions.length > 0 ? (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: createOptions.map<NonNullable<MenuProps['items']>[number]>((opt) => ({
                    key: opt.key,
                    disabled: opt.disabled,
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {scopeBadge(opt.colorKey, 14)}
                        {opt.label}
                        {opt.hint && (
                          <span style={{ color: token.colorTextSecondary, fontSize: 11 }}>· {opt.hint}</span>
                        )}
                      </span>
                    ),
                    onClick: () => setAddTo(opt.key),
                  })),
                }}
              >
                <Button size="small" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {effectiveAddTo && scopeBadge(createScopeToColorKey(effectiveAddTo), 14)}
                  Add to: {effectiveAddTo ? labelForCreateScope(effectiveAddTo) : 'pick scope'} ▾
                </Button>
              </Dropdown>
            ) : (
              <Tag color="default" style={{ marginInlineEnd: 0 }}>
                {describeUnresolved(lookup, candidate)}
              </Tag>
            )
          ) : (
            <>
              {scopeKey ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                  {scopeBadge(scopeKey, 14)}
                  {scopeLabel}
                </span>
              ) : (
                <Tag color="default" style={{ marginInlineEnd: 0 }}>
                  {scopeLabel}
                </Tag>
              )}
              {resolvedFromDefault && (
                <Tag color="default" style={{ marginInlineEnd: 0 }}>
                  {noActiveEnv ? 'Resolved: default (no active env)' : 'Resolved: default'}
                </Tag>
              )}
            </>
          )}
        </div>
        {(isUnresolved ? createOptions.length > 0 : editable) && (
          <Tooltip
            title={<ShortcutHintTitle label={saveLabel}>Save</ShortcutHintTitle>}
            placement="bottomRight"
            // The popover is `position: fixed; zIndex: 1080`. Antd's
            // default Tooltip zIndex is 1070, so the tooltip renders
            // BEHIND the popover and stays invisible. Bump above the
            // popover so it floats correctly.
            zIndex={1090}
          >
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={!canSave}
              onClick={handleSave}
              style={{
                fontSize: 11,
                ...(canSave ? { background: '#f5722d', borderColor: '#f5722d' } : {}),
              }}
            >
              Save
            </Button>
          </Tooltip>
        )}
      </div>

      {isUnresolved && !activeEnvironmentId && createOptions.some((o) => o.key === 'environment') && (
        <div style={{ marginTop: 8, fontSize: 11, color: token.colorTextSecondary }}>
          No environment selected — pick one in the env switcher to add an environment variable.
        </div>
      )}
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────

function isCandidateEditable(c: VariableCandidate): boolean {
  switch (c.scope) {
    case 'vault':
      return c.kind === 'string';
    case 'environment':
    case 'collection':
    case 'workspace':
    case 'live':
      return true;
    case 'step':
    case 'file':
    case 'reserved':
      return false;
  }
}

function currentValue(c: VariableCandidate | null, fallback: string): string {
  if (!c) return fallback;
  switch (c.scope) {
    case 'vault':
      return c.secret.kind === 'string' ? c.secret.value : '';
    case 'environment':
    case 'collection':
    case 'workspace':
      return c.variable.value;
    case 'live':
      return c.override?.value ?? c.cached?.value ?? fallback;
    default:
      return fallback;
  }
}

function scopeLabelFor(c: VariableCandidate): string {
  switch (c.scope) {
    case 'vault':
      return c.kind === 'totp' ? 'Vault · TOTP' : 'Vault';
    case 'environment':
      return `Environment · ${c.envName}`;
    case 'collection':
      return `Collection · ${c.collectionName}`;
    case 'workspace':
      return 'Workspace';
    case 'live':
      return c.override ? 'Live · override' : 'Live';
    case 'step':
      return `Step · ${c.stepId}.${c.captureName}`;
    case 'file':
      return `File · ${c.name}`;
    case 'reserved':
      return c.namespace === 'dynamic' ? 'Dynamic (coming soon)' : 'Reserved';
  }
}

function describeUnresolved(lookup: ReturnType<typeof useVariableLookup>, candidate: VariableCandidate | null): string {
  if (lookup.parseError === 'empty') return 'Empty reference';
  if (lookup.parseError === 'unknown-namespace') return 'Unknown namespace';
  if (candidate?.scope === 'reserved' && candidate.namespace === 'dynamic') {
    return 'Dynamic variables ($timestamp, $guid, …) are coming soon.';
  }
  if (candidate?.scope === 'step') {
    return 'Only resolves while a Live Workflow chain is running.';
  }
  if (lookup.namespace === 'env') {
    return lookup.activeEnvName
      ? `Not set in environment "${lookup.activeEnvName}".`
      : 'No active environment is selected.';
  }
  if (lookup.namespace === 'live') {
    return 'No Live Variable by that name (or no cached value yet).';
  }
  return 'Not defined in any scope.';
}

// ── Save dispatch ────────────────────────────────────────────────────
//
// `runUpdate` / `runCreate` splice the new value into the popover's
// own data snapshot (sourced from `useEnvironments` / `useRules` in the
// popover render) and call the mutator's pure `replace*` write methods.
//
// The popover and the mutator each call `useEnvironments` separately
// — independent React state instances that hydrate via independent
// post-mount effects. If we let the mutator do the read-modify-write
// internally, it would race against the popover's view: the popover
// might already see the variable while the mutator's view is still
// the initial empty default, and the splice would write a list that
// drops every other variable. Centralizing the read in the popover
// (whose render we already gate on hydration) closes the race.

interface UpdateSnapshot {
  environments: V5.Environment[];
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
  localCollections: V5.Collection[];
}

interface CreateSnapshot {
  activeEnvironment: V5.Environment | null;
  workspaceVariables: V5.WorkspaceVariables;
  vault: V5.Vault;
  localCollections: V5.Collection[];
  collectionId?: string;
}

async function runUpdate(
  mutator: ReturnType<typeof useVariableMutator>,
  c: VariableCandidate,
  draft: string,
  snap: UpdateSnapshot,
): Promise<MutationResult> {
  switch (c.scope) {
    case 'vault': {
      if (c.secret.kind !== 'string') {
        return { ok: false, reason: 'other', message: 'TOTP secrets must be edited in the Vault editor' };
      }
      const idx = snap.vault.secrets.findIndex((s) => s.name === c.secret.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = snap.vault.secrets.slice();
      const target = next[idx];
      if (target.kind !== 'string') {
        return { ok: false, reason: 'other', message: 'Vault entry kind changed under us' };
      }
      next[idx] = { ...target, value: draft };
      return mutator.replaceVault(next, snap.vault.version);
    }
    case 'environment': {
      const env = snap.environments.find((e) => e.uid === c.envUid);
      if (!env) return { ok: false, reason: 'not-found' };
      const idx = env.variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = env.variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceEnvironmentVariables(env.uid, next, env.version);
    }
    case 'collection': {
      const collection = snap.localCollections.find((cc) => cc.uid === c.collectionUid);
      if (!collection) return { ok: false, reason: 'not-found' };
      const variables = collection.variables ?? [];
      const idx = variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceCollectionVariables(collection.uid, next, collection.version);
    }
    case 'workspace': {
      const idx = snap.workspaceVariables.variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = snap.workspaceVariables.variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceWorkspaceVariables(next, snap.workspaceVariables.version);
    }
    case 'live':
      return mutator.setLiveOverride(c.lv.uid, { value: draft }, c.lv.version);
    case 'step':
    case 'file':
    case 'reserved':
      return { ok: false, reason: 'other', message: 'Not editable' };
  }
}

async function runCreate(
  mutator: ReturnType<typeof useVariableMutator>,
  scope: CreateScope,
  name: string,
  value: string,
  snap: CreateSnapshot,
): Promise<MutationResult> {
  switch (scope) {
    case 'workspace': {
      if (snap.workspaceVariables.variables.some((v) => v.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: V5.Variable[] = [...snap.workspaceVariables.variables, { name, value, type: 'default' }];
      return mutator.replaceWorkspaceVariables(next, snap.workspaceVariables.version);
    }
    case 'vault': {
      if (snap.vault.secrets.some((s) => s.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: V5.VaultSecret[] = [...snap.vault.secrets, { kind: 'string', name, value }];
      return mutator.replaceVault(next, snap.vault.version);
    }
    case 'environment': {
      const env = snap.activeEnvironment;
      if (!env) return { ok: false, reason: 'other', message: 'No active environment' };
      if (env.variables.some((v) => v.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: V5.Variable[] = [...env.variables, { name, value, type: 'default' }];
      return mutator.replaceEnvironmentVariables(env.uid, next, env.version);
    }
    case 'collection': {
      if (!snap.collectionId) return { ok: false, reason: 'other', message: 'No collection in context' };
      const collection = snap.localCollections.find((c) => c.uid === snap.collectionId);
      if (!collection) return { ok: false, reason: 'not-found' };
      const variables = collection.variables ?? [];
      if (variables.some((v) => v.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: V5.Variable[] = [...variables, { name, value, type: 'default' }];
      return mutator.replaceCollectionVariables(collection.uid, next, collection.version);
    }
  }
}

/** Map a {@link MutationResult} to AntD message + onSuccess callback.
 *  Centralized so all writes surface uniformly. */
function surfaceResult(
  result: MutationResult,
  message: ReturnType<typeof App.useApp>['message'],
  onSuccess: () => void,
): void {
  if (result.ok) {
    message.success('Saved');
    onSuccess();
    return;
  }
  switch (result.reason) {
    case 'stale-draft':
      message.warning('Variable changed elsewhere — close and reopen the popover.');
      return;
    case 'duplicate-name':
      message.error('A variable with that name already exists in this scope.');
      return;
    case 'not-found':
      message.error('Variable not found — it may have been deleted.');
      return;
    case 'other':
      message.error(result.message ?? 'Save failed');
      return;
  }
}

// ── Create flow ──────────────────────────────────────────────────────

type CreateScope = 'environment' | 'collection' | 'workspace' | 'vault';

interface CreateOption {
  key: CreateScope;
  label: string;
  colorKey: ScopeKey;
  disabled?: boolean;
  hint?: string;
}

function labelForCreateScope(s: CreateScope): string {
  switch (s) {
    case 'environment':
      return 'Environment';
    case 'collection':
      return 'Collection';
    case 'workspace':
      return 'Globals';
    case 'vault':
      return 'Vault';
  }
}

function createScopeToColorKey(s: CreateScope): ScopeKey {
  return s;
}

function buildCreateOptions(
  lookup: VariableLookupResult,
  hasActiveEnv: boolean,
  hasCollection: boolean,
): CreateOption[] {
  const restrict = (ns: VariableNamespace, key: CreateScope): CreateScope[] | null =>
    lookup.namespace === ns ? [key] : null;
  const allowed: CreateScope[] | null =
    restrict('env', 'environment') ??
    restrict('vault', 'vault') ??
    restrict('collection', 'collection') ??
    restrict('workspace', 'workspace') ??
    null;
  if (
    lookup.namespace === 'live' ||
    lookup.namespace === 'step' ||
    lookup.namespace === 'file' ||
    lookup.namespace === 'dynamic'
  ) {
    return [];
  }
  const all: CreateScope[] = allowed ?? ['environment', 'collection', 'workspace', 'vault'];
  return all
    .map<CreateOption | null>((k) => {
      switch (k) {
        case 'environment':
          return {
            key: 'environment',
            label: 'Environment',
            colorKey: 'environment',
            disabled: !hasActiveEnv,
            hint: hasActiveEnv ? undefined : 'no active env',
          };
        case 'collection':
          return hasCollection ? { key: 'collection', label: 'Collection', colorKey: 'collection' } : null;
        case 'workspace':
          return { key: 'workspace', label: 'Globals', colorKey: 'workspace' };
        case 'vault':
          return { key: 'vault', label: 'Vault', colorKey: 'vault' };
        default:
          return null;
      }
    })
    .filter((o): o is CreateOption => o !== null);
}

export default VariableHoverPopover;
