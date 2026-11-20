/**
 * The Add cookie form's batch tier — a paste that holds SEVERAL cookies
 * (a `Cookie` header, a run of `Set-Cookie` lines) turns the form into
 * a checklist: one row per cookie, the form's Name and Value stand down,
 * and its remaining fields become the attributes NEW cookies take.
 *
 * Every row says what Save does with it — a new cookie, or a write onto
 * one the jar already holds (which keeps its own identity and
 * attributes; see `planPastedCookies`). Still a transform until Save:
 * the rows are a plan over the live shared fields, so fixing a field a
 * row trips on (a `__Host-` name wanting Secure) frees that row. Save
 * writes the checked rows in order and keeps the form open on any
 * failure, each failed row saying why.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import {
  type CookieEditFormValues,
  editFormConstraintError,
  formToEdit,
  isEditFormValid,
} from '../../../data/cookies/cookie-edit';
import {
  type CookieWriteResult,
  fetchSiteJarCookiesOnce,
  type JarCookieEdit,
  type SiteJarCookie,
} from '../../../data/cookies/cookie-jar-cache';
import { type PastedCookie, planPastedCookies } from '../../../data/cookies/cookie-paste';

/** What a host gives the Add popover to take a batch: the scope whose
 *  jar the rows are planned against, and the write for the checked ones
 *  (one outcome per edit, in order). */
export interface CookiePasteBatchHost {
  scopeUrl: string;
  onSubmit: (edits: readonly JarCookieEdit[]) => Promise<readonly CookieWriteResult[]>;
}

interface CookiePasteBatchOptions {
  host: CookiePasteBatchHost | undefined;
  /** The form with its templates resolved — the attributes new cookies take. */
  shared: CookieEditFormValues;
  disabled: boolean;
}

export interface CookiePasteBatch {
  /** How many cookies the checklist holds; `null` while the form is a single cookie. */
  total: number | null;
  /** Rows Save would write now. */
  savable: number;
  /** Enter the checklist with these cookies, or leave it with `null`. */
  list: (cookies: readonly PastedCookie[] | null) => void;
  /** Write the checked rows; resolves whether every one landed. */
  save: () => Promise<boolean>;
  node: ReactNode;
}

const NO_ROWS: ReadonlySet<number> = new Set();
const NO_OUTCOMES: ReadonlyMap<number, CookieWriteResult> = new Map();

export function useCookiePasteBatch({ host, shared, disabled }: CookiePasteBatchOptions): CookiePasteBatch {
  const t = useT();
  const [cookies, setCookies] = useState<readonly PastedCookie[] | null>(null);
  // `null` until the scope's jar is in — rows can't say New or Replaces
  // before it, so nothing is savable yet.
  const [jar, setJar] = useState<readonly SiteJarCookie[] | null>(null);
  const [unchecked, setUnchecked] = useState<ReadonlySet<number>>(NO_ROWS);
  const [outcomes, setOutcomes] = useState<ReadonlyMap<number, CookieWriteResult>>(NO_OUTCOMES);
  const jarTokenRef = useRef(0);

  const list = useCallback(
    (next: readonly PastedCookie[] | null) => {
      const token = ++jarTokenRef.current;
      setCookies(next);
      setJar(null);
      setUnchecked(NO_ROWS);
      setOutcomes(NO_OUTCOMES);
      if (next === null || host === undefined) return;
      void fetchSiteJarCookiesOnce(host.scopeUrl).then((site) => {
        if (token === jarTokenRef.current) setJar(site ?? []);
      });
    },
    [host],
  );

  const plan = cookies === null || jar === null ? [] : planPastedCookies(cookies, shared, jar);
  const rows = plan.map((row, index) => {
    const outcome = outcomes.get(index);
    const saved = outcome !== undefined && outcome.cookie !== null;
    const constraint = editFormConstraintError(t, row.form);
    const blocked = !isEditFormValid(row.form) || constraint !== null;
    return {
      ...row,
      index,
      saved,
      blocked,
      checked: !saved && !blocked && !unchecked.has(index),
      // A row says ONE thing under itself: why the last write failed, or
      // why it can't be written as it stands.
      reason:
        outcome !== undefined && outcome.cookie === null
          ? [t('panel.inspector.cookies.edit.paste.list.failed'), outcome.error].filter(Boolean).join(' — ')
          : constraint,
    };
  });
  const selectable = rows.filter((row) => !row.saved && !row.blocked);
  const checked = rows.filter((row) => row.checked);

  const save = async (): Promise<boolean> => {
    if (host === undefined || checked.length === 0) return false;
    const results = await host.onSubmit(checked.map((row) => formToEdit(row.form)));
    const next = new Map(outcomes);
    checked.forEach((row, i) => {
      const result = results[i];
      if (result !== undefined) next.set(row.index, result);
    });
    setOutcomes(next);
    return checked.every((_, i) => results[i]?.cookie != null);
  };

  const toggle = (index: number): void => {
    const next = new Set(unchecked);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setUnchecked(next);
  };
  const allChecked = selectable.length > 0 && checked.length === selectable.length;
  const toggleAll = (): void => {
    setUnchecked(allChecked ? new Set(selectable.map((row) => row.index)) : NO_ROWS);
  };

  const labels = {
    new: t('panel.inspector.cookies.edit.paste.list.new'),
    replaces: t('panel.inspector.cookies.edit.paste.list.replaces'),
    saved: t('panel.inspector.cookies.edit.paste.list.saved'),
  };

  const node =
    cookies === null ? null : (
      <div className="dt-cookie-paste-list">
        <label className="dt-cookie-paste-list-head">
          <input
            type="checkbox"
            checked={allChecked}
            disabled={disabled || selectable.length === 0}
            onChange={toggleAll}
          />
          {t('panel.inspector.cookies.edit.paste.list.selected', { selected: checked.length, total: cookies.length })}
        </label>
        <div className="dt-cookie-paste-list-rows dt-scrollbar">
          {rows.map((row) => (
            <div key={row.index} className="dt-cookie-paste-row">
              <label className="dt-cookie-paste-row-main">
                <input
                  type="checkbox"
                  aria-label={row.pasted.name}
                  checked={row.checked}
                  disabled={disabled || row.saved || row.blocked}
                  onChange={() => toggle(row.index)}
                />
                <span className="dt-cookie-paste-row-name" title={row.pasted.name}>
                  {row.pasted.name}
                </span>
                <span className="dt-cookie-paste-row-value" title={row.pasted.value}>
                  {row.pasted.value}
                </span>
                <span
                  className={`dt-cookie-paste-tag${
                    row.saved ? ' dt-cookie-paste-tag--saved' : row.replaces ? ' dt-cookie-paste-tag--replaces' : ''
                  }`}
                >
                  {row.saved ? labels.saved : row.replaces ? labels.replaces : labels.new}
                </span>
              </label>
              {row.reason !== null && <div className="dt-cookie-paste-row-reason">{row.reason}</div>}
            </div>
          ))}
        </div>
        <div className="dt-cookie-edit-note">{t('panel.inspector.cookies.edit.paste.list.sharedNote')}</div>
      </div>
    );

  return { total: cookies === null ? null : cookies.length, savable: checked.length, list, save, node };
}
