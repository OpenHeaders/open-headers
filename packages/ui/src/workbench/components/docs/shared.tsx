/**
 * Shared rendering primitives for Docs panel sections — kept thin
 * so each section file reads as content rather than markup.
 */

import {
  BulbOutlined,
  CheckOutlined,
  CopyOutlined,
  InfoCircleOutlined,
  StopOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import type React from 'react';
import { createContext, useCallback, useContext, useState } from 'react';
import { useInspectorNav } from '../../hooks/useInspectorNav';

export type SectionRegister = (id: string, el: HTMLDivElement | null) => void;
export const SectionRegistryContext = createContext<SectionRegister | null>(null);

/**
 * Heading anchor + section title. Registers its mounted DOM node
 * with the Docs panel registry so deep-link scrolls hit a node
 * that has actually been laid out.
 */
export function Anchor({ id, children }: { id: string; children?: React.ReactNode }) {
  const register = useContext(SectionRegistryContext);
  const ref = useCallback(
    (el: HTMLDivElement | null) => {
      register?.(id, el);
    },
    [id, register],
  );
  return (
    <div ref={ref} id={id} style={{ scrollMarginTop: 8 }}>
      {children}
    </div>
  );
}

export function DocParagraph({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.7, marginBottom: 4, color: 'var(--ant-color-text-secondary)' }}>
      {children}
    </div>
  );
}

