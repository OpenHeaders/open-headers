// @vitest-environment jsdom
/**
 * Request editor tab badge counts. The Headers / Params badges count the
 * rows the user owns — their own enabled rows PLUS any auth-derived row
 * (the locked `Authorization` header / URL credential shown at the top of
 * the table). Browser-managed auto-headers are deliberately NOT counted:
 * they live behind the "N hidden" toggle. Regression guard for the badge
 * silently undercounting an auth contribution (tab said 6, inner section
 * said 7).
 */

import type { AuthConfig } from '@openheaders/core/types';
import { emptyDraft } from '@openheaders/ui/workbench/components/request-editor/draft';
import type { KeyValueRow } from '@openheaders/ui/workbench/components/request-editor/KeyValueTable';
import {
  buildRequestTabItems,
  type TabKey,
} from '@openheaders/ui/workbench/components/request-editor/request-tab-items';
import type { SectionUnresolved } from '@openheaders/ui/workbench/components/request-editor/useSectionUnresolved';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  cleanup();
});

const NONE: SectionUnresolved = { url: false, params: false, headers: false, auth: false, body: false };

function kvRow(key: string, value: string, enabled = true): KeyValueRow {
  return { uid: `uid-${key}`, key, value, description: '', enabled };
}

/** Render a tab's label and return the trimmed visible text (e.g.
 *  "Headers 3"). Lets us read the badge number without reaching into the
 *  JSX structure. */
function labelText(tab: TabKey, draft = emptyDraft()): string {
  const items = buildRequestTabItems(draft, NONE);
  const item = items.find((i) => i.key === tab);
  const { container } = render(<div>{item?.label}</div>);
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('request editor tab badge counts', () => {
  it('shows no Headers badge for an empty request (browser autos are not counted)', () => {
    expect(labelText('headers')).toBe('Headers');
  });

  it('counts the auth-derived Authorization header in the Headers badge', () => {
    const draft = { ...emptyDraft(), auth: { type: 'basic', username: 'u', password: 'p' } as AuthConfig };
    expect(labelText('headers', draft)).toBe('Headers 1');
  });

  it('adds user headers to the auth-derived count', () => {
    const draft = {
      ...emptyDraft(),
      auth: { type: 'bearer', token: 't' } as AuthConfig,
      headers: [kvRow('X-A', '1'), kvRow('X-B', '2'), kvRow('X-Off', '3', false)],
    };
    // 1 auth + 2 enabled user headers (the disabled one is excluded).
    expect(labelText('headers', draft)).toBe('Headers 3');
  });

  it('counts an api-key-in-query credential in the Params badge', () => {
    const draft = {
      ...emptyDraft(),
      auth: { type: 'api-key', key: 'api_key', value: 's', in: 'query' } as AuthConfig,
    };
    expect(labelText('params', draft)).toBe('Params 1');
  });

  it('does not count an api-key-in-header credential in the Params badge', () => {
    const draft = {
      ...emptyDraft(),
      auth: { type: 'api-key', key: 'X-Api-Key', value: 's', in: 'header' } as AuthConfig,
    };
    expect(labelText('params')).toBe('Params');
    expect(labelText('headers', draft)).toBe('Headers 1');
  });
});
