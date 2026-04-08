/**
 * EditorVariablesContext — shared context for communicating which {{VAR}}
 * references the currently active editor uses.
 *
 * Architecture:
 * - Each editor (RequestEditor, RuleEditor) calls `setUsedVariables(vars)` whenever
 *   its content changes, passing all unique {{VAR}} names found across all fields.
 * - The Inspector panel reads `usedVariables` to show "Variables in request" in real-time.
 * - When the active tab changes, `clearVariables()` resets the list.
 *
 * This avoids tight coupling between editors and the Inspector — they communicate
 * through this context without knowing about each other.
 */

import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface UsedVariable {
  name: string;
  /** Which field(s) reference this variable (e.g. 'url', 'header:Authorization', 'body') */
  usedIn: string[];
}

interface EditorVariablesContextValue {
  /** Variables currently used in the active editor */
  usedVariables: UsedVariable[];
  /** Called by editors to publish their current variable usage */
  setUsedVariables: (vars: UsedVariable[]) => void;
  /** Called when switching tabs to clear stale data */
  clearVariables: () => void;
}

const EditorVariablesContext = createContext<EditorVariablesContextValue>({
  usedVariables: [],
  setUsedVariables: () => {},
  clearVariables: () => {},
});

export function EditorVariablesProvider({ children }: { children: React.ReactNode }) {
  const [usedVariables, setUsedVariablesState] = useState<UsedVariable[]>([]);

  const setUsedVariables = useCallback((vars: UsedVariable[]) => {
    setUsedVariablesState(vars);
  }, []);

  const clearVariables = useCallback(() => {
    setUsedVariablesState([]);
  }, []);

  const value = useMemo(
    () => ({ usedVariables, setUsedVariables, clearVariables }),
    [usedVariables, setUsedVariables, clearVariables],
  );

  return <EditorVariablesContext.Provider value={value}>{children}</EditorVariablesContext.Provider>;
}

export function useEditorVariables(): EditorVariablesContextValue {
  return useContext(EditorVariablesContext);
}

// ── Helper: extract {{VAR}} names from a string ──────────────────

export function extractVarNames(text: string): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim()))];
}

// ── Helper: extract all vars from a request's fields ─────────────

interface RequestFields {
  url: string;
  params: Array<{ key: string; value: string }>;
  headers: Array<{ key: string; value: string }>;
  body: string;
}

export function extractRequestVariables(fields: RequestFields): UsedVariable[] {
  const varMap = new Map<string, Set<string>>();

  const add = (name: string, location: string) => {
    const existing = varMap.get(name);
    if (existing) existing.add(location);
    else varMap.set(name, new Set([location]));
  };

  for (const name of extractVarNames(fields.url)) add(name, 'url');
  for (const p of fields.params) {
    for (const name of extractVarNames(p.key)) add(name, `param:${p.key}`);
    for (const name of extractVarNames(p.value)) add(name, `param:${p.key}`);
  }
  for (const h of fields.headers) {
    for (const name of extractVarNames(h.key)) add(name, `header:${h.key}`);
    for (const name of extractVarNames(h.value)) add(name, `header:${h.key}`);
  }
  for (const name of extractVarNames(fields.body)) add(name, 'body');

  return [...varMap.entries()].map(([name, locations]) => ({
    name,
    usedIn: [...locations],
  }));
}

// ── Helper: extract all vars from a rule's fields ────────────────

interface RuleFields {
  headerName: string;
  headerValue: string;
  prefix: string;
  suffix: string;
  domains: string[];
}

export function extractRuleVariables(fields: RuleFields): UsedVariable[] {
  const varMap = new Map<string, Set<string>>();

  const add = (name: string, location: string) => {
    const existing = varMap.get(name);
    if (existing) existing.add(location);
    else varMap.set(name, new Set([location]));
  };

  for (const name of extractVarNames(fields.headerName)) add(name, 'headerName');
  for (const name of extractVarNames(fields.headerValue)) add(name, 'headerValue');
  for (const name of extractVarNames(fields.prefix)) add(name, 'prefix');
  for (const name of extractVarNames(fields.suffix)) add(name, 'suffix');
  for (const domain of fields.domains) {
    for (const name of extractVarNames(domain)) add(name, `domain:${domain}`);
  }

  return [...varMap.entries()].map(([name, locations]) => ({
    name,
    usedIn: [...locations],
  }));
}
