/**
 * TemplateInput — contentEditable-backed field with inline `{{ref}}`
 * highlighting + suggestion popover.
 *
 * The editable element itself renders the styled spans (no mirror
 * overlay, no transparent-text hack). That collapses the textarea /
 * mirror two-layer design into a single source of truth and removes
 * the computed-style-sync machinery that was needed to keep the
 * layers aligned — whatever padding / font / letter-spacing the
 * caller sets applies to the only element that exists.
 *
 * Value lifecycle:
 *   - External `value` prop → `innerHTML = highlightText(value)`
 *     when `textContent` differs, preserving caret via a char-offset
 *     save/restore.
 *   - User input → read `textContent`, fire `onChange`, re-highlight
 *     with the same save/restore.
 *   - While the caret sits inside a `{{...}}` range, that span uses
 *     the neutral `editing` class so classification doesn't flicker
 *     red/blue on every keystroke; it snaps back to resolved /
 *     unresolved once the caret leaves.
 */

import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import { useVariableSuggestions } from '@openheaders/ui/shared/hooks/useVariableSuggestions';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/useWorkspaces';
import { filterSuggestions, type SuggestionContext, type VariableSuggestion } from '@openheaders/core/variables';
import { theme } from 'antd';
import type React from 'react';
import {
  type ClipboardEvent,
  forwardRef,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
// Co-located styles travel with the component — anyone who imports
// TemplateInput automatically gets `{{ref}}` highlighting + suggestion
// popover chrome without per-app CSS plumbing.
import './template-input.css';
import { useSettingValue } from '../../settings/hooks';
import { addRecent, listRecents, pruneRecents, type VariableRecents } from './recents';
import { useAutoSuggestionContext } from './SuggestionContextProvider';
import SuggestionPopover from './SuggestionPopover';
import { useVariablePopover } from './VariablePopoverHost';

export interface TemplateInputProps {
  /** Controlled value. Optional so the component composes with AntD
   *  `<Form.Item>` (which injects value/onChange at clone time). */
  value?: string;
  /** Controlled change handler. Optional for the same reason. */
  onChange?: (next: string) => void;
  /** Scope/context override — controls which scopes are offered. When
   *  omitted, the component sources context from the nearest
   *  {@link SuggestionContextProvider} via {@link useAutoSuggestionContext}. */
  suggestionContext?: SuggestionContext;
  /** When true, render a multiline surface. Default false — single-line
   *  (Enter is swallowed, newlines are stripped from paste). */
  multiline?: boolean;
  /** When true, keep single-line SEMANTICS (no literal newlines) but
   *  switch the DISPLAY on focus: collapsed (blurred) shows one line
   *  with an ellipsis; focused word-wraps the value and auto-grows up to
   *  `maxRows` lines, then inner-scrolls. Used in dense table cells so a
   *  long value is comfortably editable without a horizontal scrollbar.
   *  Ignored when `multiline` is set. */
  expandOnFocus?: boolean;
  /** Controlled override for `expandOnFocus`'s expanded state. When set,
   *  it drives the collapsed/expanded display instead of the field's own
   *  focus — lets a parent expand a whole group of fields together (e.g.
   *  every cell in a table row expands when any one of them is focused).
   *  Undefined → falls back to the field's own focus. */
  expanded?: boolean;
  /** Row cap for `expandOnFocus`'s grown editor before it inner-scrolls.
   *  Default 5. */
  maxRows?: number;
  /** Placeholder. Rendered via a `::before` pseudo when the field is empty. */
  placeholder?: string;
  /** Mirrors AntD `Input` size prop — tunes the editable's padding. */
  size?: 'small' | 'middle' | 'large';
  /** Matches AntD variant — `outlined` (default) shows border + radius,
   *  `borderless` drops them (used inside table cells). */
  variant?: 'outlined' | 'borderless';
  /** When true, disable the popover entirely — the field becomes a
   *  plain editable div. Used for fields that shouldn't suggest anything
   *  (LV manualOverride, extractor paths). */
  disableSuggestions?: boolean;
  /** Forwarded to the editable element. Applied AFTER the base styles
   *  so callers can override padding / color / flex / width. */
  style?: React.CSSProperties;
  /** Additional class forwarded to the root wrapper. */
  className?: string;
  /** `onPressEnter` parity with AntD Input — fires when Enter is
   *  pressed and the popover is not handling it. */
  onPressEnter?: () => void;
  /** Forwarded to the editable. */
  onFocus?: (e: React.FocusEvent<HTMLDivElement>) => void;
  /** Forwarded to the editable. */
  onBlur?: (e: React.FocusEvent<HTMLDivElement>) => void;
  /** Forwarded to the editable. */
  autoFocus?: boolean;
  /** Forwarded to the editable. */
  id?: string;
  /** Forwarded to the editable. */
  'aria-label'?: string;
  /** AntD-compatible status override. `'error'` paints the border red
   *  regardless of focus state — use for unresolved-ref signalling. */
  status?: 'error';
  /** When true, literal characters render masked (disc) while
   *  `{{ref}}` spans stay visible. Use for password / token fields
   *  where users still need to read which variable they picked but
   *  typed-in secrets should not be drive-by-readable. */
  secret?: boolean;
  /** When true, show a small red dot at the field's right end whenever
   *  its value contains an UNRESOLVED `{{ref}}` (reserved namespaces
   *  excluded). Lets a row flag a missing variable without the user
   *  expanding it to hunt for the highlighted ref. */
  flagUnresolved?: boolean;
}

const PREFIX = '{{';
const SPLIT = '}}';
const TEMPLATE_REGEX = /\{\{([^}]*)\}\}/g;
const MAX_POPOVER_ROWS = 60;

