/**
 * Transport client for the OpenHeaders trust helper — the signed
 * SMAppService privileged daemon that manages System-keychain (admin
 * domain) trust for the proxy CA (PROXY_SECURITY.md §2.6 amendment).
 *
 * The helper is a dual-mode binary embedded next to the app executable
 * (`Contents/MacOS/oh-trust-helper`). This module only spawns its
 * client verbs and parses their single-JSON-object stdout; keychain
 * semantics (idempotency, residue, verification) stay in
 * `trust-macos.ts` where the trust laws are tested. Availability is a
 * live probe on every ask — an unsigned/dev build has no binary (or an
 * unregistered helper) and answers unavailable, which keeps the
 * System-keychain option honestly gated off.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';

export interface SystemTrustHelperProbe {
  available: boolean;
  reason?: string;
}

export interface SystemTrustHelperInstallReply {
  ok: boolean;
  error?: string;
  code?: number;
  stderr?: string;
}

export interface SystemTrustHelperRemoveReply {
  ok: boolean;
  error?: string;
  untrustCode?: number;
  untrustStderr?: string;
  deleteCode?: number;
  deleteStderr?: string;
}

export interface SystemTrustHelper {
  probe(): Promise<SystemTrustHelperProbe>;
  install(certPem: string): Promise<SystemTrustHelperInstallReply>;
  remove(certPem: string, fingerprintSha1: string): Promise<SystemTrustHelperRemoveReply>;
}

/** The embedded helper sits beside the app executable in the bundle. */
export function defaultSystemTrustHelperPath(): string | null {
  if (process.platform !== 'darwin') return null;
  const candidate = path.join(path.dirname(process.execPath), 'oh-trust-helper');
  return existsSync(candidate) ? candidate : null;
}

interface HelperRun {
  code: number;
  stdout: string;
  stderr: string;
  spawnError?: string;
}

function runHelper(binaryPath: string, args: readonly string[], stdin?: string): Promise<HelperRun> {
  return new Promise((resolve) => {
    const child = spawn(binaryPath, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', (err) => {
      resolve({ code: 127, stdout: '', stderr: '', spawnError: err.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
    if (stdin !== undefined) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

function parseReply(run: HelperRun): Record<string, unknown> | null {
  if (run.spawnError !== undefined) return null;
  try {
    const parsed: unknown = JSON.parse(run.stdout.trim());
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/**
 * Client over the embedded binary. `binaryPath` null (no helper in
 * this build / not macOS) answers unavailable to every ask.
 */
export function createSystemTrustHelper(binaryPath: string | null = defaultSystemTrustHelperPath()): SystemTrustHelper {
  async function probe(): Promise<SystemTrustHelperProbe> {
    if (binaryPath === null) return { available: false, reason: 'helper not present in this build' };
    const run = await runHelper(binaryPath, ['status']);
    const reply = parseReply(run);
    if (reply === null) {
      return { available: false, reason: run.spawnError ?? 'helper produced no parseable answer' };
    }
    if (reply.available !== true) {
      return { available: false, ...(str(reply.reason) !== undefined ? { reason: str(reply.reason) } : {}) };
    }
    return { available: true };
  }

  async function install(certPem: string): Promise<SystemTrustHelperInstallReply> {
    if (binaryPath === null) return { ok: false, error: 'helper not present in this build' };
    const run = await runHelper(binaryPath, ['install'], certPem);
    const reply = parseReply(run);
    if (reply === null) return { ok: false, error: run.spawnError ?? 'helper produced no parseable answer' };
    if (reply.ok !== true) return { ok: false, error: str(reply.error) ?? 'helper refused' };
    return {
      ok: true,
      ...(num(reply.code) !== undefined ? { code: num(reply.code) } : {}),
      ...(str(reply.stderr) !== undefined ? { stderr: str(reply.stderr) } : {}),
    };
  }

  async function remove(certPem: string, fingerprintSha1: string): Promise<SystemTrustHelperRemoveReply> {
    if (binaryPath === null) return { ok: false, error: 'helper not present in this build' };
    const run = await runHelper(binaryPath, ['remove', fingerprintSha1], certPem);
    const reply = parseReply(run);
    if (reply === null) return { ok: false, error: run.spawnError ?? 'helper produced no parseable answer' };
    if (reply.ok !== true) return { ok: false, error: str(reply.error) ?? 'helper refused' };
    return {
      ok: true,
      ...(num(reply.untrustCode) !== undefined ? { untrustCode: num(reply.untrustCode) } : {}),
      ...(str(reply.untrustStderr) !== undefined ? { untrustStderr: str(reply.untrustStderr) } : {}),
      ...(num(reply.deleteCode) !== undefined ? { deleteCode: num(reply.deleteCode) } : {}),
      ...(str(reply.deleteStderr) !== undefined ? { deleteStderr: str(reply.deleteStderr) } : {}),
    };
  }

  return { probe, install, remove };
}