export function Example({
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

export function StateRow({
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

/**
 * H3/H4 doc heading — locks typography rhythm so prose sections
 * don't reach for inline `<h3 style={...}>` and drift.
 */
export function DocHeading({ level = 3, children }: { level?: 3 | 4; children: React.ReactNode }) {
  const Element = level === 3 ? 'h3' : 'h4';
  const fontSize = level === 3 ? 13 : 12;
  const marginTop = level === 3 ? 16 : 12;
  return (
    <Element
      style={{
        fontSize,
        fontWeight: 600,
        margin: `${marginTop}px 0 6px`,
        color: 'var(--ant-color-text)',
      }}
    >
      {children}
    </Element>
  );
}

type CalloutKind = 'note' | 'warn' | 'tip' | 'limitation';

const CALLOUT_STYLES: Record<CalloutKind, { color: string; icon: React.ReactNode; label: string }> = {
  note: { color: 'var(--ant-color-info)', icon: <InfoCircleOutlined />, label: 'Note' },
  warn: { color: 'var(--ant-color-warning)', icon: <WarningOutlined />, label: 'Warning' },
  tip: { color: 'var(--ant-color-success)', icon: <BulbOutlined />, label: 'Tip' },
  limitation: { color: 'var(--ant-color-error)', icon: <StopOutlined />, label: 'Limitation' },
};

/**
 * Callout — replaces the "every paragraph in a Card" pattern.
 * Use sparingly; default flow is plain prose with `DocParagraph`.
 */
export function Callout({ kind, title, children }: { kind: CalloutKind; title?: string; children: React.ReactNode }) {
  const style = CALLOUT_STYLES[kind];
  return (
    <div
      style={{
        borderLeft: `3px solid ${style.color}`,
        background: 'var(--ant-color-fill-quaternary)',
        padding: '8px 12px',
        borderRadius: '0 4px 4px 0',
        marginBottom: 8,
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          color: style.color,
          fontWeight: 600,
          marginBottom: 4,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        <span style={{ display: 'inline-flex' }}>{style.icon}</span>
        <span>{title ?? style.label}</span>
      </div>
      <div style={{ color: 'var(--ant-color-text-secondary)' }}>{children}</div>
    </div>
  );
}

/**
 * Inline code block with a copy-on-hover button. Use for multi-line
 * snippets; for single-token inline code, use plain `<code>`.
 */
export function CodeBlock({ children, language }: { children: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    navigator.clipboard?.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [children]);
  return (
    <div style={{ position: 'relative', marginBottom: 8 }}>
      <pre
        data-language={language}
        style={{
          fontSize: 11,
          lineHeight: 1.6,
          padding: '8px 36px 8px 10px',
          background: 'var(--ant-color-fill-quaternary)',
          borderRadius: 4,
          overflow: 'auto',
          margin: 0,
          fontFamily: 'monospace',
        }}
      >
        <code>{children}</code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy code"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: copied ? 'var(--ant-color-success)' : 'var(--ant-color-text-tertiary)',
          fontSize: 12,
          padding: '2px 6px',
        }}
      >
        {copied ? <CheckOutlined /> : <CopyOutlined />}
      </button>
    </div>
  );
}

/**
 * EngineTag — locked vocabulary for execution-engine tagging across
 * every section. The whole docs system uses these tag colors with one
 * fixed meaning each:
 *
 *   blue   → DNR (declarativeNetRequest, native, fast)
 *   purple → script (fetch/XHR monkey-patch, JS-context only)
 *   orange → BrowserTag, version constraint (Chrome 128+, etc.)
 *   neutral → unspecified / non-engine concept
 *
 * Do NOT introduce new Tag colors in section content. New concepts
 * earn their own dedicated component, never a fifth color.
 */
export function EngineTag({ kind }: { kind: 'dnr' | 'script' }) {
  return kind === 'dnr' ? <Tag color="blue">DNR</Tag> : <Tag color="purple">Script-based</Tag>;
}

export function BrowserTag({ min }: { min: string }) {
  // 'chrome-128' → 'Chrome 128+'
  const label = `${min.replace(/^chrome-/i, 'Chrome ')}+`;
  return <Tag color="orange">{label}</Tag>;
}

const ON_THIS_PAGE_THRESHOLD = 5;

/**
 * Mini in-section TOC. Renders nothing below the threshold so authors
 * can't reach for it on short pages. Threshold is a module constant —
 * tuning it tunes every section uniformly.
 */
function OnThisPageLink({ id, title }: { id: string; title: string }) {
  const [hover, setHover] = useState(false);
  return (
    <a
      href={`#${id}`}
      onClick={(ev) => {
        ev.preventDefault();
        document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'auto' });
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'block',
        padding: '3px 8px',
        marginLeft: -8,
        borderRadius: 4,
        color: hover ? 'var(--ant-color-primary)' : 'var(--ant-color-text-secondary)',
        background: hover ? 'var(--ant-color-primary-bg)' : 'transparent',
        textDecoration: 'none',
        transition: 'background 120ms ease, color 120ms ease, transform 120ms ease',
        transform: hover ? 'translateX(2px)' : 'translateX(0)',
      }}
    >
      {title}
    </a>
  );
}

export function OnThisPage({ entries }: { entries: { id: string; title: string }[] }) {
  if (entries.length < ON_THIS_PAGE_THRESHOLD) return null;
  return (
    <div
      style={{
        borderLeft: '2px solid var(--ant-color-border-secondary)',
        paddingLeft: 12,
        marginBottom: 16,
        fontSize: 11,
      }}
    >
      <div
        style={{
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          fontSize: 10,
          color: 'var(--ant-color-text-tertiary)',
          marginBottom: 4,
        }}
      >
        On this page
      </div>
      {entries.map((e) => (
        <OnThisPageLink key={e.id} id={e.id} title={e.title} />
      ))}
    </div>
  );
}

/**
 * SurfaceContext — header banner shown at the top of a doc section
 * that names the four extension surfaces (popup / side-panel /
 * workbench / devtools) and highlights the ones where the section's
 * feature actually appears. Inactive surfaces stay visible but dim,
 * so readers learn the surface taxonomy alongside the section.
 *
 * Each tile is a tiny browser-frame glyph with the relevant region
 * filled in:
 *   • popup     — small floating square hanging from the toolbar
 *   • side-panel — vertical strip on the right edge
 *   • workbench  — full content area (it's a regular tab)
 *   • devtools   — horizontal strip at the bottom
 */
export type DocSurface = 'popup' | 'side-panel' | 'workbench' | 'devtools';

const SURFACE_ORDER: DocSurface[] = ['popup', 'side-panel', 'workbench', 'devtools'];
export const SURFACE_LABELS: Record<DocSurface, string> = {
  popup: 'Popup',
  'side-panel': 'Side panel',
  workbench: 'Workbench',
  devtools: 'DevTools',
};

/**
 * Body of the surface glyph as an SVG `<g>` — usable both as the
 * subject of a standalone glyph (`SurfaceGlyph` wraps this in an
 * `<svg>` for the docs context) and as an inline element inside a
 * larger parent SVG (the settings back-end details).
 */
export function SurfaceGlyphBody({ surface, accent }: { surface: DocSurface; accent: string }) {
  const frameStroke = 'var(--ant-color-border)';
  return (
    <g>
      <title>{SURFACE_LABELS[surface]}</title>
      <rect x={1} y={1} width={40} height={30} rx={3} fill="var(--ant-color-bg-container)" stroke={frameStroke} />
      {/* Tab strip / address bar separator */}
      <line x1={1} y1={7} x2={41} y2={7} stroke={frameStroke} />
      <circle cx={4} cy={4} r={0.8} fill={frameStroke} />
      <circle cx={6.5} cy={4} r={0.8} fill={frameStroke} />
      <circle cx={9} cy={4} r={0.8} fill={frameStroke} />
      {surface === 'popup' && <rect x={28} y={9} width={11} height={9} rx={1} fill={accent} />}
      {surface === 'side-panel' && <rect x={32} y={9} width={8} height={21} rx={1} fill={accent} />}
      {surface === 'workbench' && <rect x={3} y={9} width={36} height={21} rx={1} fill={accent} />}
      {surface === 'devtools' && <rect x={3} y={22} width={36} height={8} rx={1} fill={accent} />}
    </g>
  );
}

export function SurfaceGlyph({ surface, accent }: { surface: DocSurface; accent: string }) {
  return (
    <svg width={42} height={32} viewBox="0 0 42 32" aria-hidden="true">
      <SurfaceGlyphBody surface={surface} accent={accent} />
    </svg>
  );
}

export function SurfaceContext({ surfaces }: { surfaces: DocSurface[] }) {
  const set = new Set(surfaces);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '8px 12px 10px',
        marginBottom: 12,
        background: 'var(--ant-color-fill-quaternary)',
        borderRadius: 6,
        border: '1px solid var(--ant-color-border-secondary)',
      }}
    >
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          color: 'var(--ant-color-text-tertiary)',
          textAlign: 'center',
        }}
      >
        Where you'll see this
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: 8 }}>
        {SURFACE_ORDER.map((s) => {
          const active = set.has(s);
          return (
            <div
              key={s}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                opacity: active ? 1 : 0.35,
                minWidth: 0,
              }}
            >
              <SurfaceGlyph
                surface={s}
                accent={active ? 'var(--ant-color-primary)' : 'var(--ant-color-text-quaternary)'}
              />
              <div
                style={{
                  fontSize: 9,
                  fontWeight: active ? 600 : 400,
                  color: active ? 'var(--ant-color-text)' : 'var(--ant-color-text-tertiary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {SURFACE_LABELS[s]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * In-prose cross-link to another docs section. Use inline inside
 * `DocParagraph` when the text genuinely benefits from "click here to
 * jump to the related section." Resolves through `openDocs` so the
 * panel handles the deep-link the same way it does rule-editor "?"
 * buttons.
 */
export function DocLink({ to, children }: { to: string; children: React.ReactNode }) {
  const { openDocs } = useInspectorNav();
  return (
    <button
      type="button"
      onClick={() => openDocs(to)}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: 'pointer',
        color: 'var(--ant-color-link)',
        font: 'inherit',
        textDecoration: 'underline',
        textUnderlineOffset: 2,
      }}
    >
      {children}
    </button>
  );
}

/** Container for a schematic SVG diagram, with a small caption row. */
export function DiagramFrame({ caption, children }: { caption?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 8,
        marginBottom: 12,
        padding: 12,
        background: 'var(--ant-color-fill-quaternary)',
        borderRadius: 6,
        border: '1px solid var(--ant-color-border-secondary)',
      }}
    >
      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>{children}</div>
      {caption && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            textAlign: 'center',
            color: 'var(--ant-color-text-tertiary)',
            fontStyle: 'italic',
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
