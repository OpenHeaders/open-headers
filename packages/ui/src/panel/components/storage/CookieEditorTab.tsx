/**
 * CookieEditorTab — one browser-jar cookie opened as a full editor-tab
 * document. The canonical is the live jar row, re-fetched one-shot
 * through the site-jar plane and matched by identity (name · domain ·
 * path · partition); the body is the shared cookie attribute grid, so
 * the document and the quick-edit popover can never drift on field
 * vocabulary or `{{var}}` template semantics.
 *
 * Dirty derives from form-vs-canonical equality across ALL fields. A
 * Save that keeps the cookie's jar identity is a plain overwrite-in-
 * place; an identity change (name / domain / path / host-only flip) is
 * set-new-then-remove-old with a collision check first — a different
 * cookie already at the new identity rejects with an inline note, never
 * a silent overwrite — and the committed move re-keys the tab via
 * `onRekeyed`. Hosts without a jar write path render the document
 * read-only. Refresh while dirty arms first — a confirm discards the
 * drafts, never silently.
 */

import { ReloadOutlined } from '@ant-design/icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  type CookieEditFormValues,
  editFormsEqual,
  emptyEditForm,
  formToEdit,
  isEditFormValid,
  jarCookieToEditForm,
  jarCookieToKey,
  jarKeysSameCookie,
  mergeEditFormWithCanonical,
  predictedJarKey,
} from '../../data/cookies/cookie-edit';
import {
  fetchSiteJarCookiesOnce,
  isCookieJarWritable,
  type JarCookieKey,
  removeJarCookie,
  type SiteJarCookie,
  subscribeCookieJar,
  writeJarCookie,
} from '../../data/cookies/cookie-jar-cache';
import type { CookieInspectorTab } from '../../data/inspector-tab';
import { useDocumentSync } from '../../data/storage/use-document-sync';
import { CookieEditFields, useCookieFieldResolution } from '../detail/cookies/CookieEditFields';
import { useCookieConflictTier } from '../detail/cookies/useCookieConflictTier';
import { ArmedIconButton } from './ArmedIconButton';
import { StorageDocSaveButton } from './StorageDocSaveButton';

interface CookieDocument {
  jar: SiteJarCookie;
  canonical: CookieEditFormValues;
  /** The canonical vanished under a dirty form — the drafts stay
   *  visible with an honest note instead of blanking (a clean form
   *  re-seeds to the unavailable state instead). */
  gone?: boolean;
}

type DocumentSlot = 'loading' | 'unavailable' | CookieDocument;

type SaveFailure = 'collision' | 'write' | 'remove';

const SAVE_FAILURE_NOTES: Record<SaveFailure, string> = {
  collision:
    'A cookie with that name, domain and path already exists — saving would overwrite it. Pick a different identity.',
  write: 'Save failed — the browser jar rejected the write.',
  remove: 'The new cookie was written but the original couldn’t be removed — both exist. Refresh re-reads the jar.',
};

interface CookieEditorTabProps {
  tab: CookieInspectorTab;
  onRevealInStorage: () => void;
  /** Mirrors the derived dirty state up into the tab (pill dot, close guard). */
  onDirtyChange?: (dirty: boolean) => void;
  /** A committed identity change — the parent re-keys the tab (id,
   *  label, cookieKey) so re-opens and row highlights keep matching. */
  onRekeyed?: (newKey: JarCookieKey) => void;
  /** Registers this tab's save action for the close guard's "Save
   *  changes" path; called with `null` on unmount. Resolves whether the
   *  save committed. */
  registerSave?: (save: (() => Promise<boolean>) | null) => void;
  /** Whether this document is the focused group's active tab — gates
   *  the Save keyboard chord when a split shows two documents. */
  isActiveDocument?: boolean;
}

