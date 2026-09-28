/**
 * ExecutionPlaceKnobRow — the Runs on row of a request's Settings tab,
 * the second door to the same device-local value the place button
 * edits: a picklist of the three roles over `draft.executionPlace`,
 * an empty select reading Automatic. Every request kind's Settings
 * tab renders this one row (HTTP / GraphQL in the Execution group,
 * the session tabs in Connection), each with its own kind's info
 * popover; a container's section never does — a place is this
 * device's, saved with the request, never a collection's or folder's
 * knob.
 */

import { EXECUTION_PLACE_ROLES } from '@openheaders/core/schemas';
import type { ExecutionPlaceRole } from '@openheaders/core/types';
import { useT } from '@openheaders/ui/context/LocaleContext';
import type { InfoPopoverContent } from '@openheaders/ui/shared/info-popover';
import { SelectKnobRow } from '@openheaders/ui/shared/settings-rows';
import type React from 'react';
import { executionPlaceOptionLabel } from './execution-place-copy';

const isExecutionPlaceRole = (value: string | undefined): value is ExecutionPlaceRole =>
  value !== undefined && (EXECUTION_PLACE_ROLES as readonly string[]).includes(value);

interface ExecutionPlaceKnobRowProps {
  /** The request's own place; undefined = Automatic. */
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
      value={value}
      onChange={(next) => onChange(isExecutionPlaceRole(next) ? next : undefined)}
      info={info}
      options={EXECUTION_PLACE_ROLES.map((role) => ({ value: role, label: executionPlaceOptionLabel(role, null, t) }))}
      placeholder={t('workbench.editors.request.settings.executionPlacePlaceholder')}
      testId={testId}
      unsaved={unsaved}
    />
  );
};

export default ExecutionPlaceKnobRow;