// Suggestion-popover geometry. Used to pick a side (below by default, above
// when the field sits low and below can't fit) and cap the list to the room
// on that side, so the dropdown never opens straight into the footer. Row /
// footer sizes are approximations — they only seed the open-time side choice;
// the list's own scroll absorbs any error past the cap.
const POPOVER_GAP = 4;
const POPOVER_VIEWPORT_MARGIN = 8;
const POPOVER_LIST_MAX = 320; // mirrors `.oh-template-popover-list` max-height
const POPOVER_FOOTER_H = 34; // approx `.oh-template-popover-footer` height
const POPOVER_ROW_H = 30; // approx row height, for the open-time fit estimate
const POPOVER_LIST_MIN = 72; // keep a couple of rows visible even when cramped

type RefState = 'resolved' | 'unresolved' | 'reserved';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Walk backward from caret to find the most recent unclosed `{{`.
 *  Returns the open-brace start index (0-based) + the query (text
 *  between `{{` and caret). `null` means no active template context.
 *
 *  The query is rejected if it contains any `}` — variable references
 *  don't contain braces, so a `}` in the query means we've walked past
 *  the closing brace of an already-complete ref (caret sits between
 *  `}` and `}` at the end of `{{env.wat}}`, for example). */
function detectMeasure(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const openIdx = before.lastIndexOf(PREFIX);
  if (openIdx === -1) return null;
  const after = before.slice(openIdx + PREFIX.length);
  if (after.includes('}')) return null;
  return { start: openIdx, query: after };
}

/** When the caret sits inside an already-complete `{{ref}}`, find the
 *  position AFTER its closing `}}`. Returns the original caret
 *  position if there's no closing `}}` before the next `{{` (or no
 *  following text at all) — meaning the user is composing a brand-new
 *  ref and we shouldn't consume anything. */
function findExistingCloseEnd(text: string, caret: number): number {
  const forward = text.slice(caret);
  const nextOpen = forward.indexOf(PREFIX);
  const nextClose = forward.indexOf(SPLIT);
  if (nextClose === -1) return caret;
  if (nextOpen !== -1 && nextOpen < nextClose) return caret;
  return caret + nextClose + SPLIT.length;
}

/** Caret char-offset within `root` (counts only text nodes). `-1` if
 *  the current selection is outside `root`. */
function getCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return -1;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return -1;
  const pre = range.cloneRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.endContainer, range.endOffset);
  return pre.toString().length;
}

/** Place the caret at `offset` characters into `root`. Silently no-ops
 *  if the root is shorter than `offset` (we clamp to end). */
