/**
 * The Add cookie form's paste row — a `Set-Cookie` or `Cookie` header
 * pasted here fills the fields below it.
 *
 * Reading is a transform, never a write: nothing reaches the jar until
 * Save, so the fill happens on the paste itself (or Enter on typed
 * text) with no confirm step — the line under the field says what was
 * read and offers Undo back to the form as it stood. That line lives
 * only while the form still equals what the paste produced; the first
 * edit after it accepts the fill.
 *
 * Text holding SEVERAL cookies fills nothing: where the host takes a
 * batch (`onList`) it becomes the form's checklist, otherwise the field
 * says to paste one at a time.
 */

import { useT } from '@openheaders/ui/context/LocaleContext';
import { Button, Input } from 'antd';
import { useState } from 'react';
import { type CookieEditFormValues, editFormsEqual } from '../../../data/cookies/cookie-edit';
import {
  applyPastedCookie,
  isEditFormExpired,
  type PastedCookie,
  readCookiePaste,
} from '../../../data/cookies/cookie-paste';

type PasteOutcome =
  | {
      kind: 'filled';
      before: CookieEditFormValues;
      after: CookieEditFormValues;
      fromSetCookie: boolean;
      ignored: readonly string[];
      expired: boolean;
    }
  | { kind: 'several'; count: number }
  | { kind: 'unreadable' };

interface CookiePasteFieldProps {
  values: CookieEditFormValues;
  onFill: (next: CookieEditFormValues) => void;
  disabled: boolean;
  /** How many cookies the form's checklist currently holds, `null` when
   *  the form is a single cookie. */
  listed: number | null;
  /** Enter the checklist with these cookies, or leave it with `null`.
   *  Absent on a host that takes no batch. */
  onList?: (cookies: readonly PastedCookie[] | null) => void;
}

export function CookiePasteField({ values, onFill, disabled, listed, onList }: CookiePasteFieldProps) {
  const t = useT();
  const [text, setText] = useState('');
  const [outcome, setOutcome] = useState<PasteOutcome | null>(null);

  const read = (raw: string): void => {
    if (raw.trim() === '') return;
    const now = Date.now();
    const cookies = readCookiePaste(raw, now);
    if (cookies.length > 1 && onList !== undefined) {
      setText('');
      setOutcome(null);
      onList(cookies);
      return;
    }
    if (cookies.length !== 1) {
      setText(raw);
      setOutcome(cookies.length === 0 ? { kind: 'unreadable' } : { kind: 'several', count: cookies.length });
      return;
    }
    const pasted = cookies[0];
    const after = applyPastedCookie(values, pasted);
    onList?.(null);
    setText('');
    setOutcome({
      kind: 'filled',
      before: values,
      after,
      fromSetCookie: pasted.stated !== undefined,
      ignored: pasted.ignored,
      expired: isEditFormExpired(after, now),
    });
    onFill(after);
  };

  const filled = outcome?.kind === 'filled' && editFormsEqual(values, outcome.after) ? outcome : null;
  const failure =
    outcome?.kind === 'several'
      ? t('panel.inspector.cookies.edit.paste.several', { count: outcome.count })
      : outcome?.kind === 'unreadable'
        ? t('panel.inspector.cookies.edit.paste.unreadable')
        : null;
  const placeholder = t('panel.inspector.cookies.edit.paste.placeholder');

  return (
    <div className="dt-cookie-paste">
      <Input
        size="small"
        value={text}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={disabled}
        allowClear
        status={failure !== null ? 'error' : undefined}
        onChange={(e) => {
          setText(e.target.value);
          setOutcome(null);
        }}
        onPaste={(e) => {
          e.preventDefault();
          read(e.clipboardData.getData('text'));
        }}
        onPressEnter={() => read(text)}
      />
      {failure !== null && <div className="dt-cookie-paste-status dt-cookie-paste-status--error">{failure}</div>}
      {listed !== null && (
        <div className="dt-cookie-paste-status">
          <span>{t('panel.inspector.cookies.edit.paste.listed', { count: listed })}</span>
          <Button type="link" size="small" disabled={disabled} onClick={() => onList?.(null)}>
            {t('panel.inspector.cookies.edit.paste.undo')}
          </Button>
        </div>
      )}
      {filled !== null && (
        <div className="dt-cookie-paste-status">
          <span>
            {[
              filled.fromSetCookie
                ? t('panel.inspector.cookies.edit.paste.filledSetCookie')
                : t('panel.inspector.cookies.edit.paste.filledPair'),
              filled.ignored.length > 0
                ? t('panel.inspector.cookies.edit.paste.ignored', { list: filled.ignored.join(', ') })
                : '',
              filled.expired ? t('panel.inspector.cookies.edit.paste.expired') : '',
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <Button
            type="link"
            size="small"
            disabled={disabled}
            onClick={() => {
              onFill(filled.before);
              setOutcome(null);
            }}
          >
            {t('panel.inspector.cookies.edit.paste.undo')}
          </Button>
        </div>
      )}
    </div>
  );
}
