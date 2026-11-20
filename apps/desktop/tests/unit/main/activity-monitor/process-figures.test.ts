/**
 * Where a row's figures come from (the activity monitor plan §7, fork
 * 10): with a process reader, every figure and the start time beside
 * them are the reader's and the runtime only names the process; without
 * one, the runtime's own figures stand. What the reader could not read
 * is no figure — never the runtime's in its place.
 */

import type { ProcessReader, ProcessRecord } from '@openheaders/oracle-host-node/process-reader';
import { describe, expect, it } from 'vitest';
import { type RuntimeProcessMetric, readProcessFigures } from '@/main/activity-monitor/process-figures';

const RUNTIME_STARTED = 1_763_625_600_000;
/** The reader's own start instant for the same process — another source, another grain. */
const READER_STARTED = RUNTIME_STARTED - 37;
const MB = 1024 * 1024;

function makeMetric(overrides: Partial<RuntimeProcessMetric> = {}): RuntimeProcessMetric {
  return {
    pid: 4312,
    creationTime: RUNTIME_STARTED,
    type: 'Browser',
    name: undefined,
    serviceName: undefined,
    cumulativeCpuSeconds: 10,
    percentCpu: 3,
    workingSetBytes: 212 * MB,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<ProcessRecord> = {}): ProcessRecord {
  return {
    pid: 4312,
    parentPid: 1,
    startedAt: READER_STARTED,
    name: 'Open Headers',
    cost: { cpuSeconds: 9.5, exitedChildrenCpuSeconds: 0, memoryBytes: 148 * MB },
    ...overrides,
  };
}

function makeReader(records: ProcessRecord[]): ProcessReader {
  return {
    memoryKind: 'footprint',
    read: (pid) => records.find((record) => record.pid === pid) ?? null,
    childPids: () => [],
    terminalPids: () => [],
  };
}

describe('readProcessFigures', () => {
  it('lets the runtime’s own figures stand where the host has no reader', () => {
    expect(readProcessFigures([makeMetric()], null)).toEqual([
      {
        pid: 4312,
        creationTime: RUNTIME_STARTED,
        type: 'Browser',
        name: undefined,
        serviceName: undefined,
        cumulativeCpuSeconds: 10,
        percentCpu: 3,
        memoryBytes: 212 * MB,
      },
    ]);
  });

  it('takes every figure and the start time from the reader, and only the names from the runtime', () => {
    const metric = makeMetric({
      type: 'Utility',
      name: 'openheaders-script-worker',
      serviceName: 'node.mojom.NodeService',
    });
    expect(readProcessFigures([metric], makeReader([makeRecord()]))).toEqual([
      {
        pid: 4312,
        creationTime: READER_STARTED,
        type: 'Utility',
        name: 'openheaders-script-worker',
        serviceName: 'node.mojom.NodeService',
        cumulativeCpuSeconds: 9.5,
        percentCpu: null,
        memoryBytes: 148 * MB,
      },
    ]);
  });

  it('gives a process the reader was refused the cost of no figure — never the runtime’s', () => {
    const [read] = readProcessFigures([makeMetric()], makeReader([makeRecord({ cost: null })]));
    expect(read).toMatchObject({
      pid: 4312,
      creationTime: READER_STARTED,
      cumulativeCpuSeconds: undefined,
      percentCpu: null,
      memoryBytes: null,
    });
  });

  it('has no row for a process that ended between the runtime’s read and the reader’s', () => {
    const reads = readProcessFigures(
      [makeMetric(), makeMetric({ pid: 61_007, type: 'Tab' })],
      makeReader([makeRecord()]),
    );
    expect(reads.map((read) => read.pid)).toEqual([4312]);
  });
});
