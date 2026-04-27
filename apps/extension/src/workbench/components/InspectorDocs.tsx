/**
 * InspectorDocs — persistent documentation panel in the Inspector sidebar.
 *
 * Organized in scrollable sections with anchor IDs.
 * Any component can scroll to a section via useInspectorNav().openDocs('section-id').
 */

import { Button, Card, Tag, Typography, theme } from 'antd';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useInspectorNav } from '../hooks/useInspectorNav';
import { SHORTCUTS, useShortcutLabel } from '../hooks/useWorkspaceShortcuts';

const { Text, Title } = Typography;

// ── Condition/Action type → doc anchor ID mapping ───────────────

const CONDITION_DOC_ID: Record<string, string> = {
  'url-filter': 'doc-url-pattern',
  'url-regex': 'doc-url-regex',
  'request-domains': 'doc-request-domains',
  'exclude-request-domains': 'doc-exclude-domains',
  'initiator-domains': 'doc-initiator-domains',
  'exclude-initiator-domains': 'doc-initiator-domains',
  'request-methods': 'doc-methods',
  'exclude-request-methods': 'doc-methods',
  'resource-types': 'doc-resource-types',
  'exclude-resource-types': 'doc-resource-types',
  'domain-type': 'doc-domain-type',
  'response-header': 'doc-headers',
  'exclude-response-header': 'doc-headers',
};

const ACTION_DOC_ID: Record<string, string> = {
  // Header operations
  override: 'doc-override',
  add: 'doc-append',
  remove: 'doc-remove',
  merge: 'doc-merge',
  // Rule type sections
  block: 'actions-block',
  redirect: 'actions-redirect',
  'query-param': 'actions-query-param',
  inject: 'actions-inject',
  delay: 'actions-delay',
  body: 'actions-body',
  mock: 'actions-mock',
  // Query param operations
  'qp-add': 'doc-qp-add',
  'qp-override': 'doc-qp-override',
  'qp-remove': 'doc-qp-remove',
  'qp-remove-all': 'doc-qp-remove-all',
  // Inject types
  'inject-script': 'doc-inject-script',
  'inject-css': 'doc-inject-css',
  // Body types
  'body-static': 'doc-body-static',
  'body-dynamic': 'doc-body-dynamic',
  'body-graphql': 'doc-body-graphql',
  // Mock types
  'mock-static': 'doc-mock-static',
  'mock-dynamic': 'doc-mock-dynamic',
  // Redirect
  'redirect-url': 'doc-redirect-url',
  'redirect-regex': 'doc-redirect-regex',
};

/** Get the docs anchor ID for a condition type or action operation. */
export function getDocId(type: string, kind: 'condition' | 'action'): string {
  if (kind === 'condition') return CONDITION_DOC_ID[type] ?? 'conditions';
  return ACTION_DOC_ID[type] ?? 'actions';
}

// ── Section registry ─────────────────────────────────────────────
//
// Each `SectionTitle` registers its mounted DOM node with the parent
// `InspectorDocs` via a ref callback. The scroll-to-section effect
// reads from the registry instead of running `querySelector` — so
// the target is proven to exist (React has committed the node)
// before we measure it, and `SectionTitle` doesn't need to know
// anything about scroll mechanics.

type SectionRegister = (id: string, el: HTMLDivElement | null) => void;

const SectionRegistryContext = createContext<SectionRegister | null>(null);

// ── Styled helpers ──────────────────────────────────────────────

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  const register = useContext(SectionRegistryContext);
  // Ref callback fires after React commits the node (set) and before
  // it unmounts (null). Identity-stable per `id` so React doesn't
  // churn the callback on re-renders.
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      register?.(id, el);
    },
    [id, register],
  );
  return (
    <div ref={ref} id={id} style={{ scrollMarginTop: 8 }}>
      <Title level={5} style={{ fontSize: 13, marginTop: 20, marginBottom: 8 }}>
        {children}
      </Title>
    </div>
  );
}

