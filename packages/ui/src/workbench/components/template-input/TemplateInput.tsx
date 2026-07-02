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

import { CloseCircleFilled } from '@ant-design/icons';
import { useVariableResolver } from '@openheaders/ui/shared/hooks/useVariableResolver';
import { useVariableSuggestions } from '@openheaders/ui/shared/hooks/useVariableSuggestions';
import { useWorkspaces } from '@openheaders/ui/shared/hooks/useWorkspaces';
import { filterSuggestions, type VariableSuggestion } from '@openheaders/core/variables';
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
import { getCaretOffset, setCaretOffset } from './caret';
import { type CreateTarget, detectCreateTarget } from './create-target';
import { type RefState, renderHighlightedHtml, TEMPLATE_REGEX } from './highlight';
import { detectMeasure, findExistingCloseEnd, PREFIX, SPLIT } from './measure';
import { computePopoverCoords, type PopoverCoords } from './popover-coords';
import { addRecent, listRecents, pruneRecents, type VariableRecents } from './recents';
import { useAutoSuggestionContext } from './SuggestionContextProvider';
import SuggestionPopover from './SuggestionPopover';
import type { TemplateInputProps } from './types';
import { useVariablePopover } from './VariablePopoverHost';

const MAX_POPOVER_ROWS = 60;

