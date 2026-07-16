/**
 * QuickEditorShell — the shared chrome of the in-panel rule quick-editor
 * popover. One shell, per-type plug-in bodies.
 *
 * The shell owns everything that is identical across rule types:
 *   - popover placement (portal into the inspector root, footer-tracked
 *     max-height, anchor-once static positioning) and the container's
 *     open/close animation styles
 *   - the title row: rule icon, name, presence badge, caller-supplied
 *     status tags, and (edit mode) the instant enabled toggle
 *   - surface-awareness wiring (`ActiveTabEntity` while visible,
 *     `ActiveEditorDirty` from the caller's derived dirty flag)
 *   - the footer: "Open in workspace →" link and the Save button with
 *     its shortcut tooltip
 *
 * Everything type-specific — snapshot block, editor fields, validation,
 * save payload — is supplied by the caller as slots/props. The header
 * mod editor (`RuleHoverPopover`) is the first plug-in body.
 */

import { CloseCircleFilled, SaveOutlined } from '@ant-design/icons';
import { RULE_ENTITY_TYPE } from '@openheaders/core/sync';
import type { Rule } from '@openheaders/core/types';
import { ShortcutHintTitle } from '@openheaders/ui/components/ShortcutKbd';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  PresenceBadge,
  useEditorDirty,
  useLocalInstanceId,
  useSetActiveTabEntity,
} from '@openheaders/ui/shared/awareness';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { usePopoverPlacement } from '@openheaders/ui/shared/popover';
import { noteFeatureUsed } from '@openheaders/ui/shared/product-telemetry';
import { buildRuleIcon } from '@openheaders/ui/workbench/components/shared/rule-icon';
import { App, Button, Switch, Tooltip, theme } from 'antd';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export const QUICK_EDITOR_WIDTH = 480;

export interface QuickEditorSave {
  saving: boolean;
  canSave: boolean;
  saveLabel: string;
  onSave: () => void;
}

export interface QuickEditorShellProps {
  anchorEl: HTMLElement;
  /** Live rule — drives the icon's enabled state and the footer link. */
  liveRule: Rule | null;
  ruleType: Rule['type'];
  ruleName: string;
  /** Create-mode rename — when supplied, the title becomes click-to-edit
   *  so the user can fix the pre-filled name before Save mints the rule.
   *  Edit mode omits it (renames belong to the workbench). */
  onRuleNameChange?: (name: string) => void;
  /** Awareness identity. Null disables presence/dirty publishing. */
  liveRuleUid: string | null;
  /** Caller-derived dirty flag, published as `ActiveEditorDirty`. */
  isDirty: boolean;
  /** Status tags rendered between the presence badge and the type tag. */
  tags?: ReactNode;
  /** Read-only history block above the editor (per-type). */
  snapshot?: ReactNode;
  /** Editor body (or the per-type fallback text). */
  children: ReactNode;
  /** Destination row (create mode) — rendered between the body and the
   *  footer so "where will this land" sits next to the Save that
   *  commits it. */
  destination?: ReactNode;
  /** Conditions row — rendered directly below the destination row (or
   *  in its place in edit mode) so "when will this fire" sits next to
   *  the Save too. */
  conditions?: ReactNode;
  onOpenInEditor: () => void;
  /** Footer-link gate. Defaults to `!!liveRule` (edit mode disables the
   *  link when the rule is gone); create mode passes `true` — there is
   *  no live rule yet but the link hands off the current draft. */
  canOpenInEditor?: boolean;
  /** Save affordance — omitted when the body isn't editable. */
  save?: QuickEditorSave;
  onMouseEnter?: () => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  visible?: boolean;
}