function Example({
  rule,
  before,
  after,
  wontApply,
}: {
  rule: string;
  before?: string[];
  after?: string[];
  /** Lines for "Won't apply" — each line can contain a suggestion prefixed with "→ " */
  wontApply?: string[];
}) {
  const codeStyle: React.CSSProperties = { display: 'block', paddingLeft: 12, opacity: 0.85, whiteSpace: 'pre' };
  return (
    <div
      style={{
        fontSize: 11,
        marginTop: 4,
        marginBottom: 8,
        padding: '8px 10px',
        background: 'var(--ant-color-fill-quaternary)',
        borderRadius: 4,
        lineHeight: 1.8,
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>
        Rule: <code>{rule}</code>
      </div>
      {before && (
        <div>
          <span style={{ color: 'var(--ant-color-text-tertiary)', fontWeight: 600 }}>Before:</span>
          {before.map((line, i) => (
            <code key={i} style={codeStyle}>
              {line}
            </code>
          ))}
        </div>
      )}
      {after && (
        <div style={{ marginTop: 2 }}>
          <span style={{ color: 'var(--ant-color-success)', fontWeight: 600 }}>
            {before ? 'After:' : 'Applies to:'}
          </span>
          {after.map((line, i) => (
            <code key={i} style={codeStyle}>
              {line}
            </code>
          ))}
        </div>
      )}
      {wontApply &&
        wontApply.length > 0 &&
        (() => {
          const negatives = wontApply.filter((l) => !l.startsWith('→'));
          const suggestions = wontApply.filter((l) => l.startsWith('→'));
          return (
            <>
              {negatives.length > 0 && (
                <div style={{ marginTop: 4, borderTop: '1px dashed var(--ant-color-border-secondary)', paddingTop: 4 }}>
                  <span style={{ color: 'var(--ant-color-error)', fontWeight: 600 }}>Won't apply:</span>
                  {negatives.map((line, i) => (
                    <div key={i} style={{ paddingLeft: 12, opacity: 0.7 }}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
              {suggestions.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>Suggestion:</span>
                  {suggestions.map((line, i) => (
                    <div key={i} style={{ paddingLeft: 12, opacity: 0.7 }}>
                      {line.replace(/^→\s*/, '')}
                    </div>
                  ))}
                </div>
              )}
            </>
          );
        })()}
    </div>
  );
}

function DocParagraph({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 4, color: 'var(--ant-color-text-secondary)' }}>
      {children}
    </div>
  );
}

/**
 * Traffic-light row used by the System Status docs — a fixed-width
 * colored tag followed by its description. Keeps each color state on
 * its own line so the docs read like a legend instead of one run-on
 * paragraph.
 */
function StateRow({
  color,
  label,
  children,
}: {
  color: 'success' | 'warning' | 'error';
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        fontSize: 12,
        lineHeight: 1.7,
        marginTop: 4,
      }}
    >
      <Tag color={color} style={{ fontSize: 10, minWidth: 48, textAlign: 'center', margin: 0, marginTop: 2 }}>
        {label}
      </Tag>
      <span style={{ color: 'var(--ant-color-text-secondary)', flex: 1 }}>{children}</span>
    </div>
  );
}

// ── TOC ─────────────────────────────────────────────────────────

const TOC = [
  { id: 'doc-request-tracking', label: 'Request Tracking' },
  { id: 'conditions', label: 'Conditions Reference' },
  { id: 'actions', label: 'Header Actions' },
  { id: 'actions-block', label: 'Block Rules' },
  { id: 'actions-redirect', label: 'Redirect Rules' },
  { id: 'actions-query-param', label: 'Query Param Rules' },
  { id: 'actions-inject', label: 'Inject Rules' },
  { id: 'actions-delay', label: 'Delay Rules' },
  { id: 'actions-body', label: 'API Request Body' },
  { id: 'actions-mock', label: 'API Response Rules' },
  { id: 'templates', label: 'Templates' },
  { id: 'script-workbench', label: 'Script-Based Rules' },
  { id: 'limitations', label: 'Limitations' },
  { id: 'doc-system-status', label: 'System Status' },
  { id: 'doc-multi-tab', label: 'Multi-tab Behavior' },
  { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts' },
];

// ── Component ───────────────────────────────────────────────────

const ShortcutRow: React.FC<{ id: string; label: string; codeBg: string }> = ({ id, label, codeBg }) => {
  const chord = useShortcutLabel(id);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12 }}>{label}</span>
      <code
        style={{
          fontSize: 11,
          padding: '1px 6px',
          background: codeBg,
          borderRadius: 3,
          whiteSpace: 'nowrap',
        }}
      >
        {chord}
      </code>
    </div>
  );
};

