/**
 * DocsPanel — right-pane documentation panel.
 *
 * Shape (no overlay drawers — TOC and Reading share one space):
 *   • Top bar: menu-icon + breadcrumb (Group › Section).
 *   • Menu icon toggles between TOC and Reading views inside the
 *     same panel space; selecting a section in TOC switches back.
 *   • Reading view shows one section at a time with a minimalist
 *     footer pager (← Previous · Next →).
 *   • Sticky bottom bar shows view-specific keyboard hints, like
 *     the command palette footer.
 *
 * Keyboard:
 *   • Reading view  — ArrowLeft / ArrowRight pager,
 *                     Esc opens the TOC.
 *   • TOC view      — ArrowUp / ArrowDown move focus, Enter opens
 *                     the focused section, Esc returns to reading.
 *
 * Deep links (`openDocs('url-pattern')` from rule editor "?"
 * buttons) resolve via `resolveDocLink`: switch to the owning section
 * and, if the deep-link is a sub-anchor inside that section, scroll
 * to the anchor element after layout settles.
 */

import { ArrowLeftOutlined, ArrowRightOutlined, MenuOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';
import { Button, Empty, Input, Typography, theme } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPanelHeaderWiring, PanelHeader } from '@/shared/dock-layout';
import { useInspectorNav } from '../../hooks/useInspectorNav';
import { resolveDocLink } from '../docs/doc-ids';
import { DEFAULT_SECTION_ID, DOC_GROUPS, type DocSection, findSection } from '../docs/registry';
import { type SectionRegister, SectionRegistryContext } from '../docs/shared';

const { Text } = Typography;

interface DocsPanelProps {
  onClose: () => void;
}

const FLAT_SECTIONS = DOC_GROUPS.flatMap((g) => g.sections);

