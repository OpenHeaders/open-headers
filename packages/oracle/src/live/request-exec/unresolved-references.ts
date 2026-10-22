/**
 * The gates' wording — one line per unresolved reference with its
 * hint, shared by the HTTP send gate and the session kinds' Connect
 * gates and riders (the Secret Providers plan's reason parity): a
 * secret manager's typed failure (authorize, fix the reference, make
 * it available here, connect the desktop app) reads apart from a plain
 * miss on every surface, in the same words.
 *
 * The rule the gates apply is the core resolver's `refusesSend`: a
 * secret manager's typed failure refuses the send; every other miss
 * rides AS WRITTEN and the send carries the list beside its other
 * resolve-time attributions (`sentAsWritten` on the snapshot), the
 * response surface rendering each line as advice.
 *
 * Operational-plane English — the response pane and the rider toast
 * render the message as-is; the keyed hints the editors render live in
 * the UI package off the structured errors.
 */

import type { SentAsWrittenReference } from '@openheaders/core/types';
import { type ResolutionError, refusesSend, type UnresolvedReferences } from '@openheaders/core/variables';

const NO_SECRET_MANAGER_NAMES: ReadonlySet<string> = new Set();

/**
 * One line per error: `{{reference}}: hint`. A secret-manager entry a
 * copy path deliberately kept unresolved is not a miss — its line says
 * its value is resolved only when sending and never enters a copied
 * command.
 */
export function unresolvedReferenceLines(
  errors: Iterable<ResolutionError>,
  secretManagerNamesKeptUnresolved: ReadonlySet<string> = NO_SECRET_MANAGER_NAMES,
): string[] {
  const lines: string[] = [];
  for (const error of errors) {
    const reference = `{{${error.reference}}}`;
    // Explicit `vault.X` or the flat `X` the vault answers first.
    if (
      (error.namespace === 'vault' || error.namespace === null) &&
      secretManagerNamesKeptUnresolved.has(error.variableName)
    ) {
      lines.push(
        `${reference}: a secret manager's value is resolved only when sending and never enters a copied command.`,
      );
      continue;
    }
    lines.push(`${reference}: ${error.hint}`);
  }
  return lines;
}

/** The lead a session Connect gate opens with — the HTTP gate's. */
export const UNRESOLVED_REQUEST_LEAD = 'Request has unresolved variables.';
/** The lead a session rider's refusal opens with — a message typed after the socket opened. */
export const UNRESOLVED_MESSAGE_LEAD = 'Message has unresolved variables.';
/** The lead an MQTT subscription rider's refusal opens with. */
export const UNRESOLVED_SUBSCRIPTION_LEAD = 'Subscription has unresolved variables.';

/** The lead, then every collected reference's line. */
export function unresolvedReferencesMessage(lead: string, unresolved: UnresolvedReferences): string {
  return `${lead} ${unresolvedReferenceLines(unresolved.values()).join(' ')}`;
}

/**
 * The HTTP send gate's refusal for path parameters the URL names and
 * no row fills — the one wording both executors throw; a literal
 * `:name` never reaches the wire. `keys` in path order, non-empty.
 */
export function missingPathParamsMessage(keys: readonly string[]): string {
  const named = keys.map((key) => `:${key}`).join(', ');
  const noun = keys.length === 1 ? 'path parameter' : 'path parameters';
  return `Request has unfilled ${noun}: ${named}. Set a value on the Params tab before sending.`;
}

/** The references a send carries as written — the snapshot's attribution shape. */
export function sentAsWrittenOf(errors: Iterable<ResolutionError>): SentAsWrittenReference[] {
  const notes: SentAsWrittenReference[] = [];
  for (const error of errors) notes.push({ reference: error.reference, hint: error.hint });
  return notes;
}

/**
 * Whether a batch of unresolved references refuses the send — any one
 * of them a secret manager's typed failure. A batch that refuses
 * reads as the gate's message (every reference, the refusing ones
 * beside the plain misses, in the one wording); a batch that does not
 * rides as written, `sentAsWrittenOf` its attribution.
 */
export function batchRefusesSend(unresolved: Iterable<ResolutionError>): boolean {
  for (const error of unresolved) if (refusesSend(error)) return true;
  return false;
}

/**
 * The attribution a send stamps for a batch — the notes when the batch
 * rode as written, nothing when every reference resolved or the batch
 * refused (a refused send carried nothing). The session executors'
 * settle paths read the Connect-time collector through this.
 */
export function sentAsWrittenAttribution(
  unresolved: ReadonlyMap<string, ResolutionError>,
): SentAsWrittenReference[] | undefined {
  if (unresolved.size === 0 || batchRefusesSend(unresolved.values())) return undefined;
  return sentAsWrittenOf(unresolved.values());
}