const InspectorDocs: React.FC = () => {
  const { token } = theme.useToken();
  const { pendingSection, pendingCounter, clearPending } = useInspectorNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // `SectionTitle` calls this with its DOM node (or null on unmount)
  // via a ref callback. Identity-stable so React doesn't thrash the
  // callback on re-renders.
  const registerSection = useCallback<SectionRegister>((id, el) => {
    if (el) sectionsRef.current.set(id, el);
    else sectionsRef.current.delete(id);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pendingCounter forces re-scroll for repeat requests
  useEffect(() => {
    if (!pendingSection) return;
    const container = scrollRef.current;
    const target = sectionsRef.current.get(pendingSection);
    if (!container || !target) return;

    // ── Scroll-when-layout-is-settled primitive ───────────────────
    //
    // The docs panel lives inside an Allotment split-view. Allotment
    // owns its own ResizeObserver that sizes panes AFTER React's
    // first paint — so a fresh workspace tab opened from the popup
    // or sidepanel hands us a container that's mounted but still
    // being laid out across multiple frames as the viewport, the
    // Allotment split, and the docs pane all settle.
    //
    // Why earlier attempts failed:
    //   • `scrollIntoView({behavior:'smooth'})` starts an animation
    //     that the browser cancels the moment any ancestor reflows
    //     — which Allotment does several times on cold mount.
    //   • "Observe until first non-zero size, then fire one scroll"
    //     still loses the race: we scroll against an intermediate
    //     layout, then Allotment's final sizing pass reflows the
    //     container and the target drifts off-screen again.
    //
    // The primitive that actually works: re-pin the target on every
    // layout change, using instant `scrollTop` writes that can't be
    // interrupted. Once layout stops changing, we're done.
    //
    //   (1) A `ResizeObserver` watches both the container and the
    //       target — whichever reflows triggers a re-pin. RO fires
    //       its initial callback on `observe()` so we always get
    //       at least one attempt even if nothing ever resizes.
    //   (2) Each attempt writes `scrollTop` imperatively to the
    //       target's offset, so any prior scroll is overwritten
    //       rather than animated over.
    //   (3) "Settled" = no resize events for 180ms. A debounced
    //       stability timer restarts on every pin; when it fires,
    //       layout has quiesced and we `clearPending()`. 180ms is
    //       well past Allotment's settling window but still feels
    //       instant to the user.
    //   (4) `clearPending()` only runs from the stability timer,
    //       never in the effect body — if it fired eagerly, the
    //       state flip would trigger an effect re-run whose
    //       cleanup disconnects the observer before it ever pins
    //       the final layout. That was the bug in every prior
    //       iteration.

    let disposed = false;
    let stabilityTimer: ReturnType<typeof setTimeout> | null = null;

    const pin = () => {
      if (disposed) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (containerRect.height === 0 || targetRect.height === 0) return;

      const desired = Math.max(0, container.scrollTop + (targetRect.top - containerRect.top) - 8);
      container.scrollTop = desired;

      if (stabilityTimer) clearTimeout(stabilityTimer);
      stabilityTimer = setTimeout(() => {
        if (disposed) return;
        clearPending();
      }, 180);
    };

    pin();

    const ro = new ResizeObserver(pin);
    ro.observe(container);
    ro.observe(target);

    return () => {
      disposed = true;
      ro.disconnect();
      if (stabilityTimer) clearTimeout(stabilityTimer);
    };
  }, [pendingSection, pendingCounter, clearPending]);

  // TOC clicks reuse the same registry as the external nav. Container
  // is already sized at this point (the user has the panel open + has
  // clicked a button), so a synchronous `scrollTo` with element-
  // relative math is sufficient — no ResizeObserver needed here.
  const scrollTo = useCallback((id: string) => {
    const container = scrollRef.current;
    const target = sectionsRef.current.get(id);
    if (!container || !target) return;
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = container.scrollTop + (targetRect.top - containerRect.top) - 8;
    container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, []);

  return (
    <SectionRegistryContext.Provider value={registerSection}>
      <div ref={scrollRef} style={{ padding: '12px 16px', overflowY: 'auto', height: '100%' }}>
        {/* Table of Contents */}
        <div style={{ marginBottom: 16, padding: '8px 10px', background: token.colorFillQuaternary, borderRadius: 6 }}>
          <Text
            strong
            style={{ fontSize: 11, color: token.colorTextTertiary, textTransform: 'uppercase', letterSpacing: 0.5 }}
          >
            Contents
          </Text>
          {TOC.map((item) => (
            <div key={item.id} style={{ marginTop: 4 }}>
              <Button
                type="link"
                size="small"
                onClick={() => scrollTo(item.id)}
                style={{ fontSize: 12, padding: 0, height: 'auto' }}
              >
                {item.label}
              </Button>
            </div>
          ))}
        </div>

        {/* ── Request Tracking ── */}
        <SectionTitle id="doc-request-tracking">Request Tracking</SectionTitle>
        <DocParagraph>
          The <strong>This Page</strong> tab in the popup shows which rules are active for the current page and what
          requests they matched.
        </DocParagraph>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>How it works</strong>
          <DocParagraph>
            The extension monitors HTTP requests via the <code>webRequest</code> API. When a request URL matches a
            rule's conditions (domains, URL pattern, or URL regex), it is recorded with its resource type. This covers
            both the request and response phases of each connection.
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Matched requests</strong>
          <DocParagraph>
            Each rule row shows a numbered badge indicating how many requests it matched. Click the badge to expand and
            see the full list of matched requests with timestamps, URLs, resource types, and the pattern that matched.
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Resource types</strong>
          <DocParagraph>
            Each matched request shows its Chrome <code>ResourceType</code>. The label maps to the underlying type:
          </DocParagraph>
        </Card>
        {(
          [
            {
              tag: 'Page',
              code: 'main_frame',
              color: 'blue',
              desc: 'Top-level document navigation — the URL shown in the address bar.',
              examples: ['https://openheaders.io/', 'https://openheaders.io/docs/getting-started'],
            },
            {
              tag: 'Frame',
              code: 'sub_frame',
              color: 'cyan',
              desc: 'An iframe or nested frame embedded within the page.',
              examples: [
                '<iframe src="https://ads.openheaders.io/banner">',
                '<iframe src="https://player.vimeo.com/video/123">',
              ],
            },
            {
              tag: 'Fetch/XHR',
              code: 'xmlhttprequest',
              color: 'green',
              desc: 'API calls via fetch() or XMLHttpRequest. Chrome reports both as the same type — there is no way to distinguish them.',
              examples: ['fetch("/api/v1/users")', 'new XMLHttpRequest(); xhr.open("GET", "/api/data")'],
            },
            {
              tag: 'Script',
              code: 'script',
              color: 'orange',
              desc: 'JavaScript files loaded by the page.',
              examples: ['<script src="/js/app.bundle.js">', 'import("/modules/analytics.js")'],
            },
            {
              tag: 'CSS',
              code: 'stylesheet',
              color: 'purple',
              desc: 'Stylesheets loaded by the page.',
              examples: [
                '<link rel="stylesheet" href="/css/main.css">',
                '@import url("https://fonts.googleapis.com/css2?...")',
              ],
            },
            {
              tag: 'Image',
              code: 'image',
              color: 'magenta',
              desc: 'Images loaded by the page or its styles.',
              examples: ['<img src="/logo.png">', 'background-image: url("/hero.webp")'],
            },
            {
              tag: 'Font',
              code: 'font',
              color: 'volcano',
              desc: 'Web fonts loaded via @font-face rules.',
              examples: ['@font-face { src: url("/fonts/Inter.woff2") }', 'fonts.gstatic.com/s/roboto/v30/...woff2'],
            },
            {
              tag: 'Media',
              code: 'media',
              color: 'gold',
              desc: 'Audio or video resources.',
              examples: ['<video src="/trailer.mp4">', '<audio src="/podcast-ep1.mp3">'],
            },
            {
              tag: 'WebSocket',
              code: 'websocket',
              color: 'lime',
              desc: 'WebSocket handshake — the initial HTTP upgrade request. Only the handshake is tracked, not individual messages.',
              examples: ['new WebSocket("wss://ws.openheaders.io/live")', 'new WebSocket("ws://localhost:59510")'],
            },
            {
              tag: 'Ping',
              code: 'ping',
              color: 'geekblue',
              desc: 'Beacon and ping requests typically used for analytics/tracking.',
              examples: ['navigator.sendBeacon("/analytics", data)', '<a ping="/track/click" href="...">'],
            },
            {
              tag: 'Other',
              code: 'other',
              color: 'default',
              desc: "Anything that doesn't fit the above categories.",
              examples: ['<link rel="icon" href="/favicon.ico">', '<link rel="manifest" href="/site.webmanifest">'],
            },
          ] as const
        ).map(({ tag, code, color, desc, examples }) => (
          <Card key={code} size="small" style={{ marginBottom: 6 }} title={tag} extra={<Tag color={color}>{code}</Tag>}>
            <DocParagraph>{desc}</DocParagraph>
            <div
              style={{
                fontSize: 11,
                marginTop: 4,
                padding: '6px 10px',
                background: 'var(--ant-color-fill-quaternary)',
                borderRadius: 4,
                lineHeight: 1.8,
                fontFamily: 'monospace',
              }}
            >
              <span style={{ color: 'var(--ant-color-success)', fontWeight: 600 }}>Examples:</span>
              {examples.map((ex, i) => (
                <code key={i} style={{ display: 'block', paddingLeft: 12, opacity: 0.85, whiteSpace: 'pre' }}>
                  {ex}
                </code>
              ))}
            </div>
          </Card>
        ))}
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Direct vs indirect matches</strong>
          <DocParagraph>
            A <strong>direct</strong> match means the page URL itself matches the rule's conditions. An{' '}
            <strong>indirect</strong> match means a sub-resource loaded by the page (script, stylesheet, XHR, etc.)
            matches. Rules can have both.
          </DocParagraph>
        </Card>

        {/* ── Conditions Reference ── */}
        <SectionTitle id="conditions">Conditions Reference</SectionTitle>
        <DocParagraph>
          All conditions must match for the rule to fire (AND logic). Each condition maps directly to a Chrome
          declarativeNetRequest field.
        </DocParagraph>

        <div id="doc-url-pattern" style={{ scrollMarginTop: 8 }}>
          <Card title="URL Pattern" extra={<Tag color="blue">urlFilter</Tag>}>
            Wildcard pattern on the full URL. Use <code>*</code> to match any characters. Protocol must be specified:{' '}
            <code>*://</code> for any, <code>https://</code> for HTTPS only.
            <Example
              rule="*://api.openheaders.io/*"
              after={['https://api.openheaders.io/v2/users', 'http://api.openheaders.io/health']}
              wontApply={[
                'https://other-site.com/api — different domain, only api.openheaders.io matches',
                'https://cdn.openheaders.io/img.png — cdn is a different subdomain than api',
                '→ Use Request Domains with openheaders.io to match all subdomains at once',
              ]}
            />
          </Card>
        </div>

        <div id="doc-url-regex" style={{ scrollMarginTop: 8 }}>
          <Card title="URL Regex" extra={<Tag color="purple">regexFilter</Tag>}>
            RE2 regular expression on the full URL including protocol. For complex matching. Cannot be combined with URL
            Pattern.
            <Example
              rule="^https://api\.openheaders\.io/v[0-9]+"
              after={['https://api.openheaders.io/v2', 'https://api.openheaders.io/v3']}
              wontApply={[
                'http://api.openheaders.io/v2 — regex specifies https:// only',
                'https://api.openheaders.io/latest — does not match /v[0-9]+',
                '→ Use ^https?:// to match both http and https',
              ]}
            />
          </Card>
        </div>

        <div id="doc-request-domains" style={{ scrollMarginTop: 8 }}>
          <Card title="Request Domains" extra={<Tag color="green">requestDomains</Tag>}>
            Matches the domain and ALL its subdomains automatically.
            <Example
              rule="openheaders.io"
              after={['openheaders.io', 'api.openheaders.io', 'cdn.openheaders.io']}
              wontApply={[
                'not-openheaders.io — different domain, not a subdomain',
                'openheaders.com — different TLD',
                '→ Add each domain separately or use URL Pattern for cross-domain matching',
              ]}
            />
          </Card>
        </div>

        <div id="doc-exclude-domains" style={{ scrollMarginTop: 8 }}>
          <Card title="Exclude Domains" extra={<Tag color="warning">excludedRequestDomains</Tag>}>
            Skip these domains even if other conditions match. Must be combined with Request Domains or other conditions
            — it only excludes, it doesn't match on its own.
            <Example
              rule="Request Domains: openheaders.io + Exclude: staging.openheaders.io"
              after={[
                'api.openheaders.io — matched by Request Domains, not excluded',
                'cdn.openheaders.io — matched, not excluded',
              ]}
              wontApply={[
                'staging.openheaders.io — matched by Request Domains but then excluded',
                '→ Remove the Exclude condition to apply to staging too',
              ]}
            />
          </Card>
        </div>

        <div id="doc-initiator-domains" style={{ scrollMarginTop: 8 }}>
          <Card title="Initiator Domains" extra={<Tag>initiatorDomains</Tag>}>
            Only match requests made FROM pages on this domain.
            <Example
              rule="portal.openheaders.io"
              after={['API call while browsing portal.openheaders.io']}
              wontApply={[
                'Same API call while browsing other-site.com',
                '→ Use Request Domains instead to match by destination, not origin',
              ]}
            />
          </Card>
        </div>

        <div id="doc-methods" style={{ scrollMarginTop: 8 }}>
          <Card title="Methods" extra={<Tag>requestMethods</Tag>}>
            Filter by HTTP method. Select specific methods to ignore others.
            <Example
              rule="GET, POST"
              after={['GET /api/users', 'POST /api/login']}
              wontApply={[
                'PUT /api/users/1 — method not selected',
                'DELETE /api/users/1 — method not selected',
                '→ Add more methods or remove this condition to match all methods',
              ]}
            />
          </Card>
        </div>

        <div id="doc-resource-types" style={{ scrollMarginTop: 8 }}>
          <Card title="Resource Types" extra={<Tag>resourceTypes</Tag>}>
            Filter by what kind of resource is being loaded.
            <Example
              rule="xhr"
              after={["fetch('/api/data')", 'XMLHttpRequest calls']}
              wontApply={[
                'Page navigation (main_frame) — not xhr',
                '<img> loads, <script> loads, CSS loads',
                '→ Add "page" to also match page navigations',
              ]}
            />
          </Card>
        </div>

        <div id="doc-domain-type" style={{ scrollMarginTop: 8 }}>
          <Card title="Domain Type" extra={<Tag>domainType</Tag>}>
            First-party (same site) or third-party (cross-site). Useful for blocking trackers.
            <Example
              rule="thirdParty"
              after={['Requests to analytics.google.com (cross-site)', 'Requests to cdn.external.com (cross-site)']}
              wontApply={[
                'Requests to same domain the user is browsing',
                '→ Use "firstParty" to match same-site requests instead',
              ]}
            />
          </Card>
        </div>

        <div id="doc-headers" style={{ scrollMarginTop: 8 }}>
          <Card title="Request / Response Headers" extra={<Tag color="orange">Chrome 128+</Tag>}>
            Match requests that have a specific header with an exact value.
            <Example
              rule="Authorization = Bearer test-token"
              after={['Request with Authorization: Bearer test-token']}
              wontApply={[
                "Authorization: Bearer other-token — value doesn't match exactly",
                'Request without Authorization header — header must be present',
                'No wildcard or partial matching — Chrome only supports exact header name and exact value',
              ]}
            />
          </Card>
        </div>

        {/* ── Actions ── */}
        <SectionTitle id="actions">Actions</SectionTitle>

        <div id="doc-override" style={{ scrollMarginTop: 8 }}>
          <Card title="Add / Replace" extra={<Tag color="blue">DNR set</Tag>}>
            Sets the header to this value. Replaces if present, adds if missing. Always results in exactly one header
            with your value.
            <Example
              rule="Override X-Auth: Bearer token"
              before={['X-Auth: old-value']}
              after={['X-Auth: Bearer token']}
              wontApply={[
                'Request to non-matching domain — conditions must match first',
                '→ Check your Request Domains or URL Pattern conditions',
              ]}
            />
          </Card>
        </div>

        <div id="doc-append" style={{ scrollMarginTop: 8 }}>
          <Card title="Append" extra={<Tag color="cyan">DNR append</Tag>}>
            Adds a NEW header entry with the same name. Original stays — creates duplicate headers. Use for Set-Cookie,
            Link, Via.
            <Example
              rule="Append Set-Cookie: tracking=xyz"
              before={['Set-Cookie: session=abc']}
              after={['Set-Cookie: session=abc', 'Set-Cookie: tracking=xyz']}
              wontApply={[
                "Headers that don't support duplicates (e.g. Authorization) — browser keeps only one",
                '→ Use Override to replace the value, or Merge to append to the existing value',
              ]}
            />
          </Card>
        </div>

        <div id="doc-remove" style={{ scrollMarginTop: 8 }}>
          <Card title="Remove" extra={<Tag color="red">DNR remove</Tag>}>
            Deletes ALL instances of this header. No value needed.
            <Example
              rule="Remove X-Frame-Options"
              before={['X-Frame-Options: DENY', 'Content-Type: text/html']}
              after={['Content-Type: text/html']}
              wontApply={[
                'Header already absent — nothing happens, no error',
                '→ Use Override if you want to change the value instead of removing entirely',
              ]}
            />
          </Card>
        </div>

        <div id="doc-merge" style={{ scrollMarginTop: 8 }}>
          <Card title="Merge" extra={<Tag color="purple">Script-based</Tag>}>
            Reads the existing value at runtime and appends yours with a separator. Defaults to <code>{'; '}</code> for
            Cookie, <code>{', '}</code> for others.
            <Example
              rule="Merge Cookie + new=val (sep: '; ')"
              before={['Cookie: session=abc']}
              after={['Cookie: session=abc; new=val']}
              wontApply={[
                'Page navigation (typing URL in address bar) — only fetch/XHR',
                'Static resources (<img>, <script>, <link>) — only JS-initiated requests',
                '→ For page-level headers, use Override or Append (DNR-based) instead',
              ]}
            />
            <DocParagraph>Separator can be empty for direct concatenation. Not visible in DevTools.</DocParagraph>
          </Card>
        </div>

        {/* ── Block Rules ── */}
        <SectionTitle id="actions-block">Block Rules</SectionTitle>
        <DocParagraph>
          Blocks matching requests entirely. The browser shows a network error to the page. Uses Chrome's{' '}
          <code>declarativeNetRequest</code> block action.
        </DocParagraph>
        <Card size="small">
          No configuration needed — just add conditions to specify which requests to block. The block applies to all
          matching requests regardless of resource type.
        </Card>

        {/* ── Redirect Rules ── */}
        <SectionTitle id="actions-redirect">Redirect Rules</SectionTitle>
        <DocParagraph>
          Redirects matching requests to a different URL. Supports static URLs and regex capture groups for dynamic
          redirects.
        </DocParagraph>
        <div id="doc-redirect-url" style={{ scrollMarginTop: 8 }}>
          <Card title="Static Redirect" extra={<Tag color="blue">DNR redirect</Tag>}>
            Enter a full URL to redirect all matching requests to the same destination.
            <Example
              rule="https://openheaders.io/new-page"
              after={['All matching requests → https://openheaders.io/new-page']}
            />
          </Card>
        </div>
        <div id="doc-redirect-regex" style={{ scrollMarginTop: 8 }}>
          <Card title="Regex Redirect" extra={<Tag color="purple">regexSubstitution</Tag>}>
            With a URL Regex condition, use <code>\1</code>, <code>\2</code> etc. to reference capture groups from the
            matched URL.
            <Example
              rule="Condition: ^http://(openheaders\.io/.*)$  →  https://\1"
              before={['http://openheaders.io/page']}
              after={['https://openheaders.io/page']}
            />
          </Card>
        </div>

        {/* ── Query Param Rules ── */}
        <SectionTitle id="actions-query-param">Query Param Rules</SectionTitle>
        <DocParagraph>
          Modify URL query parameters. Uses Chrome's <code>queryTransform</code> action.
        </DocParagraph>
        <div id="doc-qp-add" style={{ scrollMarginTop: 8 }}>
          <Card title="Add / Replace" extra={<Tag color="blue">addOrReplaceParams</Tag>}>
            Adds the parameter if missing, or replaces its value if already present.
            <Example rule="debug = true" before={['?page=1']} after={['?page=1&debug=true']} />
          </Card>
        </div>
        <div id="doc-qp-override" style={{ scrollMarginTop: 8 }}>
          <Card title="Replace Only" extra={<Tag color="blue">replaceOnly</Tag>}>
            Replaces the value <strong>only when the parameter is already present</strong>. URLs that don't carry the
            param are left untouched. Use this to canonicalize a value (e.g. force <code>region=eu</code> on URLs
            already carrying any other region) without injecting the param into URLs that didn't have it.
            <Example
              rule="region = eu (override)"
              before={['?region=us', '?page=1']}
              after={['?region=eu', '?page=1']}
            />
          </Card>
        </div>
        <div id="doc-qp-remove" style={{ scrollMarginTop: 8 }}>
          <Card title="Remove" extra={<Tag color="red">removeParams</Tag>}>
            Removes specific parameters by name. Value is ignored.
            <Example rule="Remove utm_source" before={['?utm_source=google&page=1']} after={['?page=1']} />
          </Card>
        </div>
        <div id="doc-qp-remove-all" style={{ scrollMarginTop: 8 }}>
          <Card title="Remove All" extra={<Tag color="red">strip query</Tag>}>
            Strips the entire query string. Cannot be combined with Add / Replace in the same rule.
            <Example
              rule="Remove All"
              before={['?utm_source=google&page=1&debug=true']}
              after={['(no query string)']}
            />
          </Card>
        </div>

        {/* ── Inject Rules ── */}
        <SectionTitle id="actions-inject">Inject Rules</SectionTitle>
        <DocParagraph>
          Inject JavaScript or CSS into matching pages. Code runs in the page's context via a content script.
        </DocParagraph>
        <div id="doc-inject-script" style={{ scrollMarginTop: 8 }}>
          <Card title="Script Injection" extra={<Tag color="orange">JavaScript</Tag>}>
            Inline code or an external URL. Choose insertion timing: <strong>As Soon As Possible</strong> (runs before
            the page's own scripts — useful for monkey-patches that need to win the race) or{' '}
            <strong>After Page Load</strong> (runs once the page has parsed — the safer default for code that reads the
            DOM).
          </Card>
        </div>
        <div id="doc-inject-css" style={{ scrollMarginTop: 8 }}>
          <Card title="CSS Injection" extra={<Tag color="magenta">Stylesheet</Tag>}>
            Inject custom CSS rules. Applied as a <code>&lt;style&gt;</code> tag. Useful for dark mode overrides, hiding
            elements, or custom theming.
          </Card>
        </div>

        {/* ── Delay Rules ── */}
        <SectionTitle id="actions-delay">Delay Rules</SectionTitle>
        <DocParagraph>
          Adds artificial latency to matching requests. Two execution paths run in parallel depending on what kind of
          request is matched.
        </DocParagraph>
        <Card size="small">
          <p style={{ marginTop: 0 }}>
            <strong>Document &amp; iframe navigations</strong> are routed through a local waiting page. Honors delays up
            to <strong>30,000 ms</strong> (the DNR ceiling).
          </p>
          <p>
            <strong>JS-initiated XHR / fetch</strong> is intercepted by a <code>fetch()</code> /{' '}
            <code>XMLHttpRequest</code> monkey-patch. Capped at <strong>5,000 ms</strong> to avoid starving Chrome's
            HTTP connection pool — values above are clamped on the wire.
          </p>
          <p style={{ marginBottom: 0 }}>
            <strong>Sub-resources</strong> (images, scripts, stylesheets, fonts) are <strong>not delayed</strong> — they
            need a real local proxy that can hold the connection open and stream bytes, which an extension can't do.
          </p>
        </Card>

        {/* ── Body Modification ── */}
        <SectionTitle id="actions-body">Body Modification</SectionTitle>
        <DocParagraph>
          Override or transform request bodies. Script-based — intercepts <code>fetch()</code> and{' '}
          <code>XMLHttpRequest</code>.
        </DocParagraph>
        <div id="doc-body-static" style={{ scrollMarginTop: 8 }}>
          <Card title="Static Body" extra={<Tag color="blue">Replace</Tag>}>
            Replace the entire request body with a fixed string. Works for REST and GraphQL requests.
          </Card>
        </div>
        <div id="doc-body-dynamic" style={{ scrollMarginTop: 8 }}>
          <Card title="Dynamic Body" extra={<Tag color="purple">Function</Tag>}>
            Write a function that receives the original request body and context, then returns the modified body.
            Receives <code>{'{method, url, body, bodyAsJson}'}</code>.
          </Card>
        </div>
        <div id="doc-body-graphql" style={{ scrollMarginTop: 8 }}>
          <Card title="GraphQL Filter" extra={<Tag color="purple">Payload</Tag>}>
            When Resource Type is GraphQL, the rule fires only on requests whose JSON payload's configured field matches
            the value. The runtime parses the request body as JSON, reads the field named by <code>key</code>, and tests
            it against <code>value</code> using the chosen operator (<code>Equals</code> for exact match,{' '}
            <code>Contains</code> for substring). Common keys: <code>operationName</code> for the named operation,{' '}
            <code>query</code> for a substring of the query text. Requests without a JSON body, or whose payload field
            is missing or doesn't match, pass through untouched.
          </Card>
        </div>

        {/* ── API Response Rules ── */}
        <SectionTitle id="actions-mock">API Response Rules</SectionTitle>
        <DocParagraph>
          Intercept API calls and return custom responses. Script-based — intercepts <code>fetch()</code> and{' '}
          <code>XMLHttpRequest</code>.
        </DocParagraph>
        <div id="doc-mock-static" style={{ scrollMarginTop: 8 }}>
          <Card title="Static Response" extra={<Tag color="blue">Fixed body</Tag>}>
            Return a fixed body with full control over the synthetic response: status code, Content-Type, and any
            additional response headers (Set-Cookie, CORS headers, custom flags). The real request is never made —
            useful for offline development against a known fixture.
          </Card>
        </div>
        <div id="doc-mock-dynamic" style={{ scrollMarginTop: 8 }}>
          <Card title="Dynamic Response" extra={<Tag color="purple">Function</Tag>}>
            The real request is made first. Your function receives the response and request context, then returns the
            modified response. Receives <code>{'{status, body, bodyAsJson, url, method}'}</code>. The status code,
            Content-Type, and response-header fields you set on the rule still apply on top of your function's return
            value.
          </Card>
        </div>

        {/* ── Templates ── */}
        <SectionTitle id="templates">Templates</SectionTitle>
        <Card>
          Templates prefill the form with common configurations. Select a template from the bar at the top of the
          editor. "Blank" resets the form. You can modify any prefilled values after applying a template.
        </Card>

        {/* ── Script-Based Rules ── */}
        <SectionTitle id="script-rules">Script-Based Rules</SectionTitle>
        <Card title="DNR-based" extra={<Tag color="blue">Fast, declarative</Tag>}>
          Modify Headers (Override/Append/Remove), Block, Redirect, Query Params. Applied at the network level by
          Chrome's engine.
        </Card>
        <Card title="Script-based" extra={<Tag color="purple">Fetch/XHR</Tag>}>
          Inject, Delay, Modify Request Body, Modify API Response, Header Merge. Work by monkey-patching{' '}
          <code>fetch()</code> and <code>XMLHttpRequest</code> in the page's context.
        </Card>

        {/* ── Limitations ── */}
        <SectionTitle id="limitations">Limitations</SectionTitle>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Response headers in DevTools</strong>
          <DocParagraph>
            Actions are not visible in the Network tab but are applied correctly. The browser shows original server
            headers.
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Script-based rules</strong>
          <DocParagraph>
            Only intercept <code>fetch()</code> and <code>XMLHttpRequest</code>. Static resources and page navigations
            are NOT affected.
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Merge operation</strong>
          <DocParagraph>
            Cannot read browser-default headers (Accept, User-Agent). Only reads headers explicitly set by page code.
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Header matching conditions</strong>
          <DocParagraph>Chrome 128+ only. Older browsers ignore these conditions.</DocParagraph>
        </Card>

        {/* ── System Status ── */}
        <SectionTitle id="doc-system-status">System Status</SectionTitle>
        <DocParagraph>
          The <strong>System status</strong> pill (in the workspace footer and the popup/sidepanel header) is a live
          snapshot of the extension's health. Each subsystem reports a single state with the worst level winning — the
          compact dot colors red &gt; yellow &gt; green.
        </DocParagraph>
        <DocParagraph>
          Rows come in two groups, greys first (no events recorded yet in this service-worker lifetime) and coloreds
          after (have reported at least once). The Desktop App row at the bottom is a product note, not a live
          subsystem. Full history lives in the Observability log — export it from{' '}
          <strong>Settings → Data → Export Diagnostic Log</strong>.
        </DocParagraph>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>
            <Tag color="default" style={{ fontSize: 10 }}>
              Sync
            </Tag>{' '}
            Desktop-app connection
          </strong>
          <DocParagraph>Mirrors the WebSocket connection to the OpenHeaders desktop app.</DocParagraph>
          <StateRow color="success" label="green">
            Connected, or disabled on purpose (auto-connect off).
          </StateRow>
          <StateRow color="warning" label="yellow">
            Connecting, reconnecting, or the settings URL was rejected.
          </StateRow>
          <StateRow color="error" label="red">
            Not used today — reserved for fatal desktop-sync failures.
          </StateRow>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>
            <Tag color="default" style={{ fontSize: 10 }}>
              Rules
            </Tag>{' '}
            Declarative-Net-Request engine
          </strong>
          <DocParagraph>Reports on every DNR rebuild.</DocParagraph>
          <StateRow color="success" label="green">
            N active rules, or "Rule execution paused".
          </StateRow>
          <StateRow color="warning" label="yellow">
            Unresolved <code>{'{{VAR}}'}</code> references in the compiled set, rule cap exceeded, or approaching DNR
            capacity.
          </StateRow>
          <StateRow color="error" label="red">
            Transport failure — Chrome rejected the dynamic or session rule update.
          </StateRow>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>
            <Tag color="default" style={{ fontSize: 10 }}>
              Requests
            </Tag>{' '}
            API request executor
          </strong>
          <DocParagraph>Reflects the last ad-hoc API request fired from the Request editor (Send button).</DocParagraph>
          <StateRow color="success" label="green">
            Last request returned a response.
          </StateRow>
          <StateRow color="warning" label="yellow">
            Last request failed before producing a response (network offline, DNS, abort, etc.).
          </StateRow>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>
            <Tag color="default" style={{ fontSize: 10 }}>
              Permissions
            </Tag>{' '}
            Host permissions audit
          </strong>
          <DocParagraph>
            Audits <code>&lt;all_urls&gt;</code> on each service-worker wake.
          </DocParagraph>
          <StateRow color="success" label="green">
            All host permissions granted.
          </StateRow>
          <StateRow color="warning" label="yellow">
            Audit couldn't run (unusual — the browser didn't expose <code>chrome.permissions</code>).
          </StateRow>
          <StateRow color="error" label="red">
            Host permissions were narrowed from <code>chrome://extensions</code>. Rules targeting revoked hosts will
            silently no-op until you restore access.
          </StateRow>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>
            <Tag color="default" style={{ fontSize: 10 }}>
              Secrets
            </Tag>{' '}
            Vault integrity
          </strong>
          <DocParagraph>Tracks the per-workspace vault blob.</DocParagraph>
          <StateRow color="success" label="green">
            "Vault healthy" after a successful decrypt.
          </StateRow>
          <StateRow color="warning" label="yellow">
            Schema drift on hydrate — a stored vault entry didn't match the current shape and was dropped.
          </StateRow>
          <StateRow color="error" label="red">
            A cipher decrypt failed for a named secret — state sticks red until a subsequent successful read. Reinstall
            or restore from backup if it persists.
          </StateRow>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>
            <Tag color="blue" style={{ fontSize: 10 }}>
              Desktop App
            </Tag>{' '}
            Product note — not a subsystem
          </strong>
          <DocParagraph>
            The v5 desktop app is in development and will ship after the v5 extension stabilizes. Workspaces, variables,
            team sync, and workflow recordings that integrate with the desktop app will unlock once it's released. The
            <code>Sync</code> subsystem will flip from "disabled" to "connecting" automatically on first launch of the
            new desktop app — no reinstall required.
          </DocParagraph>
        </Card>

        {/* ── Multi-tab Behavior ── */}
        <SectionTitle id="doc-multi-tab">Multi-tab Behavior</SectionTitle>
        <DocParagraph>
          Open Headers treats "multiple workspace tabs at once" as a normal, first-class state. Clicking a docs link in
          the popup or an (i) button in the sidepanel reuses an existing workspace tab in the same window — no new tab —
          and Chrome only opens a fresh tab when none exists in your current window.
        </DocParagraph>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Navigation reuses existing tabs</strong>
          <DocParagraph>
            Same-window first: if a workspace tab is already open in the window you're clicking from, it activates and
            receives the intent (docs section to scroll to, rule to edit, etc.). Different window: a fresh tab opens in
            your current window rather than pulling focus across Chrome windows — mirroring how Chrome's own DevTools
            works (one panel per window).
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Tab numbering</strong>
          <DocParagraph>
            When you have two or more workspace tabs, each tab's title prefixes its ordinal —{' '}
            <code>#1 Open Headers</code>, <code>#2 Open Headers</code>, <code>#3 Open Headers</code>. When the count
            drops back to one, the surviving tab sheds the prefix and goes back to <code>Open Headers</code>. Ordinals
            are stable within a tab's lifetime: closing <code>#1</code> while <code>#2</code> and <code>#3</code> are
            alive does NOT renumber the survivors — the next tab you open gets <code>#4</code>, and numbering only
            resets to <code>#1</code> after every workspace tab has closed.
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Data changes sync across tabs</strong>
          <DocParagraph>
            Every persisted entity — rules, collections, folders, environments, workspace variables, vault, requests,
            templates — lives in <code>chrome.storage.local</code> as the single source of truth. Saves in tab A
            broadcast through the background and tab B re-hydrates automatically. Workspace switches and environment
            switches propagate the same way, so both tabs move to the same active scope together.
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Layout does NOT live-sync</strong>
          <DocParagraph>
            Pane ratios and tool-window dock state are per-workspace, but changes don't propagate to already-open tabs
            on the same workspace. Dragging a splitter in tab A leaves tab B's layout untouched until you reload it —
            live layout sync would feel jarring ("my pane jumped while I was typing"), matching how multi-window IDEs
            (desktop IDEs) behave. A fresh tab opened AFTER the drag inherits the latest saved layout, so the change
            is visible when you next pick it up.
          </DocParagraph>
        </Card>
        <Card size="small" style={{ marginBottom: 8 }}>
          <strong>Unsaved drafts are tab-local</strong>
          <DocParagraph>
            Unsaved edits in the rule / request / environment editor live inside that tab's memory. If tab A saves the
            same rule tab B is editing, tab A's version wins the storage write — there's no "modified in another tab,
            reload?" prompt yet (tracked for a future release). In practice this only matters when two tabs are actively
            editing the same entity at the same time; browsing and switching workspaces work correctly across tabs
            today.
          </DocParagraph>
        </Card>

        {/* ── Keyboard Shortcuts ── */}
        <SectionTitle id="keyboard-shortcuts">Keyboard Shortcuts</SectionTitle>
        <DocParagraph>
          Press <code>?</code> anytime to jump here. Shortcuts use{' '}
          <strong>{/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ Cmd' : 'Ctrl'}</strong> as the modifier key.
        </DocParagraph>
        {(['panels', 'tabs', 'navigation', 'actions'] as const).map((category) => {
          const items = SHORTCUTS.filter((s) => s.category === category);
          if (items.length === 0) return null;
          return (
            <Card
              key={category}
              size="small"
              style={{ marginBottom: 8 }}
              title={category.charAt(0).toUpperCase() + category.slice(1)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map((s) => (
                  <ShortcutRow key={s.id} id={s.id} label={s.label} codeBg={token.colorFillQuaternary} />
                ))}
              </div>
            </Card>
          );
        })}

        <div style={{ height: 40 }} />
      </div>
    </SectionRegistryContext.Provider>
  );
};

export default InspectorDocs;
