/**
 * ValueDocumentTab — one rule field's detected value (JWT, big JSON,
 * long Base64, …) opened as a full editor-tab document: the
 * popover-bound `CompactValueEditor`'s escalation for values too heavy
 * for an inline textarea. Same decode/encode spine as the compact
 * editor (the pure compact codec — JWTs edit payload-only, prefixes
 * carry, preview === written value), but Monaco-backed and long-lived.
 *
 * The canonical is the LIVE rule through the sync mirror — no fetch,
 * no poll: a pristine document adopts remote edits the moment they
 * broadcast, a dirty one keeps its draft and surfaces the drift with
 * an honest note. The rule or modification vanishing under a dirty
 * draft keeps the text visible for copy-out (Save stays blocked — a
 * detached field has nothing to write to). Save goes through the rule
 * mutator with a value-only, uid-keyed update that carries
 * `published: true` in the same batch, so a live rule stays live.
 */

import { ExportOutlined, ReloadOutlined } from '@ant-design/icons';
import type { MessageKey } from '@openheaders/i18n';
import type { HeaderModification, HeaderRule } from '@openheaders/core/types';
import { useLiveRule } from '@openheaders/ui/context';
import { useRuleMutator } from '@openheaders/ui/shared/hooks/mutators/useRuleMutator';
import { useActiveWorkspaceId } from '@openheaders/ui/shared/hooks/readers/useActiveWorkspaceId';
import { useT } from '@openheaders/ui/context/LocaleContext';
import {
  COMPACT_VALUE_TITLE_KEYS,
  compactDecodedText,
  type DetectedValue,
  detectValueType,
  encodeDetectedValue,
  pairGridTypeOf,
} from '@openheaders/ui/shared/value-detection';
import { openWorkspace } from '@openheaders/ui/shared/workspace-intent';
import { PairGridEditor } from '@openheaders/ui/workbench/components/value-editors/PairGridEditor';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { RuleValueInspectorTab } from '../../data/inspector-tab';
import { buildHeaderModValueUpdate } from '../../data/rule-create/header-mod-edit';
import Skeleton from '../detail/Skeleton';
import { ArmedIconButton } from '../storage/ArmedIconButton';
import { StorageDocSaveButton } from '../storage/StorageDocSaveButton';

// Lazy like every other Monaco consumer — a static import here would
// pull Monaco back into the panel's initial chunk.
const CodeViewer = lazy(() => import('../detail/CodeViewer'));

/** The live field resolved against the mirror: detached covers the
 *  rule gone, the mod gone, and the mod flipped to `remove` (no value
 *  to hold); undetected means the value no longer matches a detector
 *  (nothing to decode/encode against). */
type Canonical =
  | { kind: 'detached' }
  | { kind: 'undetected'; rule: HeaderRule; mod: HeaderModification }
  | { kind: 'detected'; rule: HeaderRule; mod: HeaderModification; detected: DetectedValue; decoded: string };

/** Draft captured at first edit — `seed` is the decoded canonical it
 *  forked from, so canonical movement underneath is detectable. */
interface Draft {
  seed: string;
  text: string;
}

type SaveFailure = 'detached' | 'not-found' | 'write';

const SAVE_FAILURE_NOTES: Record<SaveFailure, MessageKey> = {
  detached: 'panel.valueDoc.saveFailed.detached',
  'not-found': 'panel.valueDoc.saveFailed.notFound',
  write: 'panel.valueDoc.saveFailed.write',
};

interface ValueDocumentTabProps {
  tab: RuleValueInspectorTab;
  /** Mirrors the derived dirty state up into the tab (pill dot, close guard). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Registers this tab's save action for the close guard's "Save
   *  changes" path; called with `null` on unmount. Resolves whether the
   *  save committed. */
  registerSave?: (save: (() => Promise<boolean>) | null) => void;
  /** Whether this document is the focused group's active tab — gates
   *  the Save keyboard chord when a split shows two documents. */
  isActiveDocument?: boolean;
}

