/**
 * Spec source validation — the editor's parse-on-idle plane.
 *
 * `validateSpecSource` dispatches on the spec's format. OpenAPI runs
 * the document through `parseOpenApi` in report-only mode: a parse
 * failure (invalid JSON/YAML, wrong version) is an error; a successful
 * parse surfaces the report's drops as warnings — the document is
 * valid but a generated collection would lose those spots. Protobuf
 * runs the census parser: structural failures are errors, and a
 * parseable document reports clean (import resolution across a file
 * set is a later phase). Local only: no network, no external linters.
 *
 * `useSpecAnalysis` debounces the pure checks behind an idle delay so
 * typing never parses per keystroke (performance law); each idle tick
 * produces the validation result AND the derived outline groups in one
 * pass. The last validation result stays on screen while the next
 * parse is pending; the outline keeps the last GOOD tree when the
 * buffer stops parsing (a half-typed edit shouldn't blank the
 * structure pane).
 *
 * Syntax derives from the file extension (invariant #15) — the
 * `specFileLanguage` / `specFileSyntaxLabel` pair is the single
 * mapping the editor body and header badge share.
 */

import { OpenApiParseError, parseOpenApi, SCHEMA_ONLY_RESPONSES_DROP_PATH } from '@openheaders/core/import';
import { ProtoParseError, parseProto } from '@openheaders/core/proto';
import type { SpecFormat } from '@openheaders/core/types';
import { useEffect, useState } from 'react';
import type { LanguageId } from '../../languages/registry';
import { buildProtoOutline } from './proto-outline';
import { buildSpecOutline, type SpecOutlineNode, specOutlineGroups } from './spec-outline';

export interface SpecValidationResult {
  /** Parse failures — the document does not parse at all. */
  errors: string[];
  /** Report drops — parseable, but these spots would not survive generation. */
  warnings: string[];
}

/** Monaco language for a spec source file, from its extension. */
export function specFileLanguage(fileName: string): LanguageId {
  if (fileName.endsWith('.proto')) return 'protobuf';
  return fileName.endsWith('.json') ? 'json' : 'yaml';
}

/** Header badge label for a spec source file's syntax. */
export function specFileSyntaxLabel(fileName: string): string {
  if (fileName.endsWith('.proto')) return 'PROTO';
  return fileName.endsWith('.json') ? 'JSON' : 'YAML';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function validateSpecSource(content: string, format: SpecFormat): SpecValidationResult {
  if (format === 'protobuf') {
    try {
      parseProto(content);
      return { errors: [], warnings: [] };
    } catch (err) {
      return { errors: [err instanceof ProtoParseError ? err.message : errorMessage(err)], warnings: [] };
    }
  }
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
    return { errors: [err instanceof OpenApiParseError ? err.message : errorMessage(err)], warnings: [] };
  }
}

/** Outline groups for the structure pane, format-dispatched. Null when
 *  the buffer does not parse (caller keeps the last good tree). */
export function buildSpecOutlineGroups(content: string, format: SpecFormat): SpecOutlineNode[] | null {
  if (format === 'protobuf') return buildProtoOutline(content);
  const outline = buildSpecOutline(content);
  return outline === null ? null : specOutlineGroups(outline);
}

/** Idle delay before the buffer re-parses. */
const PARSE_IDLE_MS = 500;

export interface SpecAnalysis {
  /** Latest settled validation, null until the first parse lands. */
  validation: SpecValidationResult | null;
  /** Last GOOD outline groups — held through parse failures so a
   *  half-typed edit doesn't blank the structure pane; null until the
   *  buffer has parsed once. */
  outline: SpecOutlineNode[] | null;
}

/**
 * Debounced analysis of the live buffer — validation and outline from
 * one idle tick, never per keystroke.
 */
export function useSpecAnalysis(content: string, format: SpecFormat): SpecAnalysis {
  const [analysis, setAnalysis] = useState<SpecAnalysis>({ validation: null, outline: null });
  useEffect(() => {
    const timer = setTimeout(() => {
      const validation = validateSpecSource(content, format);
      const outline = buildSpecOutlineGroups(content, format);
      setAnalysis((prev) => ({ validation, outline: outline ?? prev.outline }));
    }, PARSE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [content, format]);
  return analysis;
}
