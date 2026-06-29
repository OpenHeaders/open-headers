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
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useEnvVarVault } from '@openheaders/ui/shared/hooks/useEnvVarVault';
import { useRules } from '@openheaders/ui/shared/hooks/useRules';
import { useVariableLookup, type VariableCandidate, type VariableLookupResult } from '@openheaders/ui/shared/hooks/useVariableLookup';
import { type MutationResult, useVariableMutator } from '@openheaders/ui/shared/hooks/useVariableMutator';
import type { Collection, Environment, Variable, VariableScope, Vault, VaultSecret, WorkspaceVariables } from '@openheaders/core/types';
import { generateUid } from '@openheaders/core/utils';
import { App, Button, Dropdown, Input, type MenuProps, Tag, Tooltip, theme } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePopoverPlacement } from '@openheaders/ui/shared/popover';
import { buildChordsFromEvent, useShortcutLabel } from '../../hooks/useWorkspaceShortcuts';
import { useEnvSwitcher } from '../../services/env-switcher';
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
  onMouseLeave?: (e: React.MouseEvent) => void;
  /** Host-controlled visibility for the open/close transition.
   *  Defaults to true so the popover can be used standalone. */
  visible?: boolean;
  /** Focus the value input on mount. Set for deliberate (keyboard /
   *  click) opens like the create flow so the user can type + save
   *  immediately; omit for hover opens, which must not steal focus from
   *  the field being typed in. */
  autoFocus?: boolean;
}

/** Map a resolver scope (`VariableScope`) plus the popover-only
 *  `'reserved'` / `'none'` discriminators to the canonical `ScopeKey`.
 *  `'reserved'` represents `{{dynamic.X}}` references which use the
 *  shared 'dynamic' palette entry. `'none'` (truly unresolved) returns
 *  null and the caller renders a neutral Tag. */
function toScopeKey(scope: VariableScope | 'reserved' | 'none'): ScopeKey | null {
  if (scope === 'none') return null;
  if (scope === 'reserved') return 'dynamic';
  return scope;
}

const POPOVER_WIDTH = 380;