function setCaretOffset(root: HTMLElement, offset: number): void {
  const sel = window.getSelection();
  if (!sel) return;
  const total = (root.textContent ?? '').length;
  const target = Math.max(0, Math.min(offset, total));
  const range = document.createRange();
  let remaining = target;
  let placed = false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const len = node.nodeValue?.length ?? 0;
    if (remaining <= len) {
      range.setStart(node, remaining);
      range.collapse(true);
      placed = true;
      break;
    }
    remaining -= len;
    node = walker.nextNode();
  }
  if (!placed) {
    // Empty editable — anchor at the root itself.
    range.selectNodeContents(root);
    range.collapse(false);
  }
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Render `value` as HTML with `{{ref}}` wrapped in classified spans.
 *  When `caret` is inside a ref's `[start, end)` range (exclusive of
 *  the braces on either side — see `caretInsideRange`), that ref
 *  renders with the neutral `editing` class. */
function renderHighlightedHtml(value: string, caret: number | null, classify: (inner: string) => RefState): string {
  if (value.length === 0) return '';
  const regex = new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags);
  let out = '';
  let last = 0;
  for (const match of value.matchAll(regex)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (start > last) out += escapeHtml(value.slice(last, start));
    const inner = match[1];
    const editing = caret !== null && caret > start && caret < end;
    const state = editing ? 'editing' : classify(inner);
    out += `<span class="oh-template-ref oh-template-ref-${state}" data-ref="${escapeHtml(inner)}">${escapeHtml(match[0])}</span>`;
    last = end;
  }
  if (last < value.length) out += escapeHtml(value.slice(last));
  return out;
}

