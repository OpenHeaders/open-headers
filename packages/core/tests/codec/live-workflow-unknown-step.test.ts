/**
 * `workflow.yaml` with steps this build does not know (the workflow
 * runs plan, Laws — "A reader assumes only `uid`, `id` and `action`").
 *
 * The file is read, and written back as it was — whether the workflow
 * came from the file or reached the engine by sync, where no captured
 * field rows ride beside it.
 */

import { describe, expect, it } from 'vitest';
import { parseLiveWorkflow, serializeLiveWorkflow } from '../../src/codec/yaml/live-workflow';
import { unknownFieldsOf } from '../../src/codec/yaml/unknown-fields';
import { isUnknownStep } from '../../src/live/unknown-step';
import { makeParsed, mergePatch } from '../../src/schemas/document';

const PATH = 'live-workflows/reboot-wfdevice';

const FILE = `schemaVersion: 5
uid: wfdevice
name: Reboot
enabled: true
refresh:
  kind: manual
steps:
  - uid: stplistn
    id: probe
    action: listen
    session: mqttreq1
  - uid: stpcall0
    id: reboot
    requestUid: httpreq1
    captures:
      - uid: capcmd00
        name: commandId
        extractor:
          kind: json-path
          path: $.id
  - uid: stpexpct
    id: status
    action: expect
    on: probe
    after: reboot
    address: devices/dev-1/status
    match:
      - extractor:
          kind: json-path
          path: $.state
        equals: rebooting
    captures: []
`;

describe('workflow.yaml with steps this build does not know', () => {
  it('is read, the unknown steps kept as written', () => {
    const { value } = parseLiveWorkflow(FILE, { path: PATH });
    expect(value.steps.map(isUnknownStep)).toEqual([true, false, true]);
    expect(value.steps[0]).toEqual({ uid: 'stplistn', id: 'probe', action: 'listen', session: 'mqttreq1' });
    expect(value.steps[2]).toEqual({
      uid: 'stpexpct',
      id: 'status',
      action: 'expect',
      on: 'probe',
      after: 'reboot',
      address: 'devices/dev-1/status',
      match: [{ extractor: { kind: 'json-path', path: '$.state' }, equals: 'rebooting' }],
      captures: [],
    });
  });

  it('captures nothing beneath an unknown step — its value carries its keys', () => {
    expect(unknownFieldsOf(parseLiveWorkflow(FILE, { path: PATH }))).toEqual([]);
  });

  it('is written back byte for byte', () => {
    const parsed = parseLiveWorkflow(FILE, { path: PATH });
    expect(serializeLiveWorkflow(mergePatch(parsed, () => {}))).toBe(FILE);
  });

  it('is written whole for a workflow that reached the engine by sync', () => {
    const { value } = parseLiveWorkflow(FILE, { path: PATH });
    const synced = makeParsed(structuredClone(value), []);
    expect(serializeLiveWorkflow(mergePatch(synced, () => {}))).toBe(FILE);
  });

  it('mints a missing uid on the step and touches nothing beneath it', () => {
    const handWritten = FILE.replace('  - uid: stpexpct\n    id: status', '  - id: status').replace(
      '    captures: []\n',
      '    captures:\n      - name: state\n',
    );
    const { value } = parseLiveWorkflow(handWritten, { path: PATH });
    const [, , expectStep] = value.steps;
    expect(expectStep.uid).toMatch(/^[a-z0-9]{8}$/);
    expect(expectStep).toMatchObject({ action: 'expect', captures: [{ name: 'state' }] });
  });

  it('still mints the uids of a call step beside one', () => {
    const { value } = parseLiveWorkflow(FILE.replace('      - uid: capcmd00\n        name', '      - name'), {
      path: PATH,
    });
    const [, call] = value.steps;
    expect(isUnknownStep(call) ? null : call.captures[0].uid).toMatch(/^[a-z0-9]{8}$/);
  });
});
