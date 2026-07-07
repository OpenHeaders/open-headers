/**
 * Write-tier import tool — `requests_import`. Reuses the canonical
 * `@openheaders/core/import` parsers verbatim (the same ones the
 * Workbench import modals ride) and commits every parsed request
 * through the identical create path as `requests_save`: canonical
 * schema parse, host-minted identity, ensure-on-demand default
 * collection, `applySyncRequest` batch.
 *
 * Scope decisions (v1):
 *   - Formats: `curl` and `har`. There is no native collection-export
 *     JSON parse surface yet — the workspace export is a different,
 *     workspace-level format with its own import orchestrator — so a
 *     native format is deliberately absent rather than half-wired.
 *   - The Workbench modals' import-report persistence + re-import-diff
 *     machinery is a UI enhancement layer; the MCP result carries the
 *     parse report's drops/transforms inline instead.
 *   - HAR imports are capped per call, never silently: entries beyond
 *     the cap are counted and the result says how to select them.
 */

import {
  CurlParseError,
  type CurlRequest,
  HarParseError,
  type ImportReport,
  parseCurl,
  parseHar,
  selectHarEntries,
} from '@openheaders/core/import';
import { RequestSchema } from '@openheaders/core/schemas';
import { buildAddBatch as buildAddRequestBatch } from '@openheaders/core/sync-builders/mutations/request-mutations';
import { generateUid, toFolderName } from '@openheaders/core/utils';
import { type McpToolDefinition, McpToolInputError } from '../registry';
import {
  applyMcpMutation,
  mintMcpContext,
  parseOrThrow,
  requireStringArg,
  requireWorkspace,
  WORKSPACE_ID_PROPERTY,
} from './common';
import { resolveRequestParentPath } from './write-tools';

/** Per-call ceiling on HAR entries — captures are noisy; agents pick
 *  specific entries via `entryIndices` instead of bulk-landing pages
 *  of favicon/analytics rows. */
const HAR_ENTRY_CAP = 50;

const NOTE_CAP = 10;

/** Flatten the parse report's drops + transforms into agent-readable lines. */
function reportNotes(report: ImportReport): string[] {
  const lines = [
    ...report.drops.map((drop) => `dropped ${drop.path}: ${drop.reason}`),
    ...report.transforms.map((t) => `transformed ${t.path}: ${t.from} → ${t.to} (${t.reason})`),
  ];
  if (lines.length > NOTE_CAP) {
    return [...lines.slice(0, NOTE_CAP), `… ${lines.length - NOTE_CAP} more`];
  }
  return lines;
}

interface ParsedImport {
  requests: CurlRequest[];
  notes: string[];
  /** HAR entries beyond {@link HAR_ENTRY_CAP}, dropped with a count. */
  skippedOverCap: number;
}

function parseCurlContent(content: string): ParsedImport {
  try {
    const { request, report } = parseCurl(content.trim());
    return { requests: [request], notes: reportNotes(report), skippedOverCap: 0 };
  } catch (err) {
    if (err instanceof CurlParseError) {
      throw new McpToolInputError(`could not parse curl command: ${err.message}`);
    }
    throw err;
  }
}

function parseHarContent(content: string, entryIndices: unknown): ParsedImport {
  let result: ReturnType<typeof parseHar>;
  try {
    result = parseHar(content);
  } catch (err) {
    if (err instanceof HarParseError) {
      throw new McpToolInputError(`could not parse HAR: ${err.message}`);
    }
    throw err;
  }
  if (entryIndices !== undefined) {
    if (!Array.isArray(entryIndices) || entryIndices.some((i) => typeof i !== 'number')) {
      throw new McpToolInputError("'entryIndices' must be an array of entry indices");
    }
    result = selectHarEntries(result, entryIndices as number[]);
  }
  if (result.entries.length === 0) {
    throw new McpToolInputError(
      entryIndices !== undefined
        ? "'entryIndices' matched no entries in this HAR"
        : 'no importable entries in this HAR',
    );
  }
  const skippedOverCap = Math.max(0, result.entries.length - HAR_ENTRY_CAP);
  return {
    requests: result.entries.slice(0, HAR_ENTRY_CAP).map((entry) => entry.request),
    notes: reportNotes(result.report),
    skippedOverCap,
  };
}

export function createImportToolDefinitions(): McpToolDefinition[] {
  return [
    {
      name: 'requests_import',
      title: 'Import API requests',
      description:
        "Import saved requests from a curl command or a HAR capture. format: 'curl' parses one command " +
        "(the flags browser DevTools' copy-as-curl emits) into one saved request; format: 'har' parses a " +
        `HAR 1.2 capture into one saved request per entry (malformed entries are skipped and reported, at ` +
        `most ${HAR_ENTRY_CAP} entries per call — pass entryIndices to pick specific entries). Imported ` +
        'requests land in the target collection like requests_save creates; importing never sends traffic.',
      inputSchema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['curl', 'har'] },
          content: { type: 'string', description: 'The curl command or HAR file text.' },
          entryIndices: {
            type: 'array',
            items: { type: 'number' },
            description: 'HAR only: import just these entry indices (0-based, in capture order).',
          },
          collectionUid: {
            type: 'string',
            description: 'Target request collection. Omit to use (or mint) the default collection.',
          },
          ...WORKSPACE_ID_PROPERTY,
        },
        required: ['format', 'content'],
        additionalProperties: false,
      },
      tier: 'write',
      resolveWorkspaceId: (args) => {
        const raw = args.workspaceId;
        return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
      },
      handler: async (args) => {
        const workspaceId = requireWorkspace(args);
        const format = requireStringArg(args, 'format');
        const content = requireStringArg(args, 'content');
        if (format !== 'curl' && format !== 'har') {
          throw new McpToolInputError("'format' must be 'curl' or 'har'");
        }
        if (format === 'curl' && args.entryIndices !== undefined) {
          throw new McpToolInputError("'entryIndices' only applies to format: 'har'");
        }
        const parsed = format === 'curl' ? parseCurlContent(content) : parseHarContent(content, args.entryIndices);

        const parentPath = await resolveRequestParentPath(
          workspaceId,
          typeof args.collectionUid === 'string' ? args.collectionUid : undefined,
        );
        const created: Array<{ uid: string; name: string; method: string; url: string }> = [];
        for (const seed of parsed.requests) {
          const uid = generateUid();
          const name = seed.name.trim() || 'Untitled Request';
          const request = parseOrThrow(
            RequestSchema,
            {
              method: seed.method,
              url: seed.url,
              headers: seed.headers,
              params: seed.params,
              auth: seed.auth,
              body: seed.body,
              name,
              schemaVersion: 5,
              uid,
              path: `${parentPath}/${toFolderName(name, uid)}`,
            },
            'request',
          );
          await applyMcpMutation(buildAddRequestBatch(request, mintMcpContext(workspaceId)));
          created.push({ uid: request.uid, name: request.name, method: request.method, url: request.url });
        }
        return {
          workspaceId,
          created,
          ...(parsed.notes.length > 0 ? { notes: parsed.notes } : {}),
          ...(parsed.skippedOverCap > 0
            ? {
                skippedOverCap: parsed.skippedOverCap,
                hint: `only the first ${HAR_ENTRY_CAP} entries were imported — pass entryIndices to select others`,
              }
            : {}),
        };
      },
    },
  ];
}
