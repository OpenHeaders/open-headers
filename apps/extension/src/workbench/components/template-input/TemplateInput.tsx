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

import { useVariableResolver } from '@hooks/useVariableResolver';
import { useVariableSuggestions } from '@hooks/useVariableSuggestions';
import { useWorkspaces } from '@hooks/useWorkspaces';
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
import { useSettingValue } from '../../settings/hooks';
import { addRecent, listRecents, pruneRecents, type VariableRecents } from './recents';
import { useAutoSuggestionContext } from './SuggestionContextProvider';
import SuggestionPopover from './SuggestionPopover';

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
}

const PREFIX = '{{';
const SPLIT = '}}';
const TEMPLATE_REGEX = /\{\{([^}]*)\}\}/g;
const MAX_POPOVER_ROWS = 60;

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

    const editableStyle: React.CSSProperties = {
      minHeight: sizeMinHeight,
      padding: sizePadding,
      lineHeight: 1.5714,
      fontSize: size === 'small' ? 12 : size === 'large' ? 16 : 14,
      fontFamily: 'inherit',
      color: token.colorText,
      background: variant === 'borderless' ? 'transparent' : token.colorBgContainer,
      border: variant === 'borderless' ? 'none' : `1px solid ${isFocused ? token.colorPrimary : token.colorBorder}`,
      borderRadius: variant === 'borderless' ? 0 : token.borderRadius,
      outline: 'none',
      cursor: 'text',
      width: '100%',
      boxSizing: 'border-box',
      whiteSpace: multiline ? 'pre-wrap' : 'pre',
      overflowX: multiline ? 'hidden' : 'auto',
      overflowY: multiline ? 'auto' : 'hidden',
      wordBreak: multiline ? 'break-word' : 'normal',
      transition: 'border-color 0.2s, box-shadow 0.2s',
      boxShadow: isFocused && variant !== 'borderless' ? `0 0 0 2px ${token.controlOutline}` : undefined,
      ...style,
    };

    return (
      <span className={`oh-template-input-wrapper${className ? ` ${className}` : ''}`}>
        <div
          ref={mergedRef}
          className="oh-template-input-editable"
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
        />
        {isOpen && (
          <div className="oh-template-popover-anchor">
            <SuggestionPopover
              suggestions={suggestions}
              activeIndex={activeIndex}
              onActiveIndexChange={setActiveIndex}
              onSelect={insertReference}
            />
          </div>
        )}
      </span>
    );
  },
);

TemplateInput.displayName = 'TemplateInput';

export default TemplateInput;
