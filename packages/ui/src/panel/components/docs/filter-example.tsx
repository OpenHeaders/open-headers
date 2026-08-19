/**
 * Shared example capture for the Filter Syntax docs — ONE fixed set of
 * five requests that every explainer diagram filters differently, so
 * reading across the cards builds a single coherent picture (the same
 * teaching device as the network column popovers' example request; #7
 * here IS that request). Each diagram is a mock filter input (text +
 * toggle states) over the capture, with a ✓/✗ verdict and a reason per
 * row.
 */

import type React from 'react';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { TOGGLE_GLYPHS } from '../FilterInput';

export interface ExampleRequest {
  id: 'users' | 'login' | 'app' | 'font' | 'pixel';
  num: number;
  method: string;
  status: number;
  url: string;
  meta: string;
}

/** The canonical capture. #7 matches the example request used across
 *  the network column info popovers. */
export const EXAMPLE_REQUESTS: readonly ExampleRequest[] = [
  {
    id: 'users',
    num: 7,
    method: 'GET',
    status: 200,
    url: 'https://api.openheaders.com/v1/users?page=2',
    meta: 'fetch · application/json · 1.2 kB',
  },
  {
    id: 'login',
    num: 8,
    method: 'POST',
    status: 201,
    url: 'https://api.openheaders.com/v1/login',
    meta: 'xhr · application/json · 0.4 kB',
  },
  {
    id: 'app',
    num: 12,
    method: 'GET',
    status: 200,
    url: 'https://cdn.openheaders.com/assets/app.js',
    meta: 'script · text/javascript · 128 kB · x-cache: HIT',
  },
  {
    id: 'font',
    num: 15,
    method: 'GET',
    status: 404,
    url: 'https://static.openheaders.com/fonts/inter.woff2',
    meta: 'font · 2.1 kB',
  },
  {
    id: 'pixel',
    num: 21,
    method: 'GET',
    status: 200,
    url: 'https://analytics.tracker-example.net/collect.gif',
    meta: 'img · image/gif · 0.1 kB · (from cache)',
  },
];

export interface Verdict {
  id: ExampleRequest['id'];
  pass: boolean;
  /** Shown under a failing row — why the filter rejected it. */
  reason?: string;
}

interface FilterExampleProps {
  /** The text shown inside the mock filter input. */
  filter: string;
  /** Which of the three standard toggles render as active. */
  toggles?: { matchCase?: boolean; wholeWord?: boolean; regexMode?: boolean };
  verdicts: readonly Verdict[];
}

function ToggleChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0 5px',
        height: 16,
        borderRadius: 3,
        fontFamily: 'monospace',
        fontSize: 10,
        border: `1px solid ${active ? 'var(--ant-color-primary)' : 'transparent'}`,
        color: active ? 'var(--ant-color-primary)' : 'var(--ant-color-text-quaternary)',
        background: active ? 'var(--ant-color-primary-bg)' : 'transparent',
      }}
    >
      {label}
    </span>
  );
}

export const FilterExample: React.FC<FilterExampleProps> = ({ filter, toggles, verdicts }) => {
  const t = useT();
  const byId = new Map(verdicts.map((v) => [v.id, v]));
  return (
    <div style={{ width: '100%', fontSize: 11 }}>
      {/* Mock filter input with the standard toggles */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          border: '1px solid var(--ant-color-border)',
          borderRadius: 4,
          background: 'var(--ant-color-bg-container)',
          marginBottom: 10,
        }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--ant-color-text)', flex: 1, minWidth: 0 }}>
          {filter}
        </span>
        <ToggleChip label={TOGGLE_GLYPHS.matchCase} active={toggles?.matchCase === true} />
        <ToggleChip label={TOGGLE_GLYPHS.wholeWord} active={toggles?.wholeWord === true} />
        <ToggleChip label={TOGGLE_GLYPHS.regexMode} active={toggles?.regexMode === true} />
      </div>

      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          color: 'var(--ant-color-text-tertiary)',
          marginBottom: 4,
        }}
      >
        {t('panel.docs.filterExample.captureHeading')}
      </div>
      {EXAMPLE_REQUESTS.map((r) => {
        const verdict = byId.get(r.id);
        const pass = verdict?.pass === true;
        return (
          <div key={r.id} style={{ display: 'flex', gap: 6, padding: '3px 0', opacity: pass ? 1 : 0.55 }}>
            <span
              style={{
                width: 12,
                flex: '0 0 auto',
                fontWeight: 700,
                color: pass ? 'var(--ant-color-success)' : 'var(--ant-color-error)',
              }}
            >
              {pass ? '✓' : '✗'}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: 'var(--ant-color-text-tertiary)' }}>#{r.num}</span>{' '}
                <span style={{ fontWeight: 700 }}>{r.method}</span>{' '}
                <span style={{ color: r.status >= 400 ? 'var(--ant-color-error)' : 'var(--ant-color-success)' }}>
                  {r.status}
                </span>{' '}
                <span style={{ color: 'var(--ant-color-text)' }}>{r.url}</span>
              </div>
              <div style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 10 }}>
                {r.meta}
                {!pass && verdict?.reason && (
                  <span style={{ fontStyle: 'italic' }}> — {verdict.reason}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