const TemplateInput = forwardRef<HTMLDivElement, TemplateInputProps>(
  (
    {
      value,
      onChange,
      suggestionContext,
      multiline = false,
      expandOnFocus = false,
      wrap = false,
      expanded,
      maxRows = 5,
      resizable = false,
      allowClear = false,
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
    // One-shot: set when a keyboard action opens the create popover, so
    // the Enter/Tab key's own keyup doesn't immediately re-open the
    // suggestion list (a mouse click has no such keyup, hence it works).
    const suppressReopenRef = useRef(false);
    // One-shot: set when `triggerCreate` opens the shared create popover.
    // `triggerCreate` sets `isOpen` false to dismiss the suggestion list,
    // which would otherwise fire the `[value, isOpen]` effect below and
    // `closeNow()` the popover we just opened (a mouse keeps it alive by
    // hovering; the keyboard path has nothing, so it'd vanish).
    const openingCreateRef = useRef(false);
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
    // True once the caret follows `{{` — a lone `{` keeps this false so
    // we can hide an empty list (probably a literal brace) while still
    // showing it the moment a match exists.
    const [measureDouble, setMeasureDouble] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [recents, setRecents] = useState<VariableRecents | null>(null);
    const [isFocused, setIsFocused] = useState(false);
    // Suggestion popover coords. Portal-rendered to `document.body` so the
    // popover floats above whatever container the editable lives in
    // (clipped panels, hover popovers, modals). Recomputed on open + on
    // scroll/resize from the editable's bounding rect.
    const [popoverCoords, setPopoverCoords] = useState<PopoverCoords | null>(null);
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
      // `triggerCreate` flips `isOpen` false to dismiss the suggestion
      // list while opening the create popover — don't close that popover.
      if (openingCreateRef.current) {
        openingCreateRef.current = false;
        return;
      }
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
        setPopoverCoords(computePopoverCoords(rect, suggestions.length, window.innerHeight));
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
        setMeasureDouble(measure.double);
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
      if (suppressReopenRef.current) {
        suppressReopenRef.current = false;
        return;
      }
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
        // A namespace scaffold (`{{scope.}}`) lands the caret INSIDE,
        // right after the dot, and reopens the popover scoped to that
        // namespace so the user keeps typing the variable name. A real
        // reference lands the caret after `}}` and records a recent.
        const isScaffold = suggestion.preview.kind === 'namespace';
        const newCaret = isScaffold
          ? measureStart + PREFIX.length + suggestion.reference.length
          : measureStart + insert.length;
        root.innerHTML = renderHighlightedHtml(next, newCaret, classify);
        setCaretOffset(root, newCaret);
        onChange?.(next);
        if (isScaffold) {
          updateMeasure(next, newCaret);
          return;
        }
        setIsOpen(false);
        void addRecent(activeWorkspaceId, suggestion.reference)
          .then(() => listRecents(activeWorkspaceId))
          .then((updated) => setRecents(updated));
      },
      [activeWorkspaceId, measureStart, onChange, classify, updateMeasure],
    );

    // When the caret sits in a scoped reference whose variable doesn't
    // exist yet (`{{vault.okay}}` with no `vault.okay` defined), offer
    // to create it in that scope instead of a dead-end "No matches".
    const createTarget = useMemo<CreateTarget | null>(() => {
      if (!measureDouble || suggestions.length > 0) return null;
      return detectCreateTarget(query, effectiveContext.collectionId);
    }, [measureDouble, suggestions.length, query, effectiveContext.collectionId]);

    // Called when the create popover closes (Escape / save / outside-click).
    // Drop the user back into the field exactly where they left off — focus,
    // restore the caret by offset (survives the save re-render), and
    // re-measure so the suggestion list reopens, now showing the just-created
    // match. Skip when focus has moved to an outside target (dismissed by
    // clicking elsewhere) so we don't yank it back. Runs after the popover's
    // close animation, outside any React commit, so the re-measure's state
    // updates apply cleanly.
    const restoreAfterCreate = useCallback(
      (caretOffset: number) => {
        const root = editableRef.current;
        if (!root) return;
        const active = document.activeElement;
        const focusMovedOutside =
          !!active &&
          active !== document.body &&
          active !== root &&
          !active.closest('[data-variable-popover-root]');
        if (focusMovedOutside) return;
        root.focus();
        if (caretOffset >= 0) setCaretOffset(root, caretOffset);
        updateMeasure(root.textContent ?? '', caretOffset >= 0 ? caretOffset : getCaretOffset(root));
      },
      [updateMeasure],
    );

    // Hand the reference to the shared create popover (the "Add to"
    // flow), anchored to its `{{ref}}` token when rendered. The popover
    // defaults "Add to" to the reference's own scope.
    const triggerCreate = useCallback(() => {
      const target = createTarget;
      if (!target) return;
      const root = editableRef.current;
      if (!root) return;
      let anchor: HTMLElement = root;
      for (const span of root.querySelectorAll<HTMLElement>('.oh-template-ref')) {
        if (span.getAttribute('data-ref') === target.reference) {
          anchor = span;
          break;
        }
      }
      // Remember the caret so we can drop the user back exactly where they
      // left off (inside the `{{ref}}` token) when the popover closes.
      const caretOffset = getCaretOffset(root);
      // Guard the `[value, isOpen]` effect from closing this open.
      openingCreateRef.current = true;
      setIsOpen(false);
      // Pinned: a deliberate create action, not a hover — stay open
      // until the user Escapes / clicks out / saves. Without this the
      // popover hover-dismisses immediately (no pointer sustains it).
      popoverHost.open(
        { anchorEl: anchor, reference: target.reference, collectionId: effectiveContext.collectionId, autoFocus: true },
        { pinned: true, onClose: () => restoreAfterCreate(caretOffset) },
      );
    }, [createTarget, popoverHost, effectiveContext.collectionId, restoreAfterCreate]);

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
            // Suppress this Escape's keyup re-measure, which would otherwise
            // reopen the list it just closed (the caret is still in the ref).
            // Focus + caret stay put; typing or moving re-measures and reopens.
            suppressReopenRef.current = true;
            setIsOpen(false);
            return;
          }
        }
        // Empty list but the reference is creatable: Enter/Tab opens the
        // create flow; Escape dismisses.
        if (isOpen && suggestions.length === 0 && createTarget) {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            suppressReopenRef.current = true;
            triggerCreate();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            // Suppress this Escape's keyup re-measure, which would otherwise
            // reopen the list it just closed (the caret is still in the ref).
            // Focus + caret stay put; typing or moving re-measures and reopens.
            suppressReopenRef.current = true;
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
      [isOpen, suggestions, activeIndex, insertReference, multiline, onPressEnter, createTarget, triggerCreate],
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
    const displayExpanded = multiline || wrap || (expandOnFocus && expandActive);
    const displayCollapsed = expandOnFocus && !wrap && !expandActive;

    // Manual height from the resize grip. Overrides the maxRows
    // auto-grow cap while the surface is expanded; kept across
    // collapse/expand cycles so the field reopens at the user's size.
    const [manualHeight, setManualHeight] = useState<number | null>(null);
    const gripDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
    const handleGripPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const el = editableRef.current;
      if (!el) return;
      // preventDefault stops the pointerdown from blurring the editable;
      // the explicit focus() covers grabbing the grip on a blurred
      // (collapsed) field — focusing expands it, so the drag resizes the
      // wrapped surface rather than the one-line ellipsis view.
      e.preventDefault();
      el.focus();
      e.currentTarget.setPointerCapture(e.pointerId);
      gripDragRef.current = { startY: e.clientY, startHeight: el.offsetHeight };
    }, []);
    const handleGripPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      const drag = gripDragRef.current;
      if (!drag) return;
      const minHeight = 24;
      setManualHeight(Math.max(minHeight, drag.startHeight + (e.clientY - drag.startY)));
    }, []);
    const handleGripPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
      gripDragRef.current = null;
      e.currentTarget.releasePointerCapture(e.pointerId);
    }, []);

    // AntD-parity clear affordance: clears both the DOM (covers
    // uncontrolled use) and the controlled value, keeping focus in the
    // field so the user can type the replacement straight away.
    const showClear = allowClear && (value ?? '').length > 0;
    const handleClear = useCallback(() => {
      const root = editableRef.current;
      if (root) {
        root.innerHTML = '';
        root.focus();
      }
      onChange?.('');
    }, [onChange]);

    const editableStyle: React.CSSProperties = {
      minHeight: sizeMinHeight,
      padding: sizePadding,
      // Reserve just enough room that the last characters don't slide
      // under the ✕ (12px icon + its inset + a 2px gap).
      ...(showClear ? { paddingRight: displayExpanded ? 26 : 22 } : null),
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
      // Auto-grow cap for the wrapped editor (`wrap` always, or an
      // expand-on-focus field while active): ~maxRows lines (lineHeight
      // 1.5714) + a little padding allowance; past it the surface
      // inner-scrolls. A grip-dragged manual height replaces the cap
      // entirely — the user's chosen size wins.
      height: displayExpanded && resizable && manualHeight != null ? manualHeight : undefined,
      maxHeight:
        displayExpanded && resizable && manualHeight != null
          ? 'none'
          : wrap || (expandOnFocus && expandActive)
            ? `${(maxRows * 1.5714 + 0.9).toFixed(2)}em`
            : undefined,
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
        {resizable && (
          <div
            className="oh-template-input-resize-grip"
            onPointerDown={handleGripPointerDown}
            onPointerMove={handleGripPointerMove}
            onPointerUp={handleGripPointerUp}
            onDoubleClick={() => setManualHeight(null)}
            aria-hidden="true"
          />
        )}
        {showClear && (
          <CloseCircleFilled
            className="oh-template-input-clear"
            aria-label="Clear value"
            style={{
              // Inset left of the resize grip's column (a one-row expanded
              // field puts "top-right" and "bottom-right" at the same
              // spot, so side-by-side is the only non-overlapping layout —
              // same as AntD TextArea's allowClear + resize). Also clears
              // the unresolved dot when flagged. Top-right on an expanded
              // surface, centered on a single line.
              // Expanded: sit immediately left of the 8px scrollbar column
              // (the grip below never collides — the scrollbar track stops
              // above it). Single line: hug the right edge. The unresolved
              // dot pushes either further left.
              right: (displayExpanded ? 10 : 6) + (hasUnresolvedRef ? 10 : 0),
              // Expanded: pin to the first line's center (size-dependent —
              // small fields have no vertical padding). Single line:
              // center in the field.
              ...(displayExpanded ? { top: size === 'small' ? 4 : 9 } : { top: '50%', transform: 'translateY(-50%)' }),
            }}
            // preventDefault keeps the editable focused through the click.
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleClear}
          />
        )}
        {isOpen &&
          popoverCoords &&
          // A lone `{` only opens the popover once it has a match —
          // `{{` (clear template intent) always opens, even to show
          // "No matches" — so a literal brace in a value doesn't flash
          // an empty list.
          (suggestions.length > 0 || measureDouble) &&
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
                createAction={
                  createTarget
                    ? {
                        label: (
                          <>
                            Create “{createTarget.name}” in {createTarget.scopeLabel}
                          </>
                        ),
                        onSelect: triggerCreate,
                      }
                    : undefined
                }
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
