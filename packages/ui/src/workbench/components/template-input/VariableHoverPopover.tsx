/**
 * VariableHoverPopover — popover that appears when a `{{ref}}` token
 * is hovered. Shows the resolved value as a directly editable textarea
 * + a Save button + the scope it resolves from.
 *
 * Editable scopes (vault `string`, environment, collection, workspace,
 * live override) write through the same versioned bridge RPCs the
 * dedicated editors use. Read-only scopes (vault `totp`, step, file,
 * dynamic) disable the textarea and hide Save.
 *
 * The save dispatch (`runUpdate` / `runCreate` / `surfaceResult`) lives
 * in `variable-popover-save.ts`; the "Add to" create flow in
 * `variable-popover-create-flow.ts`.
 */

import { SaveOutlined } from '@ant-design/icons';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useEnvVarVault } from '@openheaders/ui/shared/hooks/readers/useEnvVarVault';
import { useRules } from '@openheaders/ui/shared/hooks/readers/useRules';
import { useVariableLookup, type VariableCandidate } from '@openheaders/ui/shared/hooks/useVariableLookup';
import { type MutationResult, useVariableMutator } from '@openheaders/ui/shared/hooks/mutators/useVariableMutator';
import type { VariableScope } from '@openheaders/core/types';
import { App, Button, Dropdown, type GetRef, Input, type MenuProps, Tag, Tooltip, theme } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePopoverPlacement } from '@openheaders/ui/shared/popover';
import { useSaveShortcut } from '@openheaders/ui/shared/hooks/useSaveShortcut';
import { useEnvSwitcher } from '../../services/env-switcher';
import { type ScopeKey, scopeBadge } from '../shared/scope-colors';
import {
  buildCreateOptions,
  type CreateScope,
  createScopeToColorKey,
  labelForCreateScope,
  NAMESPACE_CREATE_SCOPE,
  resolveCreateFlow,
} from './variable-popover-create-flow';
import { runCreate, runUpdate, surfaceResult } from './variable-popover-save';

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
 *  `'none'` discriminator to the canonical `ScopeKey`. `'none'` (truly
 *  unresolved) returns null and the caller renders a neutral Tag. */
function toScopeKey(scope: VariableScope | 'none'): ScopeKey | null {
  if (scope === 'none') return null;
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
  const valueRef = useRef<GetRef<typeof Input.TextArea>>(null);
  const [draft, setDraft] = useState<string>(() => currentValue(candidate, lookup.active?.value ?? ''));
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Focus the value input on a deliberate (create-flow) open so the user
  // can type + Cmd/Ctrl+S without a click. Hover opens omit `autoFocus`.
  //
  // Gated on `measured`: this runs as a passive effect after the commit
  // that reveals the popover, so the textarea is mounted and focusable.
  // The root's pre-measure hide is `opacity`-based (not `visibility`),
  // which the textarea would otherwise inherit and that silently rejects
  // focus — see the root style below.
  useEffect(() => {
    if (!autoFocus || !measured) return;
    valueRef.current?.focus();
  }, [autoFocus, measured]);
  // Returning focus + caret + suggestions to the launching field on close
  // is owned by `TemplateInput` (the opener) via the host's `onClose` — it
  // alone knows the caret semantics and how to reopen its suggestion list.
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
  // textarea regardless of focus. The shared claim stack makes this
  // popover — the most recently mounted layer — the chord's sole
  // owner, so the surface beneath (workspace editor tab or a rule
  // quick-editor popover) never saves on the same keystroke. Escape
  // dismissal is handled by the host's `useDismiss`; we don't
  // duplicate it here.
  const { saveLabel, handleSaveRef } = useSaveShortcut();

  const editable = candidate ? isCandidateEditable(candidate) : false;
  const resolvedScope: VariableScope | 'none' = lookup.active?.scope ?? candidate?.scope ?? 'none';
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
        // Reveal = AND of:
        //   `measured` — placement hook has seen layout settle across
        //     two frames (open transition guard, prevents flicker at the
        //     estimated position).
        //   `visible` — host hasn't started the close animation
        //     (close transition guard, mirrors the open transition).
        // Either being false fades opacity / transform to 0; both true
        // reveals at full opacity. The CSS transition animates both ways.
        //
        // The hide is `opacity`-based, NOT `visibility` — the value
        // textarea inherits the root's `visibility`, and a `visibility:
        // hidden` ancestor silently rejects `focus()`, breaking the
        // create-flow auto-focus. `opacity: 0` hides it just as
        // completely for the pre-measure frames without blocking focus;
        // `pointer-events: none` keeps the not-yet-revealed popover from
        // catching stray clicks.
        opacity: measured && visible ? 1 : 0,
        pointerEvents: measured ? undefined : 'none',
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
        // native `autoFocus`, which would fire on mount before the popover
        // is positioned and revealed).
        ref={valueRef}
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
    case 'dynamic':
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
    case 'dynamic':
      return 'Dynamic';
  }
}

function describeUnresolved(lookup: ReturnType<typeof useVariableLookup>, candidate: VariableCandidate | null): string {
  if (lookup.parseError === 'empty') return 'Empty reference';
  if (lookup.parseError === 'unknown-namespace') return 'Unknown namespace';
  if (lookup.namespace === 'dynamic') {
    return 'No built-in generator by that name. Pick one from the {{dynamic.…}} suggestion list.';
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

export default VariableHoverPopover;
