/**
 * What the workflow view's step picker offers and hands over: the kinds
 * by the authoring switch, the requests a step can act on, a row's pick,
 * and how a search reads a row.
 */

import {
  matchesStepSearch,
  offeredStepActions,
  offeredStepRequests,
  pickOfRequest,
  type StepPickerChoices,
} from '@openheaders/ui/workbench/components/live/step-picker';
import type { StepRequestChoice } from '@openheaders/ui/workbench/components/live/workflow-step-request-options';
import { describe, expect, it } from 'vitest';

const reboot: StepRequestChoice = {
  uid: 'reqreboo',
  name: 'Reboot dev-1',
  method: 'POST',
  collectionName: 'Devices',
  folderTrail: [],
};
const viewer: StepRequestChoice = {
  uid: 'gqlviewr',
  name: 'Viewer',
  method: 'GQL',
  kind: 'graphql',
  collectionName: null,
  folderTrail: [],
};
const probe: StepRequestChoice = {
  uid: 'mqttreq1',
  name: 'Probe MQTT',
  method: 'MQTT',
  kind: 'mqtt',
  collectionName: 'Devices',
  folderTrail: [],
};

const choices = (sessionAuthoring: boolean): StepPickerChoices => ({
  sessionAuthoring,
  requests: [reboot, viewer],
  sessionRequests: [probe],
});

describe('the step picker’s rows', () => {
  it('offers a call alone until session steps are authored here, then the four kinds in the selector’s order', () => {
    expect(offeredStepActions(false)).toEqual(['call']);
    expect(offeredStepActions(true)).toEqual(['call', 'listen', 'send', 'expect']);
  });

  it('lists the requests a listen opens only where a listen is offered', () => {
    expect(offeredStepRequests(choices(false))).toEqual([reboot, viewer]);
    expect(offeredStepRequests(choices(true))).toEqual([reboot, viewer, probe]);
  });

  it('a request taken is a call on it; a session request, a listen', () => {
    expect(pickOfRequest(reboot)).toEqual({ kind: 'request', uid: 'reqreboo', name: 'Reboot dev-1' });
    expect(pickOfRequest(viewer)).toEqual({ kind: 'request', uid: 'gqlviewr', name: 'Viewer' });
    expect(pickOfRequest(probe)).toEqual({ kind: 'session-request', uid: 'mqttreq1', name: 'Probe MQTT' });
  });

  it('a search holds a row whose words hold what was typed, whatever the case; an empty one holds every row', () => {
    expect(matchesStepSearch('Devices > POST Reboot dev-1', 'reboot')).toBe(true);
    expect(matchesStepSearch('Devices > POST Reboot dev-1', '  DEVICES > post ')).toBe(true);
    expect(matchesStepSearch('Devices > POST Reboot dev-1', 'status')).toBe(false);
    expect(matchesStepSearch('Call', '')).toBe(true);
    expect(matchesStepSearch('Call', '   ')).toBe(true);
  });
});