const TemplateInput = forwardRef<HTMLDivElement, TemplateInputProps>(
  (
    {
      value,
      onChange,
      suggestionContext,
      multiline = false,
      expandOnFocus = false,
      expanded,
      maxRows = 5,
      placeholder = '',
      size = 'middle',
      variant = 'outlined',
      disableSuggestions = false,
      style,
      className,
      onPressEnter,
      onFocus,
      onBlur,
      autoFocus,
      id,
      'aria-label': ariaLabel,
      status,
      secret = false,
      flagUnresolved = false,
    },
    ref,
  ) => {
    const editableRef = useRef<HTMLDivElement | null>(null);
    const mergedRef = useCallback(
      (instance: HTMLDivElement | null) => {
        editableRef.current = instance;
        if (typeof ref === 'function') ref(instance);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = instance;
      },
      [ref],
    );

    const autoContext = useAutoSuggestionContext();
    const effectiveContext = suggestionContext ?? autoContext;
    const { suggestions: allSuggestions } = useVariableSuggestions(effectiveContext);
    const resolver = useVariableResolver();
    const { activeWorkspaceId } = useWorkspaces();
    const autocompleteEnabled = useSettingValue('rulesEngine.variableAutocomplete');
    const effectiveDisable = disableSuggestions || !autocompleteEnabled;
    const { token } = theme.useToken();

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [measureStart, setMeasureStart] = useState<number | null>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const [recents, setRecents] = useState<VariableRecents | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    // Suggestion popover coords. Portal-rendered to `document.body`
    // so the popover floats above whatever container the editable
    // lives in (clipped panels, hover popovers, modals). Recomputed
    // on open + on scroll/resize from the editable's bounding rect.
    // `top` anchors a downward popover; `bottom` anchors an upward one
    // (grows up from just above the field); `maxListHeight` caps the
    // scroll list to the room on the chosen side.
    const [popoverCoords, setPopoverCoords] = useState<{
      left: number;
      top?: number;
      bottom?: number;
      maxListHeight: number;
    } | null>(null);
    // Shared hover-popover host — single instance per app root, owns
    // open-state + close-grace timer. We just emit hover events.
    const popoverHost = useVariablePopover();

    // Classifier: delegates to the live resolver. Memoised by (resolver,
    // collectionId) so the `renderHighlightedHtml` recompute doesn't
    // build a new closure every render.
    const classify = useCallback(
      (inner: string): RefState => {
        const context = effectiveContext.collectionId ? { collectionId: effectiveContext.collectionId } : undefined;
        const { errors } = resolver.resolveTemplate(`{{${inner}}}`, context);
        if (errors.length === 0) return 'resolved';
        if (errors[0].reason === 'reserved-namespace') return 'reserved';
        return 'unresolved';
      },
      [resolver, effectiveContext.collectionId],
    );

    // Whether the value holds an UNRESOLVED ref — drives the optional
    // right-end dot. Reuses the highlighter's classifier so the dot stays
    // in lockstep with the red ref highlight; only walked when opted in.
    const hasUnresolvedRef = useMemo(() => {
      if (!flagUnresolved || !value) return false;
      for (const m of value.matchAll(new RegExp(TEMPLATE_REGEX.source, TEMPLATE_REGEX.flags))) {
        if (classify(m[1]) === 'unresolved') return true;
      }
      return false;
    }, [flagUnresolved, value, classify]);

    // Hydrate recents on workspace switch; prune against current suggestions.
    useEffect(() => {
      let cancelled = false;
      void (async () => {
        const refs = new Set(allSuggestions.map((s) => s.reference));
        const next = await (refs.size > 0 ? pruneRecents(activeWorkspaceId, refs) : listRecents(activeWorkspaceId));
        if (!cancelled) setRecents(next);
      })();
      return () => {
        cancelled = true;
      };
    }, [activeWorkspaceId, allSuggestions]);

    // Compute filtered+ordered options. Empty query → recents pinned.
    const suggestions = useMemo<VariableSuggestion[]>(() => {
      if (!isOpen) return [];
      const ranked = filterSuggestions(allSuggestions, query);
      if (query === '' && recents && recents.entries.length > 0) {
        const recencyIndex = new Map<string, number>();
        for (let i = 0; i < recents.entries.length; i++) {
          recencyIndex.set(recents.entries[i].reference, i);
        }
        const recent: VariableSuggestion[] = [];
        const rest: VariableSuggestion[] = [];
        for (const s of ranked) {
          if (recencyIndex.has(s.reference)) recent.push(s);
          else rest.push(s);
        }
        recent.sort((a, b) => (recencyIndex.get(a.reference) ?? 0) - (recencyIndex.get(b.reference) ?? 0));
        return [...recent, ...rest].slice(0, MAX_POPOVER_ROWS);
      }
      return ranked.slice(0, MAX_POPOVER_ROWS);
    }, [isOpen, allSuggestions, query, recents]);

    // Clamp activeIndex when the suggestion list shrinks.
    useEffect(() => {
      if (suggestions.length === 0) return;
      setActiveIndex((prev) => (prev >= suggestions.length ? 0 : prev));
    }, [suggestions.length]);

    // Sync external `value` prop → innerHTML. Only writes when the
    // current text content differs from `value` (prevents every
    // external re-render from clobbering the caret).
    useEffect(() => {
      const root = editableRef.current;
      if (!root) return;
      const next = value ?? '';
      const current = root.textContent ?? '';
      const focused = document.activeElement === root;
      const caretWas = focused ? getCaretOffset(root) : null;
      const html = renderHighlightedHtml(next, caretWas, classify);
      if (root.innerHTML !== html) {
        root.innerHTML = html;
        if (focused && caretWas !== null && current === next) {
          // Re-highlight only — restore previous caret position.
          setCaretOffset(root, caretWas);
        } else if (focused) {
          // External value change — anchor caret at end.
          setCaretOffset(root, next.length);
        }
      }
    }, [value, classify]);

    // `autoFocus` equivalent — contentEditable doesn't honor the HTML
    // attribute, so we focus imperatively after mount.
    useEffect(() => {
      if (!autoFocus) return;
      editableRef.current?.focus();
    }, [autoFocus]);

    // Re-rendering innerHTML on every keystroke replaces span nodes —
    // a tracked anchor would point to a detached element. Tell the host
    // to close immediately whenever the value changes or the suggestion
    // dropdown takes over; the user can re-hover to reopen.
    // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on `value` / `isOpen`.
    useEffect(() => {
      popoverHost.closeNow();
    }, [value, isOpen]);

    // Suggestion popover positioning — keep it pinned to the editable as the
    // user types / the page scrolls. Portal-mounted so it ignores the
    // editable's ancestor clipping (a clipped overflow on a hover popover /
    // Modal / panel container would otherwise crop the dropdown). Opens below
    // by default; flips above when the field sits low enough that the dropdown
    // can't fit below and there's more room above — so a field near a panel's
    // footer doesn't open the list straight into it.
    // biome-ignore lint/correctness/useExhaustiveDependencies: `update` reads `suggestions.length` only to size the fit threshold; keeping it out of deps means a filter change doesn't re-fire this (the open-time full-list size is the right, stable threshold). `update` itself re-reads the rect — and re-picks the side — live on scroll/resize.
    useEffect(() => {
      if (!isOpen) return;
      const update = () => {
        const rect = editableRef.current?.getBoundingClientRect();
        if (!rect) return;
        const wantHeight =
          Math.min(Math.max(suggestions.length, 1) * POPOVER_ROW_H, POPOVER_LIST_MAX) + POPOVER_FOOTER_H;
        const roomBelow = window.innerHeight - rect.bottom - POPOVER_GAP - POPOVER_VIEWPORT_MARGIN;
        const roomAbove = rect.top - POPOVER_GAP - POPOVER_VIEWPORT_MARGIN;
        // Below by default; flip above when below can't fit the list and above
        // has more room. Re-evaluated on every `update` (not frozen at open),
        // so a window/pane resize re-picks the side live. `update` fires only
        // on scroll/resize — never per keystroke — so it stays put mid-type.
        const placeAbove = roomBelow < wantHeight && roomAbove > roomBelow;
        const room = placeAbove ? roomAbove : roomBelow;
        const maxListHeight = Math.max(POPOVER_LIST_MIN, Math.min(POPOVER_LIST_MAX, room - POPOVER_FOOTER_H));
        setPopoverCoords(
          placeAbove
            ? { left: rect.left, bottom: window.innerHeight - rect.top + POPOVER_GAP, maxListHeight }
            : { left: rect.left, top: rect.bottom + POPOVER_GAP, maxListHeight },
        );
      };
      update();
      window.addEventListener('scroll', update, true);
      window.addEventListener('resize', update);
      return () => {
        window.removeEventListener('scroll', update, true);
        window.removeEventListener('resize', update);
      };
    }, [isOpen]);

    const updateMeasure = useCallback(
      (text: string, caret: number) => {
        if (effectiveDisable) {
          setIsOpen(false);
          return;
        }
        const measure = detectMeasure(text, caret);
        if (!measure) {
          setIsOpen(false);
          return;
        }
        setMeasureStart((prev) => {
          if (prev !== measure.start) setActiveIndex(0);
          return measure.start;
        });
        setQuery(measure.query);
        setIsOpen(true);
      },
      [effectiveDisable],
    );

    const handleInput = useCallback(() => {
      const root = editableRef.current;
      if (!root) return;
      const caretPos = getCaretOffset(root);
      const text = root.textContent ?? '';
      // Strip `\n` injected by contentEditable when multiline is false.
      const sanitized = multiline ? text : text.replace(/\n/g, '');
      if (sanitized !== text) {
        const adj = Math.min(caretPos, sanitized.length);
        root.innerHTML = renderHighlightedHtml(sanitized, adj, classify);
        setCaretOffset(root, adj);
        onChange?.(sanitized);
        updateMeasure(sanitized, adj);
        return;
      }
      // Re-render highlights with caret-aware neutralising so the
      // active ref doesn't flicker mid-edit.
      const html = renderHighlightedHtml(text, caretPos, classify);
      if (root.innerHTML !== html) {
        root.innerHTML = html;
        setCaretOffset(root, caretPos);
      }
      onChange?.(text);
      updateMeasure(text, caretPos);
    }, [multiline, onChange, classify, updateMeasure]);

    const handleKeyUpOrMouseUp = useCallback(() => {
      const root = editableRef.current;
      if (!root || document.activeElement !== root) return;
      const caretPos = getCaretOffset(root);
      const text = root.textContent ?? '';
      // Re-render with caret-aware state (caret may have moved out of
      // a ref — swap editing class → resolved/unresolved).
      const html = renderHighlightedHtml(text, caretPos, classify);
      if (root.innerHTML !== html) {
        root.innerHTML = html;
        setCaretOffset(root, caretPos);
      }
      updateMeasure(text, caretPos);
    }, [classify, updateMeasure]);

    const insertReference = useCallback(
      (suggestion: VariableSuggestion) => {
        if (suggestion.disabled || measureStart === null) return;
        const root = editableRef.current;
        if (!root) return;
        const caret = getCaretOffset(root);
        const text = root.textContent ?? '';
        const before = text.slice(0, measureStart);
        // If the caret sits inside an already-complete ref (the open
        // `{{` is `measureStart` and a matching `}}` follows before any
        // new `{{`), consume that existing `}}` so we replace the ref
        // end-to-end instead of prepending and leaving stray braces.
        const consumeEnd = findExistingCloseEnd(text, caret);
        const after = text.slice(consumeEnd);
        const insert = `${PREFIX}${suggestion.reference}${SPLIT}`;
        const next = `${before}${insert}${after}`;
        const newCaret = measureStart + insert.length;
        root.innerHTML = renderHighlightedHtml(next, newCaret, classify);
        setCaretOffset(root, newCaret);
        setIsOpen(false);
        onChange?.(next);
        void addRecent(activeWorkspaceId, suggestion.reference)
          .then(() => listRecents(activeWorkspaceId))
          .then((updated) => setRecents(updated));
      },
      [activeWorkspaceId, measureStart, onChange, classify],
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (isOpen && suggestions.length > 0) {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex((prev) => (prev + 1) % suggestions.length);
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
            return;
          }
          if (e.key === 'Enter' || e.key === 'Tab') {
            const suggestion = suggestions[activeIndex];
            if (suggestion && !suggestion.disabled) {
              e.preventDefault();
              e.stopPropagation();
              insertReference(suggestion);
              return;
            }
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(false);
            return;
          }
        }
        // Enter handling outside the popover: single-line swallows,
        // multiline leaves the browser to insert a `<br>`.
        if (e.key === 'Enter') {
          if (!multiline && !e.shiftKey) {
            e.preventDefault();
            onPressEnter?.();
          }
        }
      },
      [isOpen, suggestions, activeIndex, insertReference, multiline, onPressEnter],
    );

    // Hover-over-{{ref}} → ask the shared popover host to open. Delegated
    // from the editable; the caret-in-editing case keeps the span's class
    // as `editing` and we skip emitting hover for that one (mid-compose
    // would steal focus from the textarea).
    const handleEditableMouseOver = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const span = target.closest<HTMLElement>('.oh-template-ref');
        if (!span) return;
        if (span.classList.contains('oh-template-ref-editing')) return;
        const ref = span.getAttribute('data-ref') ?? '';
        if (!ref) return;
        popoverHost.open({ anchorEl: span, reference: ref, collectionId: effectiveContext.collectionId });
      },
      [popoverHost, effectiveContext.collectionId],
    );

    const handleEditableMouseOut = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const span = target.closest<HTMLElement>('.oh-template-ref');
        if (!span) return;
        const related = e.relatedTarget as Node | null;
        if (related && span.contains(related)) return;
        popoverHost.scheduleClose(e.relatedTarget);
      },
      [popoverHost],
    );

    const handlePaste = useCallback(
      (e: ClipboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        const raw = e.clipboardData.getData('text/plain');
        const text = multiline ? raw : raw.replace(/\r?\n/g, ' ');
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        sel.deleteFromDocument();
        const node = document.createTextNode(text);
        sel.getRangeAt(0).insertNode(node);
        const range = document.createRange();
        range.setStartAfter(node);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        handleInput();
      },
      [multiline, handleInput],
    );

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        setIsFocused(true);
        // Re-render so the ref the caret lands in renders neutral.
        handleKeyUpOrMouseUp();
        onFocus?.(e);
      },
      [onFocus, handleKeyUpOrMouseUp],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLDivElement>) => {
        setIsFocused(false);
        setIsOpen(false);
        // Re-classify refs now that the caret isn't tracked.
        const root = editableRef.current;
        if (root) {
          const text = root.textContent ?? '';
          const html = renderHighlightedHtml(text, null, classify);
          if (root.innerHTML !== html) root.innerHTML = html;
        }
        onBlur?.(e);
      },
      [onBlur, classify],
    );

    // Derive paddings from `size` — match AntD defaults so we visually
    // line up with sibling AntD inputs. Caller styles override via
    // `style` prop (applied last).
    const sizePadding = size === 'small' ? '0 7px' : size === 'large' ? '6.5px 11px' : '4px 11px';
    const sizeMinHeight = size === 'small' ? 24 : size === 'large' ? 40 : 32;

    // `status === 'error'` wins regardless of focus so the error
    // colour doesn't flicker back to primary-blue when the field is
    // active — matches AntD Input's behaviour.
    const borderColor = status === 'error' ? token.colorError : isFocused ? token.colorPrimary : token.colorBorder;
    const focusShadow =
      status === 'error' ? `0 0 0 2px ${token.colorErrorBorderHover}` : `0 0 0 2px ${token.controlOutline}`;

    // Wrapped, growable surface: always for `multiline`, or for an
    // `expandOnFocus` field while it's active. "Active" is the controlled
    // `expanded` prop when supplied (so a row can expand all its cells
    // together), else the field's own focus. Collapsed-ellipsis is the
    // inactive state of an `expandOnFocus` field.
    const expandActive = expanded ?? isFocused;
    const displayExpanded = multiline || (expandOnFocus && expandActive);
    const displayCollapsed = expandOnFocus && !expandActive;

    const editableStyle: React.CSSProperties = {
      minHeight: sizeMinHeight,
      padding: sizePadding,
      lineHeight: 1.5714,
      fontSize: size === 'small' ? 12 : size === 'large' ? 16 : 14,
      fontFamily: 'inherit',
      color: token.colorText,
      background: variant === 'borderless' ? 'transparent' : token.colorBgContainer,
      border: variant === 'borderless' ? 'none' : `1px solid ${borderColor}`,
      borderRadius: variant === 'borderless' ? 0 : token.borderRadius,
      outline: 'none',
      cursor: 'text',
      width: '100%',
      boxSizing: 'border-box',
      // Display mode (separate from `multiline` newline SEMANTICS):
      //   - expanded → word-wrap + vertical scroll (multiline surface,
      //     or an expand-on-focus field while it has focus)
      //   - collapsed-ellipsis → one line, clipped with an ellipsis
      //     (an expand-on-focus field while blurred)
      //   - default single-line → one line, horizontal caret-scroll
      whiteSpace: displayExpanded ? 'pre-wrap' : displayCollapsed ? 'nowrap' : 'pre',
      overflowX: displayExpanded || displayCollapsed ? 'hidden' : 'auto',
      overflowY: displayExpanded ? 'auto' : 'hidden',
      textOverflow: displayCollapsed ? 'ellipsis' : undefined,
      // Auto-grow cap for the focused expand-on-focus editor: ~maxRows
      // lines (lineHeight 1.5714) + a little padding allowance; past it
      // the surface inner-scrolls.
      maxHeight: expandOnFocus && expandActive ? `${(maxRows * 1.5714 + 0.9).toFixed(2)}em` : undefined,
      wordBreak: displayExpanded ? 'break-word' : 'normal',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: isFocused && variant !== 'borderless' ? focusShadow : undefined,
      ...style,
      // An expand-on-focus caller sets a tall `line-height` to vertically
      // center the single collapsed line in the cell; once it expands,
      // force the normal line-height so the wrapped multi-line editor
      // isn't loosely spaced. (After `...style` so it wins.)
      ...(expandOnFocus && expandActive ? { lineHeight: 1.5714 } : null),
    };

    return (
      <span
        className={`oh-template-input-wrapper${hasUnresolvedRef ? ' oh-template-input-wrapper--flagged' : ''}${className ? ` ${className}` : ''}`}
      >
        <div
          ref={mergedRef}
          className={`oh-template-input-editable${displayExpanded ? ' oh-template-input-editable--expanded' : ''}${secret ? ' oh-template-input-secret' : ''}`}
          contentEditable
          suppressContentEditableWarning
          role="combobox"
          tabIndex={0}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          spellCheck={false}
          id={id}
          data-placeholder={placeholder}
          style={editableStyle}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUpOrMouseUp}
          onMouseUp={handleKeyUpOrMouseUp}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onMouseOver={handleEditableMouseOver}
          onMouseOut={handleEditableMouseOut}
        />
        {isOpen &&
          popoverCoords &&
          createPortal(
            <div
              className="oh-template-popover-anchor"
              style={{ top: popoverCoords.top, bottom: popoverCoords.bottom, left: popoverCoords.left }}
            >
              <SuggestionPopover
                suggestions={suggestions}
                activeIndex={activeIndex}
                maxListHeight={popoverCoords.maxListHeight}
                onActiveIndexChange={setActiveIndex}
                onSelect={insertReference}
              />
            </div>,
            document.body,
          )}
        {hasUnresolvedRef && (
          <span
            className="oh-template-input-unresolved-dot"
            aria-hidden="true"
            title="Contains an unresolved variable"
          />
        )}
      </span>
    );
  },
);

TemplateInput.displayName = 'TemplateInput';

export default TemplateInput;