export function QuickEditorShell({
  anchorEl,
  liveRule,
  ruleType,
  ruleName,
  onRuleNameChange,
  liveRuleUid,
  isDirty,
  tags,
  snapshot,
  children,
  destination,
  conditions,
  onOpenInEditor,
  canOpenInEditor,
  save,
  onMouseEnter,
  onMouseLeave,
  visible = true,
}: QuickEditorShellProps) {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const localInstanceId = useLocalInstanceId();

  // Product telemetry: every quick-editor body mounts through this
  // shell, so one mount = one quick-editor use gesture.
  useEffect(() => {
    noteFeatureUsed('quick-editor');
  }, []);

  // Top-right enabled toggle — edit mode only (create bodies pass
  // `liveRule: null`). Applies INSTANTLY via the dedicated toggle seam
  // (same one the popup rule table uses): `enabled` is orthogonal to
  // the publication gate, so it never rides the Save batch and never
  // trips the streaming-edit auto-unpublish. The rule icon's color and
  // the Matched-row "rule disabled" tag react through the live mirror.
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const [toggling, setToggling] = useState(false);
  const handleToggleEnabled = async (enabled: boolean) => {
    if (!liveRule) return;
    setToggling(true);
    try {
      const result = await mutator.toggleRule(liveRule.uid, enabled);
      if (!result.ok) {
        message.error(
          result.reason === 'not-found'
            ? t('panel.quickEditor.toast.ruleNotFound')
            : (result.message ?? t('panel.quickEditor.toast.toggleFailed')),
        );
      }
    } finally {
      setToggling(false);
    }
  };

  // Create-mode rename: the title flips to an input on click; Enter or
  // blur commits (empty reverts), Escape cancels. Newlines can only
  // arrive via paste (the field swallows Enter) — flatten them.
  // Controlled while editing so the embedded clear ✕ can empty the
  // field in place and knows when to render.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const startEditingName = () => {
    setNameDraft(ruleName);
    setEditingName(true);
  };
  const commitName = (raw: string) => {
    const next = raw.replace(/\s*\n\s*/g, ' ').trim();
    if (next && next !== ruleName) onRuleNameChange?.(next);
    setEditingName(false);
  };

  // ── Surface awareness wiring ────────────────────────────────────
  //
  // The single `<SurfaceAwarenessPublisher>` mounted at the devpanel
  // root composes the surface's awareness claim from three workspace
  // contexts. The popover contributes:
  //   - `ActiveTabEntity` — set when visible+rule, cleared on unmount
  //   - `ActiveFieldFocus` — published by `<EntityField>` wrappers the
  //     per-type body mounts around its inputs
  //   - `ActiveEditorDirty` — `useEditorDirty(scope, isDirty)` writes
  //     when this popover IS the active tab entity
  const setActiveTabEntity = useSetActiveTabEntity();
  useEffect(() => {
    if (!visible || !liveRuleUid) return;
    setActiveTabEntity({ entityType: RULE_ENTITY_TYPE, entityId: liveRuleUid });
    return () => {
      setActiveTabEntity(null);
    };
  }, [visible, liveRuleUid, setActiveTabEntity]);
  useEditorDirty({ entityType: RULE_ENTITY_TYPE, entityId: liveRuleUid }, isDirty);

  // Render into the inspector root so the root's `overflow: hidden` clips the
  // popover to the pane and its always-on-top footer covers any graze — the
  // same containment the toolbar/View menus get. Positioned absolute + bounded
  // to the pane (not the window), so it can't spill past the footer, and
  // pinned (no scroll re-anchor) so it stays put as the list scrolls.
  const boundsEl = useMemo(() => anchorEl.closest<HTMLElement>('.dt-panel-root'), [anchorEl]);
  // The panel status bar — the cap tracks its real top so the popover's bottom
  // stays above it on resize, on BOTH sides (the `above` placement, used when
  // the row is near the bottom, has no footer awareness on its own).
  const footerEl = useMemo(() => boundsEl?.querySelector<HTMLElement>(':scope > .rules-statusbar') ?? null, [boundsEl]);
  const { position, popoverRef, measured } = usePopoverPlacement(anchorEl, QUICK_EDITOR_WIDTH, {
    trackScroll: false,
    boundsEl,
    footerEl,
    // Anchor once, then stay put (like the static toolbar popovers) so the
    // panel reflowing during a resize can't jitter it; only the footer-tracked
    // `maxHeight` keeps updating, shrinking the popover to clear the footer.
    staticAfterMeasure: true,
  });

  const popoverNode = (
    <div
      ref={popoverRef}
      role="dialog"
      data-rule-popover-root=""
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        // Absolute inside the inspector root (so its overflow clips us); fixed
        // when there's no container to portal into (degraded fallback).
        position: boundsEl ? 'absolute' : 'fixed',
        top: position.top,
        left: position.left,
        width: QUICK_EDITOR_WIDTH,
        zIndex: 1080,
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
        // Footer-tracked cap (both sides): `usePopoverPlacement` measures the
        // status bar's real top and shrinks this on resize so the bottom stays
        // above the footer and the CONTENT scrolls inside, whether the popover
        // opened below the row or flipped above it. The shell footer (link +
        // Save) stays pinned: only the inner column scrolls, so the scrollbar
        // ends above the footer instead of running behind it.
        maxHeight: position.maxHeight,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        visibility: measured ? 'visible' : 'hidden',
        opacity: measured && visible ? 1 : 0,
        transform: measured && visible ? 'scale(1)' : 'scale(0.96)',
        transformOrigin: `${position.side === 'above' ? 'bottom' : 'top'} left`,
        transition: 'opacity 120ms ease-out, transform 120ms ease-out',
      }}
    >
      <div
        className="dt-scrollbar"
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto', overscrollBehavior: 'none',
          overflowX: 'hidden',
          padding: '12px 12px 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, minWidth: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
            {buildRuleIcon({
              ruleType,
              rule: liveRule ?? undefined,
              isActive: liveRule?.enabled ?? true,
              compactArrow: true,
              size: 14,
            })}
          </span>
          {editingName && onRuleNameChange ? (
            // A single-line no-wrap textarea, not an <input>: inputs can't
            // paint a scrollbar, so a long name would only be reachable by
            // caret-scrubbing. This shows the panel's thin horizontal bar
            // (shared `.dt-scrollbar`) when the name overflows. Horizontal
            // scroll ONLY — the title row never grows vertically; the
            // embedded ✕ clears in place (blur/Enter on empty reverts).
            // The bordered box is the WRAPPER, not the textarea: its 22px
            // right padding is the ✕'s reserved column, so the text (and
            // its scrollbar) stop in front of the icon instead of sliding
            // under it — right-padding inside a scrolling element doesn't
            // survive at the scroll end.
            <span
              style={{
                position: 'relative',
                display: 'flex',
                flex: 1,
                minWidth: 0,
                boxSizing: 'border-box',
                height: 30,
                paddingRight: 22,
                border: `1px solid ${token.colorPrimary}`,
                borderRadius: token.borderRadius,
                background: token.colorBgContainer,
              }}
            >
              <textarea
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                rows={1}
                wrap="off"
                spellCheck={false}
                className="dt-scrollbar"
                style={{
                  flex: 1,
                  minWidth: 0,
                  boxSizing: 'border-box',
                  height: '100%',
                  padding: '3px 0 3px 6px',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                  fontSize: 12,
                  lineHeight: '18px',
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  resize: 'none',
                  border: 'none',
                  background: 'transparent',
                  color: token.colorText,
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => commitName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitName(e.currentTarget.value);
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setEditingName(false);
                  }
                }}
              />
              {nameDraft.length > 0 && (
                <CloseCircleFilled
                  aria-label={t('panel.quickEditor.clearRuleNameAria')}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setNameDraft('')}
                  style={{
                    position: 'absolute',
                    right: 6,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 12,
                    color: token.colorTextQuaternary,
                    cursor: 'pointer',
                  }}
                />
              )}
            </span>
          ) : (
            <span
              className={onRuleNameChange ? 'dt-quick-rule-title' : undefined}
              style={{
                fontWeight: 600,
                fontSize: 12,
                lineHeight: '20px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
                cursor: onRuleNameChange ? 'text' : undefined,
              }}
              title={onRuleNameChange ? t('panel.quickEditor.renameTitle', { name: ruleName }) : ruleName}
              onClick={onRuleNameChange ? startEditingName : undefined}
            >
              {ruleName}
            </span>
          )}
          {liveRuleUid && (
            <PresenceBadge entityType={RULE_ENTITY_TYPE} entityId={liveRuleUid} excludeInstanceId={localInstanceId} />
          )}
          {tags}
          {liveRule && (
            <Switch
              size="small"
              checked={liveRule.enabled !== false}
              checkedChildren={t('panel.quickEditor.enabledOn')}
              unCheckedChildren={t('panel.quickEditor.enabledOff')}
              loading={toggling}
              onChange={(enabled) => void handleToggleEnabled(enabled)}
              aria-label={t('panel.quickEditor.ruleEnabledAria')}
              style={{ flexShrink: 0 }}
            />
          )}
        </div>

        {snapshot}

        {children}

        {destination}

        {conditions}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          padding: '5px 12px 6px',
          gap: 8,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Button
          type="link"
          size="small"
          onClick={onOpenInEditor}
          style={{ padding: 0, fontSize: 11 }}
          disabled={!(canOpenInEditor ?? !!liveRule)}
        >
          {t('panel.quickEditor.openInWorkspace')}
        </Button>
        {save && (
          <Tooltip
            title={<ShortcutHintTitle label={save.saveLabel}>{t('panel.quickEditor.saveButton')}</ShortcutHintTitle>}
            placement="bottomRight"
            zIndex={1090}
          >
            <Button
              size="small"
              type="primary"
              icon={<SaveOutlined />}
              loading={save.saving}
              disabled={!save.canSave}
              onClick={save.onSave}
              style={{
                fontSize: 11,
                ...(save.canSave ? { background: '#f5722d', borderColor: '#f5722d' } : {}),
              }}
            >
              {t('panel.quickEditor.saveButton')}
            </Button>
          </Tooltip>
        )}
      </div>
    </div>
  );

  // Portal into the inspector root so the root's `overflow: hidden` clips the
  // popover and its footer covers any graze. Fall back to inline render (fixed
  // positioning) when no container resolves.
  return boundsEl ? createPortal(popoverNode, boundsEl) : popoverNode;
}