export function ValueDocumentTab({ tab, onDirtyChange, registerSave, isActiveDocument }: ValueDocumentTabProps) {
  const t = useT();
  const workspaceId = useActiveWorkspaceId();
  const mutator = useRuleMutator({ workspaceId, surfaceId: 'devpanel' });
  const liveRule = useLiveRule(tab.ruleUid, workspaceId);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);

  const canonical = useMemo<Canonical>(() => {
    const rule = liveRule?.type === 'header' ? liveRule : null;
    if (rule === null) return { kind: 'detached' };
    const list = tab.direction === 'request' ? rule.action.requestHeaders : rule.action.responseHeaders;
    const mod = list.find((m) => m.uid === tab.modUid) ?? null;
    if (mod === null || mod.operation === 'remove' || mod.value === undefined) return { kind: 'detached' };
    const detected = detectValueType(mod.value);
    if (detected === null) return { kind: 'undetected', rule, mod };
    return { kind: 'detected', rule, mod, detected, decoded: compactDecodedText(detected) };
  }, [liveRule, tab.direction, tab.modUid]);

  const canonicalDecoded = canonical.kind === 'detected' ? canonical.decoded : null;

  // A pristine draft whose seed matches the live canonical is inert —
  // drop it so the document resumes mirroring the mirror. The seed
  // check matters after Save: the draft re-seeds to the WRITTEN value
  // before the broadcast lands, and dropping it early would flash the
  // stale canonical.
  useEffect(() => {
    if (draft !== null && draft.text === draft.seed && draft.seed === canonicalDecoded) setDraft(null);
  }, [draft, canonicalDecoded]);

  const heldDraft = draft !== null && draft.text !== draft.seed ? draft : null;
  const dirty = heldDraft !== null;
  const text = draft?.text ?? canonicalDecoded ?? '';
  // Canonical moved (or vanished) under a held draft — the seed the
  // draft forked from is no longer the live decoded value.
  const drifted = heldDraft !== null && canonicalDecoded !== null && heldDraft.seed !== canonicalDecoded;
  const detachedUnderDraft = heldDraft !== null && canonicalDecoded === null;

  const encoded = useMemo(
    () => (canonical.kind === 'detected' ? encodeDetectedValue(canonical.detected, text) : null),
    [canonical, text],
  );
  const savable = canonical.kind === 'detected' && dirty && text.length > 0 && encoded !== null && !saving;

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleChange = useCallback(
    (next: string) => {
      setDraft((prev) => {
        if (prev !== null) return { ...prev, text: next };
        if (canonicalDecoded === null) return prev;
        return { seed: canonicalDecoded, text: next };
      });
      setSaveError(null);
    },
    [canonicalDecoded],
  );

  const discardDraft = useCallback(() => {
    setDraft(null);
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (canonical.kind !== 'detected' || !savable || encoded === null) return false;
    const built = buildHeaderModValueUpdate(canonical.rule, tab.direction, tab.modUid, encoded);
    if (!built.ok) {
      setSaveError('detached');
      return false;
    }
    setSaving(true);
    try {
      const result = await mutator.updateRule(canonical.rule.uid, built.updates);
      if (!result.ok) {
        setSaveError(result.reason === 'not-found' ? 'not-found' : 'write');
        return false;
      }
      // Re-seed from what was just written — the mirror broadcast lands
      // a beat later, and the document must read clean immediately.
      const nextDetected = detectValueType(encoded);
      const nextDecoded = nextDetected === null ? null : compactDecodedText(nextDetected);
      setDraft(nextDecoded === null ? null : { seed: nextDecoded, text: nextDecoded });
      return true;
    } finally {
      setSaving(false);
    }
  }, [canonical, savable, encoded, tab.direction, tab.modUid, mutator]);

  useEffect(() => {
    registerSave?.(handleSave);
    return () => registerSave?.(null);
  }, [registerSave, handleSave]);

  const openInWorkspace = useCallback(() => {
    void openWorkspace({ kind: 'edit-rule', uid: tab.ruleUid }, 'devpanel');
  }, [tab.ruleUid]);

  const title = canonical.kind === 'detected' ? t(COMPACT_VALUE_TITLE_KEYS[canonical.detected.type]) : null;
  // Pair-shaped values (cookie, query-string) edit as a name/value
  // grid over the same decoded text — draft, drift, and save are
  // untouched. A draft held over a vanished field falls back to the
  // text body for copy-out.
  const gridType = canonical.kind === 'detected' ? pairGridTypeOf(canonical.detected.type) : null;
  const language = useMemo(() => {
    if (canonical.kind !== 'detected') return 'plaintext';
    return canonical.detected.type === 'jwt' || canonical.detected.type === 'json' ? 'json' : 'plaintext';
  }, [canonical]);
  const liveHeaderName = canonical.kind === 'detached' ? tab.headerName : canonical.mod.headerName;
  const ruleName = canonical.kind === 'detached' ? null : canonical.rule.name;
  const crumbName = ruleName ?? t('panel.valueDoc.crumbFallback');
  const crumbTitle = `${crumbName} › ${liveHeaderName}`;
  const showEditor = canonical.kind === 'detected' || dirty;

  return (
    <div className="dt-storagedoc">
      <div className="dt-storagedoc-toolbar">
        <span className="dt-storagedoc-crumb" title={crumbTitle}>
          {crumbName} › <span className="dt-storagedoc-crumb-key">{liveHeaderName}</span>
          {title !== null && <span className="dt-storage-meta"> · {title}</span>}
        </span>
        <span className="dt-storagedoc-toolbar-spacer" />
        <StorageDocSaveButton
          savable={savable}
          saving={saving}
          dirty={dirty}
          saveHint={t('panel.valueDoc.saveHint')}
          blockedHint={
            canonical.kind === 'detected'
              ? t('panel.valueDoc.blockedHintInvalid')
              : t('panel.valueDoc.blockedHintDetached')
          }
          isActiveDocument={isActiveDocument}
          onSave={() => void handleSave()}
        />
        {dirty && (
          <ArmedIconButton
            icon={<ReloadOutlined />}
            title={t('panel.valueDoc.rereadTitle')}
            confirmTitle={t('panel.valueDoc.rereadConfirm')}
            ariaLabel={t('panel.valueDoc.rereadAria')}
            onConfirm={discardDraft}
          />
        )}
        <button
          type="button"
          className="dt-storagedoc-reveal"
          title={t('panel.valueDoc.openRuleTitle')}
          onClick={openInWorkspace}
        >
          <ExportOutlined aria-hidden="true" /> {t('panel.valueDoc.openRule')}
        </button>
      </div>
      {drifted && (
        <div className="dt-storagedoc-note">
          {t('panel.valueDoc.driftNote')}
          <button type="button" className="dt-storagedoc-note-action" onClick={discardDraft}>
            {t('panel.valueDoc.discardEdits')}
          </button>
        </div>
      )}
      {detachedUnderDraft && (
        <div className="dt-storagedoc-note">
          {canonical.kind === 'undetected' ? t('panel.valueDoc.undetectedNote') : t('panel.valueDoc.detachedNote')}
          <button type="button" className="dt-storagedoc-note-action" onClick={discardDraft}>
            {t('panel.valueDoc.discardEdits')}
          </button>
        </div>
      )}
      {saveError !== null && (
        <div className="dt-storagedoc-note dt-storagedoc-note--error" role="alert">
          {t(SAVE_FAILURE_NOTES[saveError])}
        </div>
      )}
      {showEditor ? (
        <>
          {gridType !== null ? (
            <div className="dt-storagedoc-source dt-scrollbar" style={{ overflowY: 'auto', overscrollBehavior: 'none', padding: 12 }}>
              <PairGridEditor gridType={gridType} value={text} onChange={handleChange} />
            </div>
          ) : (
            <div className="dt-storagedoc-source">
              <Suspense fallback={<Skeleton />}>
                {/* Detection off (both planes): this document IS a detected
                    value's decoded text — JWTs here edit payload-only
                    through the compact codec, never the full JWT modal. */}
                <CodeViewer
                  value={text}
                  language={language}
                  readOnly={false}
                  onChange={handleChange}
                  jwtDetection={false}
                  decodeAffordance={false}
                />
              </Suspense>
            </div>
          )}
          {dirty && canonical.kind === 'detected' && (
            <div className="dt-valuedoc-preview" aria-label={t('panel.valueDoc.encodedPreview')}>
              <span className="dt-valuedoc-preview-label">{t('panel.valueDoc.encodedPreview')}</span>
              <div className="dt-valuedoc-preview-body dt-scrollbar">
                {encoded === null ? (
                  <span className="dt-valuedoc-preview-error">{t('panel.valueDoc.cannotEncode')}</span>
                ) : (
                  encoded
                )}
              </div>
            </div>
          )}
        </>
      ) : canonical.kind === 'undetected' ? (
        <div className="dt-empty-hero">
          <strong>{t('panel.valueDoc.undetectedTitle')}</strong>
          <span className="dt-empty-hero-sub">{t('panel.valueDoc.undetectedSub')}</span>
        </div>
      ) : (
        <div className="dt-empty-hero">
          <strong>{t('panel.valueDoc.detachedTitle')}</strong>
          <span className="dt-empty-hero-sub">{t('panel.valueDoc.detachedSub')}</span>
        </div>
      )}
    </div>
  );
}
