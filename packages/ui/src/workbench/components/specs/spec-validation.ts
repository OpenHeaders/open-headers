/**
 * Spec source validation — the editor's parse-on-idle plane.
 *
 * `validateSpecSource` runs the document through `parseOpenApi` in
 * report-only mode: a parse failure (invalid JSON/YAML, wrong version)
 * is an error; a successful parse surfaces the report's drops as
 * warnings — the document is valid but a generated collection would
 * lose those spots. Local only: no network, no external linters.
 *
 * `useSpecValidation` debounces the pure check behind an idle delay so
 * typing never parses per keystroke (performance law); the last result
 * stays on screen while the next parse is pending.
 *
 * Syntax derives from the file extension (invariant #15) — the
 * `specFileLanguage` / `specFileSyntaxLabel` pair is the single
 * mapping the editor body and header badge share.
 */

import { OpenApiParseError, parseOpenApi, SCHEMA_ONLY_RESPONSES_DROP_PATH } from '@openheaders/core/import';
import { useEffect, useState } from 'react';
import type { LanguageId } from '../../languages/registry';

export interface SpecValidationResult {
  /** Parse failures — the document does not parse at all. */
  errors: string[];
  /** Report drops — parseable, but these spots would not survive generation. */
  warnings: string[];
}

/** Monaco language for a spec source file, from its extension. */
export function specFileLanguage(fileName: string): LanguageId {
  return fileName.endsWith('.json') ? 'json' : 'yaml';
}

/** Header badge label for a spec source file's syntax. */
export function specFileSyntaxLabel(fileName: string): string {
  return fileName.endsWith('.json') ? 'JSON' : 'YAML';
}

export function validateSpecSource(content: string): SpecValidationResult {
  try {
    // Report-only: the parsed output is discarded, so run the fullest
    // parse — with `responseExamples` off, documented responses record
    // a conversion-mode drop that says nothing about the document. The
    // schema-only-responses aggregate is likewise authoring advice
    // (documentation exists, just no concrete example to mint), not a
    // document problem — the blank scaffold must validate 0/0.
    const result = parseOpenApi(content, { responseExamples: true });
    return {
      errors: [],
      warnings: result.report.drops
        .filter((d) => d.path !== SCHEMA_ONLY_RESPONSES_DROP_PATH)
        .map((d) => `${d.path}: ${d.reason}`),
    };
  } catch (err) {
    const message = err instanceof OpenApiParseError ? err.message : err instanceof Error ? err.message : String(err);
    return { errors: [message], warnings: [] };
  }
}

/** Idle delay before the buffer re-parses. */
const PARSE_IDLE_MS = 500;

/**
 * Debounced validation of the live buffer. Returns `null` until the
 * first parse lands; afterwards always the latest settled result.
 */
export function useSpecValidation(content: string): SpecValidationResult | null {
  const [result, setResult] = useState<SpecValidationResult | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setResult(validateSpecSource(content)), PARSE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [content]);
  return result;
}
