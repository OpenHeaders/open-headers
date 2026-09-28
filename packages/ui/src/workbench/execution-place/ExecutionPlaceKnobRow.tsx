/**
 * ExecutionPlaceKnobRow — the Runs on row of a request's Settings tab,
 * the second door to the same device-local value the place button
 * edits: Automatic, then the places THIS HOST knows in the popover's
 * order and words (Browser extension · Desktop app · Server on a
 * browser surface; Desktop app · Server on the desktop app; Server in
 * a served tab). Every request kind's Settings tab renders this one
 * row (HTTP / GraphQL in the Execution group, the session tabs in
 * Connection), each with its own kind's info popover; a container's
 * section never does — a place is this device's, saved with the
 * request, never a collection's or folder's knob.
 */

import { EXECUTION_PLACE_ROLES } from '@openheaders/core/schemas';
import type { ExecutionPlaceRole } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import { getCurrentHost } from '@openheaders/ui/shared/host-vocabulary';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { SelectKnobRow } from '@openheaders/ui/shared/settings-rows';
import type React from 'react';
import { executionPlaceRosterLabel } from './execution-place-copy';
import { executionPlaceRosterRoles } from './resolve-execution-place';

/** The first option's value — never stored; picking it clears the knob. */
const AUTOMATIC = 'automatic';

const isExecutionPlaceRole = (value: string | undefined): value is ExecutionPlaceRole =>
  value !== undefined && (EXECUTION_PLACE_ROLES as readonly string[]).includes(value);

interface ExecutionPlaceKnobRowProps {
  /** The request's own place; undefined = Automatic, which the select
   *  reads as its selected first option (the Script mode row's always-
   *  set idiom — no clear cross; the dot and the reset arrow mark a
   *  role, and the reset returns to Automatic). */
  value: ExecutionPlaceRole | undefined;
  onChange: (next: ExecutionPlaceRole | undefined) => void;
  /** The kind's own (i) content — its example card with the route lit. */
  info: InfoPopoverContent;
  testId: string;
  unsaved?: boolean;
}

const ExecutionPlaceKnobRow: React.FC<ExecutionPlaceKnobRowProps> = ({ value, onChange, info, testId, unsaved }) => {
  const t = useT();
  return (
    <SelectKnobRow
      label={t('workbench.editors.request.settings.executionPlace')}
      value={value ?? AUTOMATIC}
      onChange={(next) => onChange(isExecutionPlaceRole(next) ? next : undefined)}
      modified={value !== undefined}
      onReset={() => onChange(undefined)}
      allowClear={false}
      info={info}
      options={[
        { value: AUTOMATIC, label: t('workbench.editors.request.settings.executionPlacePlaceholder') },
        ...executionPlaceRosterRoles(getCurrentHost()).map((role) => ({
          value: role,
          label: executionPlaceRosterLabel(role, t),
        })),
      ]}
      testId={testId}
      unsaved={unsaved}
    />
  );
};

export default ExecutionPlaceKnobRow;
