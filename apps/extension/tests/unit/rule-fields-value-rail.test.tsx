// @vitest-environment jsdom
/**
 * Rule-editor action-side value fields carry the in-field edit rail via
 * DetectedValueInput — header values, auth credentials, query-param
 * values, redirect targets. Condition-side inputs and header NAMES stay
 * bare by design, plain / `{{var}}`-bearing values fall through
 * detection, and the destructive ✕ stands down beside the edit icon
 * (same rail contract the grids pin in grid-value-field-rail).
 */

import { AwarenessIdentityProvider } from '@openheaders/ui/shared/awareness';
import { DocsNavProvider } from '@openheaders/ui/shared/docs/use-docs-nav';
import ConditionEditor from '@openheaders/ui/workbench/components/rule/ConditionEditor';
import AuthRuleFields from '@openheaders/ui/workbench/components/rule-fields/AuthRuleFields';
import HeaderRuleFields from '@openheaders/ui/workbench/components/rule-fields/HeaderRuleFields';
import QueryParamRuleFields from '@openheaders/ui/workbench/components/rule-fields/QueryParamRuleFields';
import RedirectRuleFields from '@openheaders/ui/workbench/components/rule-fields/RedirectRuleFields';
// Side-effect import — TemplateInput reads workbench settings via
// useSyncExternalStore.
import '@openheaders/ui/workbench/settings/schema';
import { cleanup, render } from '@testing-library/react';
import { Form } from 'antd';
import type React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolveWorkbenchIdentity } from '@/host/surface-identity-resolvers';

const testIdentity = resolveWorkbenchIdentity();

beforeAll(() => {
  class ResizeObserverStub implements ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  const scope = globalThis as unknown as { ResizeObserver?: typeof ResizeObserver };
  if (typeof scope.ResizeObserver === 'undefined') {
    scope.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => undefined,
  removeListener: () => undefined,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

afterEach(cleanup);

const b64url = (obj: object) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const JWT = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: 'user@openheaders.io' })}.fakesig`;
const BASIC = `Basic ${btoa('dev-user:s3cret-pw')}`;

function renderInForm(children: React.ReactNode, initialValues: Record<string, unknown>) {
  return render(
    <AwarenessIdentityProvider value={testIdentity}>
      <DocsNavProvider>
        <Form initialValues={initialValues}>{children}</Form>
      </DocsNavProvider>
    </AwarenessIdentityProvider>,
  );
}

describe('auth rule credentials — edit rail', () => {
  it('shows the Base64 edit icon on a Basic credential and suppresses its ✕', () => {
    const { getByLabelText, getAllByLabelText } = renderInForm(<AuthRuleFields />, {
      authUsername: 'dev-user',
      authPassword: BASIC,
    });
    expect(getByLabelText('Edit Base64 value')).toBeTruthy();
    // The plain username keeps its ✕; the detected password's rail
    // holds the edit icon, so its destructive ✕ stands down.
    expect(getAllByLabelText('Clear value')).toHaveLength(1);
  });

  it('shows no edit icon on plain or {{var}}-bearing credentials', () => {
    const { container } = renderInForm(<AuthRuleFields />, {
      authUsername: 'dev-user',
      authPassword: '{{vault.STAGING_PW}}',
    });
    expect(container.querySelectorAll('[aria-label^="Edit"]')).toHaveLength(0);
  });
});

describe('header rule actions — edit rail', () => {
  it('shows the JWT edit icon on the value field only — header names stay bare', () => {
    const { getAllByLabelText } = renderInForm(
      <HeaderRuleFields activeTab="request" onTabChange={vi.fn()} reqCount={1} resCount={0} />,
      {
        // A JWT in the NAME field must not sprout an icon — only the
        // value field runs detection.
        requestHeaders: [{ uid: 'h1', operation: 'override', headerName: JWT, value: `Bearer ${JWT}` }],
        responseHeaders: [],
      },
    );
    expect(getAllByLabelText('Edit as JWT')).toHaveLength(1);
  });
});

describe('query-param rule actions — edit rail', () => {
  it('shows the timestamp edit icon on a unix-timestamp param value', () => {
    const { getByLabelText } = renderInForm(<QueryParamRuleFields />, {
      queryParams: [{ uid: 'q1', param: 'expires', value: '1767225600', operation: 'add' }],
    });
    expect(getByLabelText('Edit timestamp')).toBeTruthy();
  });
});

describe('redirect rule target — edit rail', () => {
  it('shows the URL-encoded edit icon on a %-escaped target URL', () => {
    const { getByLabelText } = renderInForm(<RedirectRuleFields />, {
      redirectTo: 'https://openheaders.io/redirected%20path?q=a%20b',
    });
    expect(getByLabelText('Edit URL-encoded value')).toBeTruthy();
  });
});

describe('condition-side inputs — no rail by design', () => {
  it('never shows an edit icon on condition values, even detectable ones', () => {
    const { container } = render(
      <AwarenessIdentityProvider value={testIdentity}>
        <DocsNavProvider>
          <ConditionEditor value={[{ uid: 'c1', type: 'url-filter', values: [JWT] }]} onChange={vi.fn()} />
        </DocsNavProvider>
      </AwarenessIdentityProvider>,
    );
    expect(container.querySelectorAll('[aria-label^="Edit"]')).toHaveLength(0);
  });
});