export function CookieEditorTab({
  tab,
  onRevealInStorage,
  onDirtyChange,
  onRekeyed,
  registerSave,
  isActiveDocument,
}: CookieEditorTabProps) {
  const [slot, setSlot] = useState<DocumentSlot>('loading');
  const [values, setValues] = useState<CookieEditFormValues>(emptyEditForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveFailure | null>(null);
  const fetchTokenRef = useRef(0);

  const { cookieKey, scopeUrl } = tab;
  const writable = isCookieJarWritable();

  const doc = typeof slot === 'object' ? slot : null;

  // Conflict tier — shared with the quick-edit popover. Suppressed while
  // the document is gone (the whole-document note supersedes per-field
  // chips).
  const clearSaveError = useCallback(() => setSaveError(null), []);
  const conflictTier = useCookieConflictTier({
    enabled: doc !== null && doc.gone !== true && writable,
    values,
    setValues,
    canonical: doc?.canonical ?? null,
    onMergeApplied: clearSaveError,
  });
  const seedConflicts = conflictTier.seed;

  const fetchDocument = useCallback(async () => {
    const token = ++fetchTokenRef.current;
    setSlot('loading');
    const site = await fetchSiteJarCookiesOnce(scopeUrl);
    if (token !== fetchTokenRef.current) return;
    const jar = site?.find((c) => jarKeysSameCookie(jarCookieToKey(c), cookieKey)) ?? null;
    if (jar === null) {
      setSlot('unavailable');
    } else {
      const canonical = jarCookieToEditForm(jar);
      setSlot({ jar, canonical });
      setValues(canonical);
      seedConflicts(canonical);
    }
    setSaveError(null);
  }, [scopeUrl, cookieKey, seedConflicts]);

  useEffect(() => {
    void fetchDocument();
  }, [fetchDocument]);

  const { fields, anyUnresolved, resolvedForm } = useCookieFieldResolution(values);
  const dirty = doc !== null && !editFormsEqual(values, doc.canonical);

  // Latest-state mirrors for the silent sync path — it lands after an
  // await and must merge against the CURRENT document + form, not the
  // ones captured when the fetch started.
  const docRef = useRef(doc);
  docRef.current = doc;
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Live canonical catch-up: on a jar notify or a poll tick, re-read
  // the jar and fold the fresh canonical into the open form — clean
  // fields silently adopt it, touched fields keep their drafts. Never
  // flips the document back to loading.
  const syncDocument = useCallback(async () => {
    if (docRef.current === null) return;
    const token = ++fetchTokenRef.current;
    const site = await fetchSiteJarCookiesOnce(scopeUrl);
    if (token !== fetchTokenRef.current) return;
    const current = docRef.current;
    if (current === null || site === null) return;
    const jar = site.find((c) => jarKeysSameCookie(jarCookieToKey(c), cookieKey)) ?? null;
    const form = valuesRef.current;
    if (jar === null) {
      // Deleted under the document: a clean form re-seeds to the honest
      // empty state; a dirty form keeps the drafts with a note.
      if (editFormsEqual(form, current.canonical)) setSlot('unavailable');
      else if (current.gone !== true) setSlot({ ...current, gone: true });
      return;
    }
    const next = jarCookieToEditForm(jar);
    if (current.gone !== true && editFormsEqual(next, current.canonical)) return;
    setValues(mergeEditFormWithCanonical(current.canonical, form, next));
    setSlot({ jar, canonical: next });
  }, [scopeUrl, cookieKey]);

  const runSync = useCallback(() => {
    void syncDocument();
  }, [syncDocument]);

  useDocumentSync({
    enabled: doc !== null && !saving,
    sync: runSync,
    subscribe: subscribeCookieJar,
  });
  // Validity runs on the RESOLVED form — a `{{var}}` resolving to '' in
  // Name / Domain must block like a literal empty would.
  const savable = dirty && writable && !anyUnresolved && isEditFormValid(resolvedForm);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const set = useCallback(<K extends keyof CookieEditFormValues>(key: K, val: CookieEditFormValues[K]): void => {
    setValues((prev) => ({ ...prev, [key]: val }));
    setSaveError(null);
  }, []);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (doc === null || !savable) return false;
    const edit = formToEdit(resolvedForm);
    const oldKey = jarCookieToKey(doc.jar);
    const predicted = predictedJarKey(resolvedForm);
    setSaving(true);
    if (jarKeysSameCookie(predicted, oldKey)) {
      // Same identity — the jar overwrites the cookie in place.
      const written = await writeJarCookie(edit);
      setSaving(false);
      if (written === null) {
        setSaveError('write');
        return false;
      }
      // Commit-then-refetch through the read path — the document becomes
      // the jar's truth again (the section's poll picks it up).
      await fetchDocument();
      return true;
    }
    // Identity moved: a DIFFERENT cookie already at the new identity
    // would be silently stomped by the set — reject instead.
    const site = await fetchSiteJarCookiesOnce(scopeUrl);
    if (site === null) {
      setSaving(false);
      setSaveError('write');
      return false;
    }
    if (site.some((c) => jarKeysSameCookie(jarCookieToKey(c), predicted))) {
      setSaving(false);
      setSaveError('collision');
      return false;
    }
    // Set new first, then remove old — a failed set leaves the original
    // untouched.
    const written = await writeJarCookie(edit);
    if (written === null) {
      setSaving(false);
      setSaveError('write');
      return false;
    }
    const newKey = jarCookieToKey(written);
    if (jarKeysSameCookie(newKey, oldKey)) {
      // The jar landed the write on the original identity after all —
      // a plain overwrite, no move to commit.
      setSaving(false);
      await fetchDocument();
      return true;
    }
    const removed = await removeJarCookie(oldKey);
    setSaving(false);
    if (!removed) {
      setSaveError('remove');
      return false;
    }
    // The cookie's identity moved — re-keying the tab remounts this
    // editor under the new key, which re-fetches through the read path.
    onRekeyed?.(newKey);
    return true;
  }, [doc, savable, resolvedForm, scopeUrl, fetchDocument, onRekeyed]);

  useEffect(() => {
    registerSave?.(handleSave);
    return () => registerSave?.(null);
  }, [registerSave, handleSave]);

  const errorNote = saveError === null ? null : SAVE_FAILURE_NOTES[saveError];
  const crumbTitle = `${cookieKey.domain}${cookieKey.path} › ${cookieKey.name}`;

  return (
    <div className="dt-storagedoc">
      <div className="dt-storagedoc-toolbar">
        <span className="dt-storagedoc-crumb" title={crumbTitle}>
          Cookies › {cookieKey.domain}
          {cookieKey.path} › <span className="dt-storagedoc-crumb-key">{cookieKey.name}</span>
        </span>
        <span className="dt-storagedoc-toolbar-spacer" />
        {doc !== null && writable && (
          <StorageDocSaveButton
            savable={savable}
            saving={saving}
            dirty={dirty}
            saveHint="Write the edited cookie back to the browser jar"
            blockedHint="The form is incomplete or a reference doesn’t resolve"
            isActiveDocument={isActiveDocument}
            onSave={() => void handleSave()}
          />
        )}
        {dirty ? (
          <ArmedIconButton
            icon={<ReloadOutlined />}
            title="Re-read the cookie"
            confirmTitle="Discards your edits — click again to refresh"
            ariaLabel="Refresh cookie"
            onConfirm={() => void fetchDocument()}
          />
        ) : (
          <button
            type="button"
            className="dt-storage-action"
            title="Re-read the cookie"
            aria-label="Refresh cookie"
            onClick={() => void fetchDocument()}
          >
            <ReloadOutlined />
          </button>
        )}
        <button
          type="button"
          className="dt-storagedoc-reveal"
          title="Open Cookies in the Storage tool window"
          onClick={() => onRevealInStorage()}
        >
          Reveal in Storage
        </button>
      </div>
      {conflictTier.banner}
      {conflictTier.dialog}
      {doc !== null && !writable && (
        <div className="dt-storagedoc-note">
          This host’s cookie jar is read-only — the document reflects the jar but can’t write back.
        </div>
      )}
      {doc?.gone === true && (
        <div className="dt-storagedoc-note">
          This cookie was deleted in the browser — your unsaved edits are kept. Save writes it back.
          <button type="button" className="dt-storagedoc-note-action" onClick={() => setSlot('unavailable')}>
            Discard my edits
          </button>
        </div>
      )}
      {errorNote !== null && (
        <div className="dt-storagedoc-note dt-storagedoc-note--error" role="alert">
          {errorNote}
        </div>
      )}
      {slot === 'loading' ? (
        <div className="dt-empty">Loading…</div>
      ) : slot === 'unavailable' ? (
        <div className="dt-empty-hero">
          <strong>Cookie no longer in the jar</strong>
          <span className="dt-empty-hero-sub">
            It may have been deleted or expired, or the jar can’t be read on this host — Refresh retries.
          </span>
        </div>
      ) : (
        <div className="dt-storagedoc-cookieform dt-scrollbar">
          <CookieEditFields
            values={values}
            fields={fields}
            set={set}
            busy={saving}
            readOnly={!writable}
            affixes={conflictTier.affixes}
          />
        </div>
      )}
    </div>
  );
}
