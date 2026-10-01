/**
 * The gates' refusal wording — one line per unresolved reference with
 * its hint, shared by the HTTP send gate and the session kinds' Connect
 * gates and riders (the Secret Providers plan's reason parity): a
 * secret manager's typed failure (authorize, fix the reference, make
 * it available here, connect the desktop app) reads apart from a plain
 * miss on every surface, in the same words.
 *
 * Operational-plane English — the response pane and the rider toast
 * render the message as-is; the keyed hints the editors render live in
 * the UI package off the structured errors.
 */

import type { ResolutionError, UnresolvedReferences } from '@openheaders/core/variables';

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
