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
 * set is a later phase). AsyncAPI runs its census parser: a document
 * that is not an AsyncAPI mapping at all is an error; census issues
 * (unresolved `$ref`s, unknown channels, malformed entries) surface as
 * warnings. Local only: no network, no external linters.
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

import { type AsyncApiIssue, AsyncApiParseError, parseAsyncApi } from '@openheaders/core/asyncapi';
import { OpenApiParseError, parseOpenApi, SCHEMA_ONLY_RESPONSES_DROP_PATH } from '@openheaders/core/import';
import { ProtoParseError, parseProto } from '@openheaders/core/proto';
import type { SpecFormat } from '@openheaders/core/types';
import { useEffect, useRef, useState } from 'react';
import type { LanguageId } from '../../languages/registry';
import { buildAsyncApiOutline } from './asyncapi-outline';
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

/** Census issue → validation-strip line. */
function asyncApiIssueLine(issue: AsyncApiIssue): string {
  const messages: Record<AsyncApiIssue['kind'], string> = {
    'unresolved-ref': 'reference does not resolve',
    'unknown-channel': 'names no known channel',
    'invalid-node': 'malformed entry',
    'unsupported-version': 'unsupported AsyncAPI version',
  };
  return `${issue.scope}: ${messages[issue.kind]} (${issue.reference})`;
}

export function validateSpecSource(content: string, format: SpecFormat): SpecValidationResult {
  if (format === 'asyncapi') {
    try {
      const census = parseAsyncApi(content);
      return { errors: [], warnings: census.issues.map(asyncApiIssueLine) };
    } catch (err) {
      return { errors: [err instanceof AsyncApiParseError ? err.message : errorMessage(err)], warnings: [] };
    }
  }
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
  if (format === 'asyncapi') return buildAsyncApiOutline(content);
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
export function useSpecAnalysis(content: string | null, format: SpecFormat): SpecAnalysis {
  // `content` is null while the tab has no real document yet (the
  // entity is still loading from storage). The FIRST real content
  // analyzes with no delay — synchronously with the render when it's
  // there at mount (a reopened tab paints outlined), immediately in
  // the effect when it arrives later. The idle delay exists to keep
  // TYPING from parsing per keystroke, so it governs edits only.
  const [analysis, setAnalysis] = useState<SpecAnalysis>(() =>
    content === null
      ? { validation: null, outline: null }
      : { validation: validateSpecSource(content, format), outline: buildSpecOutlineGroups(content, format) },
  );
  // Last content actually analyzed; null until the first real content.
  const analyzedRef = useRef<string | null>(content);
  useEffect(() => {
    if (content === null || content === analyzedRef.current) return;
    const run = () => {
      analyzedRef.current = content;
      const validation = validateSpecSource(content, format);
      const outline = buildSpecOutlineGroups(content, format);
      setAnalysis((prev) => ({ validation, outline: outline ?? prev.outline }));
    };
    if (analyzedRef.current === null) {
      run();
      return;
    }
    const timer = setTimeout(run, PARSE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [content, format]);
  return analysis;
}