const VariableHoverPopover: React.FC<VariableHoverPopoverProps> = ({
  anchorEl,
  reference,
  collectionId,
  onClose,
  onMouseEnter,
  onMouseLeave,
  visible = true,
  autoFocus = false,
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
  const { activeEnvironmentId, activeEnvironment, environments, workspaceVariables, vault } = useEnvVarVault();
  const { pickActiveEnvironment } = useEnvSwitcher();
  const { localCollections } = useRules();
  const mutator = useVariableMutator();

  // Pick the candidate that matches what the resolver ACTUALLY
  // resolved. For env scope this matters when multiple envs define
  // the same name — the resolver checks active env first, then falls
  // back to default env. Picking by `isActive` / `isDefault` avoids
  // labelling a hit from "New Environment (4)" as "New Environment"
  // just because that one happens to be first in the list.
  const candidate = useMemo<VariableCandidate | null>(() => {
    if (lookup.candidates.length === 0) return null;
    if (lookup.active) {
      const sameScope = lookup.candidates.filter((c) => c.scope === lookup.active!.scope);
      if (sameScope.length > 0) {
        if (lookup.active.scope === 'environment') {
          const envHits = sameScope as Extract<VariableCandidate, { scope: 'environment' }>[];
          return envHits.find((c) => c.isActive) ?? envHits.find((c) => c.isDefault) ?? envHits[0];
        }
        return sameScope[0];
      }
    }
    return lookup.candidates[0];
  }, [lookup]);

  const { position, popoverRef, measured } = usePopoverPlacement(anchorEl, POPOVER_WIDTH);
  const [draft, setDraft] = useState<string>(() => currentValue(candidate, lookup.active?.value ?? ''));
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Focus the value input on a deliberate (create-flow) open so the user
  // can type + Cmd/Ctrl+S without a click. The root is `visibility:
  // hidden` until `measured` (hidden elements reject focus); we defer one
  // more frame so the reveal paint lands, then focus the rendered textarea
  // (the host shows a single popover). Hover opens omit `autoFocus`.
  useEffect(() => {
    if (!autoFocus || !measured) return;
    const raf = requestAnimationFrame(() => {
      document.querySelector<HTMLTextAreaElement>('[data-variable-popover-root] textarea')?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [autoFocus, measured]);
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

  // Save-chord listener. While the popover is mounted, the user's
  // bound save chord (default Cmd/Ctrl+S) saves whatever is in the
  // textarea regardless of focus. Capture phase + `stopPropagation`
  // so the workspace-level save shortcut (which would save the
  // underlying editor tab) doesn't also fire — popover edits take
  // priority while open. Escape dismissal is handled by the host's
  // `useDismiss`; we don't duplicate it here.
  const saveLabel = useShortcutLabel('save');
  const saveChord = useSettingValue('keyboard.save');
  // Ref-mirror of `handleSave` so the keydown listener (which is set
  // up once per popover mount) always calls the latest closure.
  const handleSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (typeof saveChord !== 'string' || !saveChord) return;
    const onKey = (e: KeyboardEvent) => {
      const chords = buildChordsFromEvent(e);
      if (chords.includes(saveChord)) {
        e.preventDefault();
        e.stopPropagation();
        handleSaveRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [saveChord]);

  const editable = candidate ? isCandidateEditable(candidate) : false;
  const resolvedScope: VariableScope | 'reserved' | 'none' = lookup.active?.scope ?? candidate?.scope ?? 'none';
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
  // The create flow (picker / committed scope / hint) is derived as one
  // view-model so the three can't drift. A namespaced reference locks the
  // scope to its prefix; a bare reference is a free choice.
  const namespaceScope: CreateScope | null =
    lookup.namespace && lookup.namespace in NAMESPACE_CREATE_SCOPE
      ? NAMESPACE_CREATE_SCOPE[lookup.namespace as keyof typeof NAMESPACE_CREATE_SCOPE]
      : null;
  const createFlow = resolveCreateFlow(namespaceScope, addTo, createOptions);
  const effectiveAddTo = createFlow.scope;

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
      ref={popoverRef as React.RefCallback<HTMLDivElement>}
      role="dialog"
      data-variable-popover-root=""
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
        // Visibility = AND of:
        //   `measured` — placement hook has seen layout settle across
        //     two frames (open transition guard, prevents flicker).
        //   `visible` — host hasn't started the close animation
        //     (close transition guard, mirrors the open transition).
        // Either being false fades opacity / transform to 0; both
        // true reveals at full opacity. The CSS transition handles
        // the animation in both directions.
        visibility: measured ? 'visible' : 'hidden',
        opacity: measured && visible ? 1 : 0,
        transform: measured && visible ? 'scale(1)' : 'scale(0.96)',
        transformOrigin: `${position.side === 'above' ? 'bottom' : 'top'} left`,
        transition: 'opacity 120ms ease-out, transform 120ms ease-out',
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
        // Focus is driven by the `measured`-gated effect above (not the
        // native `autoFocus`, which would fire while the root is still
        // `visibility: hidden`).
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
          <span>Found in:</span>
          {envSuggestions.map((c) => (
            <button
              key={c.envUid}
              type="button"
              // Close after switching: the user has committed an
              // action, and the popover's anchor (the resolved-value
              // span) is about to be destroyed by the re-resolution
              // re-rendering its host TemplateInput's innerHTML —
              // keeping the popover open would leave it orphaned at a
              // stale position. Re-hover after the switch gets a fresh
              // popover anchored to the new span with the new value.
              onClick={() => {
                pickActiveEnvironment(c.envUid);
                onClose();
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
            createFlow.fixedScope ? (
              <Tooltip
                title={`Scope is fixed by the {{${lookup.namespace}.}} prefix — edit the reference to change it.`}
                zIndex={1090}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  {scopeBadge(createScopeToColorKey(createFlow.fixedScope), 14)}
                  Add to: {labelForCreateScope(createFlow.fixedScope)}
                </span>
              </Tooltip>
            ) : createFlow.picker === 'dropdown' ? (
              <Dropdown
                trigger={['click']}
                // Same stacking concern as the Save tooltip — the
                // popover sits at zIndex 1080, so default Dropdown
                // overlay (1050) renders behind it. Bump above.
                overlayStyle={{ zIndex: 1090 }}
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
        {(isUnresolved ? createFlow.picker !== 'none' : editable) && (
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

      {createFlow.unavailable === 'no-active-env' && (
        <div style={{ marginTop: 8, fontSize: 11, color: token.colorTextSecondary }}>
          No environment selected — pick one in the env switcher to add an environment variable.
        </div>
      )}
      {createFlow.unavailable === 'no-collection' && (
        <div style={{ marginTop: 8, fontSize: 11, color: token.colorTextSecondary }}>
          No active collection — open a collection to add a collection variable.
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
  environments: Environment[];
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
  localCollections: Collection[];
}

interface CreateSnapshot {
  activeEnvironment: Environment | null;
  workspaceVariables: WorkspaceVariables;
  vault: Vault;
  localCollections: Collection[];
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
      return mutator.replaceVault(next);
    }
    case 'environment': {
      const env = snap.environments.find((e) => e.uid === c.envUid);
      if (!env) return { ok: false, reason: 'not-found' };
      const idx = env.variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = env.variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceEnvironmentVariables(env.uid, next);
    }
    case 'collection': {
      const collection = snap.localCollections.find((cc) => cc.uid === c.collectionUid);
      if (!collection) return { ok: false, reason: 'not-found' };
      const variables = collection.variables ?? [];
      const idx = variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceCollectionVariables(collection.uid, next);
    }
    case 'workspace': {
      const idx = snap.workspaceVariables.variables.findIndex((v) => v.name === c.variable.name);
      if (idx === -1) return { ok: false, reason: 'not-found' };
      const next = snap.workspaceVariables.variables.slice();
      next[idx] = { ...next[idx], value: draft };
      return mutator.replaceWorkspaceVariables(next);
    }
    case 'live':
      return mutator.setLiveOverride(c.lv.uid, { value: draft });
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
      const next: Variable[] = [
        ...snap.workspaceVariables.variables,
        { uid: generateUid(), name, value, type: 'default' },
      ];
      return mutator.replaceWorkspaceVariables(next);
    }
    case 'vault': {
      if (snap.vault.secrets.some((s) => s.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: VaultSecret[] = [
        ...snap.vault.secrets,
        { uid: generateUid(), kind: 'string', name, value },
      ];
      return mutator.replaceVault(next);
    }
    case 'environment': {
      const env = snap.activeEnvironment;
      if (!env) return { ok: false, reason: 'other', message: 'No active environment' };
      if (env.variables.some((v) => v.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: Variable[] = [
        ...env.variables,
        { uid: generateUid(), name, value, type: 'default' },
      ];
      return mutator.replaceEnvironmentVariables(env.uid, next);
    }
    case 'collection': {
      if (!snap.collectionId) return { ok: false, reason: 'other', message: 'No collection in context' };
      const collection = snap.localCollections.find((c) => c.uid === snap.collectionId);
      if (!collection) return { ok: false, reason: 'not-found' };
      const variables = collection.variables ?? [];
      if (variables.some((v) => v.name === name)) {
        return { ok: false, reason: 'duplicate-name' };
      }
      const next: Variable[] = [
        ...variables,
        { uid: generateUid(), name, value, type: 'default' },
      ];
      return mutator.replaceCollectionVariables(collection.uid, next);
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

/** Reference namespace → its create scope. Only the user-creatable
 *  namespaces map; reserved/runtime ones (live, step, file, dynamic)
 *  are absent, so a default falls through to Workspace. */
const NAMESPACE_CREATE_SCOPE = {
  env: 'environment',
  vault: 'vault',
  collection: 'collection',
  workspace: 'workspace',
} as const;

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
      return 'Workspace';
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
  // Reserved / runtime-only namespaces aren't creatable from the
  // popover — they need their dedicated editors (Live Variables, file
  // upload, workflow steps).
  if (
    lookup.namespace === 'live' ||
    lookup.namespace === 'step' ||
    lookup.namespace === 'file' ||
    lookup.namespace === 'dynamic'
  ) {
    return [];
  }
  // Show every creatable destination regardless of the reference's
  // explicit namespace — matches Postman. The user picks where the
  // variable should live; the namespace dictates where the resolver
  // looks but doesn't constrain where storage happens.
  const all: CreateScope[] = ['environment', 'collection', 'workspace', 'vault'];
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
          return { key: 'workspace', label: 'Workspace', colorKey: 'workspace' };
        case 'vault':
          return { key: 'vault', label: 'Vault', colorKey: 'vault' };
        default:
          return null;
      }
    })
    .filter((o): o is CreateOption => o !== null);
}

/** How "Add to" is presented: a fixed label (a namespaced ref locks the
 *  scope), a switchable dropdown (a bare ref), or none (a reserved
 *  namespace — nothing creatable). */
type CreatePicker = 'fixed' | 'dropdown' | 'none';

interface CreateFlow {
  picker: CreatePicker;
  /** Scope the Save commits to, or null when nothing is creatable here
   *  (Save stays disabled). */
  scope: CreateScope | null;
  /** Scope to label when `picker === 'fixed'`, even if it isn't creatable
   *  in this context. */
  fixedScope: CreateScope | null;
  /** Why a locked / offered scope isn't creatable here, for the hint. */
  unavailable: 'no-active-env' | 'no-collection' | null;
}

/** Single source of truth for the create flow — which "Add to" control to
 *  show, the scope it commits to, and any unavailability hint, all derived
 *  together so they can't drift. A namespaced reference (`{{vault.x}}`)
 *  LOCKS the scope to its prefix so the user can't create a variable the
 *  reference will never resolve; a bare reference is a free choice. */
function resolveCreateFlow(
  namespaceScope: CreateScope | null,
  addTo: CreateScope | null,
  createOptions: CreateOption[],
): CreateFlow {
  const enabled = (key: CreateScope) => createOptions.some((o) => o.key === key && !o.disabled);

  if (namespaceScope) {
    const available = enabled(namespaceScope);
    const unavailable = available
      ? null
      : namespaceScope === 'environment'
        ? 'no-active-env'
        : namespaceScope === 'collection'
          ? 'no-collection'
          : null;
    return { picker: 'fixed', scope: available ? namespaceScope : null, fixedScope: namespaceScope, unavailable };
  }

  if (createOptions.length === 0) {
    return { picker: 'none', scope: null, fixedScope: null, unavailable: null };
  }

  // Bare ref → free choice. Default to Workspace (the broadest), else the
  // first enabled option. Surface the env hint when Environment is offered
  // but disabled (no active env).
  const scope =
    addTo && enabled(addTo)
      ? addTo
      : (createOptions.find((o) => o.key === 'workspace' && !o.disabled)?.key ??
        createOptions.find((o) => !o.disabled)?.key ??
        null);
  const unavailable = createOptions.some((o) => o.key === 'environment' && o.disabled) ? 'no-active-env' : null;
  return { picker: 'dropdown', scope, fixedScope: null, unavailable };
}

export default VariableHoverPopover;