const DocsPanel: React.FC<DocsPanelProps> = ({ onClose }) => {
  const wiring = useMemo(() => createPanelHeaderWiring({ onHide: onClose }), [onClose]);
  const { token } = theme.useToken();
  const { pendingSection, pendingCounter, clearPending, reportCurrentSection } = useInspectorNav();

  const [activeId, setActiveId] = useState<string>(DEFAULT_SECTION_ID);

  // Publish the current section to the inspector-nav context so
  // outside shortcut handlers can decide whether to navigate or
  // toggle. Clear on unmount so a stale id doesn't survive panel
  // close.
  useEffect(() => {
    reportCurrentSection(activeId);
    return () => reportCurrentSection(null);
  }, [activeId, reportCurrentSection]);
  const [pendingAnchor, setPendingAnchor] = useState<string | null>(null);
  const [view, setView] = useState<'reading' | 'toc'>('reading');
  const [filterText, setFilterText] = useState('');
  const [focusedTocId, setFocusedTocId] = useState<string>(DEFAULT_SECTION_ID);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tocScrollRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<InputRef>(null);
  const anchorsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerAnchor = useCallback<SectionRegister>((id, el) => {
    if (el) anchorsRef.current.set(id, el);
    else anchorsRef.current.delete(id);
  }, []);

  // Resolve deep-link → switch to owning section + remember anchor.
  // Also pulls keyboard focus into the panel so the reader can
  // immediately use Alt-arrow / Esc / scroll keys without clicking.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pendingCounter forces re-handling for repeat openDocs() calls
  useEffect(() => {
    if (!pendingSection) return;
    const { section, anchor } = resolveDocLink(pendingSection);
    if (findSection(section)) {
      setActiveId(section);
      setPendingAnchor(anchor);
      setView('reading');
    }
    clearPending();
    requestAnimationFrame(() => panelRef.current?.focus());
  }, [pendingSection, pendingCounter, clearPending]);

  // Section change in reading view: reset scroll OR pin to a pending
  // sub-anchor once the section's children have committed.
  useEffect(() => {
    if (view !== 'reading') return;
    const container = scrollRef.current;
    if (!container) return;
    if (pendingAnchor) {
      let disposed = false;
      let stabilityTimer: ReturnType<typeof setTimeout> | null = null;
      const pin = () => {
        if (disposed) return;
        const target = anchorsRef.current.get(pendingAnchor);
        if (!target) return;
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        if (containerRect.height === 0 || targetRect.height === 0) return;
        const desired = Math.max(0, container.scrollTop + (targetRect.top - containerRect.top) - 8);
        container.scrollTop = desired;
        if (stabilityTimer) clearTimeout(stabilityTimer);
        stabilityTimer = setTimeout(() => {
          if (disposed) return;
          setPendingAnchor(null);
        }, 180);
      };
      pin();
      const ro = new ResizeObserver(pin);
      ro.observe(container);
      return () => {
        disposed = true;
        ro.disconnect();
        if (stabilityTimer) clearTimeout(stabilityTimer);
      };
    } else {
      container.scrollTop = 0;
    }
  }, [activeId, pendingAnchor, view]);

  const activeIndex = FLAT_SECTIONS.findIndex((s) => s.id === activeId);
  const activeSection = FLAT_SECTIONS[activeIndex] ?? FLAT_SECTIONS[0];
  const Component = activeSection.Component;
  const activeGroup = DOC_GROUPS.find((g) => g.id === activeSection.group);
  const prevSection = activeIndex > 0 ? FLAT_SECTIONS[activeIndex - 1] : null;
  const nextSection = activeIndex < FLAT_SECTIONS.length - 1 ? FLAT_SECTIONS[activeIndex + 1] : null;

  const navigateTo = useCallback((id: string) => {
    if (!findSection(id)) return;
    setActiveId(id);
    setPendingAnchor(null);
    setView('reading');
    // Keep keyboard focus inside the panel so the Reading view's
    // Esc / Alt-arrow shortcuts keep working without a click.
    requestAnimationFrame(() => panelRef.current?.focus());
  }, []);

  const openToc = useCallback(() => {
    setFocusedTocId(activeId);
    setFilterText('');
    setView('toc');
  }, [activeId]);

  // Filter: match group label, section title, or section summary
  // (case-insensitive substring). No body-text indexing — at this size
  // the title + summary surface area is enough to find anything.
  const lower = filterText.toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!lower) return DOC_GROUPS;
    return DOC_GROUPS.map((g) => {
      const groupMatch = g.label.toLowerCase().includes(lower);
      const filteredSections = groupMatch
        ? g.sections
        : g.sections.filter(
            (s) => s.title.toLowerCase().includes(lower) || s.summary.toLowerCase().includes(lower),
          );
      return filteredSections.length > 0 ? { ...g, sections: filteredSections } : null;
    }).filter((g): g is (typeof DOC_GROUPS)[number] => g !== null);
  }, [lower]);

  const flatVisibleSections: DocSection[] = useMemo(() => visibleGroups.flatMap((g) => g.sections), [visibleGroups]);

  // Keep the focused TOC row inside the visible list as the filter
  // narrows. If the previously-focused row dropped out, fall back
  // to the first visible row.
  useEffect(() => {
    if (view !== 'toc') return;
    if (flatVisibleSections.length === 0) return;
    const stillVisible = flatVisibleSections.some((s) => s.id === focusedTocId);
    if (!stillVisible) setFocusedTocId(flatVisibleSections[0].id);
  }, [view, flatVisibleSections, focusedTocId]);

  // Scroll the focused TOC row into view as the user keys through.
  useEffect(() => {
    if (view !== 'toc') return;
    const container = tocScrollRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-toc-id="${focusedTocId}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [view, focusedTocId]);

  // Panel-scoped keyboard:
  //   • Reading: Left / Right pager, Esc opens TOC.
  //   • TOC:     Up/Down move focus, Enter opens, Esc returns.
  //   • Filter input swallows arrow keys for text editing UNTIL
  //     ArrowDown moves focus from the input into the list.
  useEffect(() => {
    const root = panelRef.current;
    if (!root) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;

      if (view === 'reading') {
        if (
          !e.altKey &&
          !e.metaKey &&
          !e.ctrlKey &&
          // Shift is excluded for the same reason it's excluded from
          // the scroll keys below: Shift+ArrowLeft / Shift+ArrowRight
          // extend a native text selection by one character. Stealing
          // those would silently break selecting a few words of prose.
          !e.shiftKey &&
          (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
        ) {
          if (isInput) return;
          const idx = FLAT_SECTIONS.findIndex((s) => s.id === activeId);
          const nextId = e.key === 'ArrowLeft' ? FLAT_SECTIONS[idx - 1]?.id : FLAT_SECTIONS[idx + 1]?.id;
          if (nextId) {
            e.preventDefault();
            navigateTo(nextId);
          }
          return;
        }
        if (e.key === 'Escape' && !isInput) {
          e.preventDefault();
          openToc();
          return;
        }
        // Reading-view scroll keys — the panel root has tabIndex=-1
        // so the browser doesn't scroll it natively on arrow keys;
        // forward to the reading scroll container manually. Steps
        // scale with viewport (~30% per arrow press) so the feel is
        // consistent across narrow + wide docs panels, and we use
        // `behavior: 'auto'` so rapid presses accumulate cleanly
        // instead of queueing sluggish smooth animations.
        // Shift is deliberately excluded: Shift+Arrow / Shift+PageUp /
        // Shift+Home extend a native text selection. Stealing those
        // would silently break "click some prose, then Shift+Down to
        // grab a few more lines" — a normal docs-reading reflex.
        if (!isInput && !e.altKey && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          const container = scrollRef.current;
          if (!container) return;
          const arrowStep = Math.max(160, Math.round(container.clientHeight * 0.3));
          const pageStep = container.clientHeight - 24;
          let delta = 0;
          let absolute: number | null = null;
          if (e.key === 'ArrowDown') delta = arrowStep;
          else if (e.key === 'ArrowUp') delta = -arrowStep;
          else if (e.key === 'PageDown' || e.key === ' ') delta = pageStep;
          else if (e.key === 'PageUp') delta = -pageStep;
          else if (e.key === 'Home') absolute = 0;
          else if (e.key === 'End') absolute = container.scrollHeight;
          if (delta !== 0) {
            e.preventDefault();
            container.scrollBy({ top: delta, behavior: 'auto' });
          } else if (absolute !== null) {
            e.preventDefault();
            container.scrollTo({ top: absolute, behavior: 'smooth' });
          }
        }
        return;
      }

      // TOC view
      if (e.key === 'Escape') {
        e.preventDefault();
        setView('reading');
        requestAnimationFrame(() => panelRef.current?.focus());
        return;
      }
      if (e.key === 'Enter') {
        if (flatVisibleSections.length === 0) return;
        e.preventDefault();
        const target = flatVisibleSections.find((s) => s.id === focusedTocId) ?? flatVisibleSections[0];
        navigateTo(target.id);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (flatVisibleSections.length === 0) return;
        // ArrowDown from the filter input drops focus into the list;
        // subsequent arrow keys cycle through it.
        e.preventDefault();
        const idx = flatVisibleSections.findIndex((s) => s.id === focusedTocId);
        const safeIdx = idx === -1 ? 0 : idx;
        const nextIdx =
          e.key === 'ArrowDown' ? Math.min(flatVisibleSections.length - 1, safeIdx + 1) : Math.max(0, safeIdx - 1);
        setFocusedTocId(flatVisibleSections[nextIdx].id);
      }
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [view, activeId, navigateTo, openToc, flatVisibleSections, focusedTocId]);

  // Auto-focus the filter input each time the TOC opens.
  useEffect(() => {
    if (view === 'toc') {
      // Defer one frame so the input is mounted.
      requestAnimationFrame(() => filterInputRef.current?.focus());
    }
  }, [view]);

  return (
    <div
      ref={panelRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard pager listens on root via tabIndex
      tabIndex={-1}
      className="rules-right-panel rules-right-panel--docs"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', outline: 'none' }}
    >
      <PanelHeader wiring={wiring} title={<strong>Docs</strong>} />

      {/* Top bar: menu-icon + breadcrumb */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          flexShrink: 0,
          minHeight: 36,
        }}
      >
        <Button
          type={view === 'toc' ? 'primary' : 'text'}
          size="small"
          icon={<MenuOutlined />}
          onClick={() => (view === 'toc' ? setView('reading') : openToc())}
          aria-label={view === 'toc' ? 'Close table of contents' : 'Open table of contents'}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            minWidth: 0,
            flex: 1,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {view === 'toc' ? (
            <Text strong style={{ fontSize: 12 }}>
              Contents
            </Text>
          ) : (
            <>
              {activeGroup && (
                <>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {activeGroup.label}
                  </Text>
                  <RightOutlined style={{ fontSize: 9, color: token.colorTextTertiary }} />
                </>
              )}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: token.colorText }}>
                <span style={{ display: 'inline-flex', color: token.colorTextSecondary, fontSize: 12 }}>
                  {activeSection.icon}
                </span>
                <Text strong style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeSection.title}
                </Text>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Body — switches between TOC and Reading; same physical space. */}
      {view === 'toc' ? (
        <div ref={tocScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
          <Input
            ref={filterInputRef}
            size="small"
            placeholder="Filter sections"
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary, fontSize: 11 }} />}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            allowClear
            style={{ marginBottom: 10 }}
          />
          {visibleGroups.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No matches" style={{ marginTop: 24 }} />
          ) : (
            visibleGroups.map((g) => (
              <div key={g.id} style={{ marginBottom: 12 }}>
                <Text
                  type="secondary"
                  style={{
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: 0.6,
                    paddingLeft: 4,
                  }}
                >
                  {g.label}
                </Text>
                <ol
                  start={1}
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: '2px 0 0 16px',
                    counterReset: 'doc-section',
                  }}
                >
                  {g.sections.map((s, idx) => {
                    const isActive = s.id === activeId;
                    const isFocused = s.id === focusedTocId;
                    const bg = isFocused ? token.colorPrimaryBg : isActive ? token.colorFillSecondary : 'transparent';
                    const fg = isFocused ? token.colorPrimary : isActive ? token.colorPrimary : token.colorText;
                    return (
                      <li key={s.id} style={{ margin: 0 }}>
                        <button
                          type="button"
                          data-toc-id={s.id}
                          onClick={() => navigateTo(s.id)}
                          onMouseEnter={() => setFocusedTocId(s.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 8,
                            width: '100%',
                            textAlign: 'left',
                            padding: '4px 8px',
                            marginTop: 1,
                            fontSize: 12,
                            background: bg,
                            color: fg,
                            fontWeight: isActive || isFocused ? 600 : 400,
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'background-color 0.12s ease',
                          }}
                        >
                          <span
                            style={{
                              minWidth: 18,
                              fontVariantNumeric: 'tabular-nums',
                              color:
                                isActive || isFocused ? token.colorPrimary : token.colorTextTertiary,
                              fontSize: 11,
                              flexShrink: 0,
                              textAlign: 'right',
                            }}
                          >
                            {idx + 1}.
                          </span>
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.title}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))
          )}
        </div>
      ) : (
        <SectionRegistryContext.Provider value={registerAnchor}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {/* No in-page heading — the breadcrumb already shows the
             *  section title; rendering an <h1> here would duplicate
             *  it visually. */}
            <Component />
            <div style={{ height: 16 }} />
          </div>
        </SectionRegistryContext.Provider>
      )}

      {/* Sticky footer — pager on the sides, keyboard hints in the
       *  middle. In reading view the pager replaces the prev/next
       *  chord hints (the buttons themselves carry the chord
       *  indicator), leaving only `esc` as the contextual shortcut. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 12px',
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgContainer,
          color: token.colorTextTertiary,
          fontSize: 10,
          flexShrink: 0,
          minHeight: 32,
        }}
      >
        {view === 'toc' ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, margin: '0 auto' }}>
            <FooterHint chord="↑↓" label="navigate" />
            <FooterHint chord="↵" label="open" />
            <FooterHint chord="esc" label="back" />
          </div>
        ) : (
          <>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              {prevSection ? (
                <PagerLink
                  direction="prev"
                  title={prevSection.title}
                  onClick={() => navigateTo(prevSection.id)}
                />
              ) : (
                <span />
              )}
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              <FooterHint chord="esc" label="contents" />
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              {nextSection ? (
                <PagerLink
                  direction="next"
                  title={nextSection.title}
                  onClick={() => navigateTo(nextSection.id)}
                />
              ) : (
                <span />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const FooterHint: React.FC<{ chord: string; label: string }> = ({ chord, label }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
    <code
      style={{
        fontSize: 10,
        padding: '0 4px',
        borderRadius: 3,
        background: 'var(--ant-color-fill-quaternary)',
        color: 'var(--ant-color-text-secondary)',
      }}
    >
      {chord}
    </code>
    <span>{label}</span>
  </span>
);

/**
 * Onboarding-tour pager button — uses the IDENTICAL structure the
 * tour passes via `prev/nextButtonProps.children`: an inline-flex
 * span with `gap: 4`, a `.kbd-key` arrow chord, and the label text.
 * Ant `Button` `size="small"` to match the tour's Popover button
 * footprint. Previous = default; Next = primary blue.
 */
const PAGER_BTN_ROW: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4 };
const PAGER_KBD_STYLE: React.CSSProperties = {
  fontSize: 8,
  lineHeight: 1,
  verticalAlign: 'middle',
  height: 13,
  minWidth: 13,
  padding: '0 2px',
  borderRadius: 3,
};

const PagerLink: React.FC<{
  direction: 'prev' | 'next';
  title: string;
  onClick: () => void;
}> = ({ direction, title, onClick }) => {
  const isPrev = direction === 'prev';
  return (
    <Button
      type={isPrev ? 'default' : 'primary'}
      size="small"
      onClick={onClick}
      title={(isPrev ? 'Previous: ' : 'Next: ') + title}
    >
      <span style={PAGER_BTN_ROW}>
        {isPrev && (
          <span className="kbd-key" style={PAGER_KBD_STYLE}>
            {'←'}
          </span>
        )}
        <span>{isPrev ? 'Previous' : 'Next'}</span>
        {!isPrev && (
          <span className="kbd-key" style={PAGER_KBD_STYLE}>
            {'→'}
          </span>
        )}
      </span>
    </Button>
  );
};

export default DocsPanel;
