/**
 * Main-process half of the `oh.desktop.packageSwitch.*` channels: a
 * classic Windows install switching to the Windows package. This plane
 * joins the three parts of the app's side — what is read of this PC and
 * of the feed (`package-switch-facts`), the rule that judges it
 * (`bootstrap/package-switch-eligibility`) and the start of the installer
 * program (`package-switch`) — and keeps the one state the page shows.
 *
 * The page's opening reads with the package's folder alone; the click
 * reads again with Windows asked too, here, where the page's own answer
 * is never trusted. One switch at a time.
 *
 * An install that is not the classic one answers nothing here: no other
 * install gains a channel.
 */

import type { PackageSwitchState } from '@openheaders/core/bridge';
import { requestQuit } from './bootstrap/lifecycle';
import { type PackageSwitchFacts, packageSwitchEligibility } from './bootstrap/package-switch-eligibility';
import { type PackageSwitchEnd, packageSwitchPlan, startPackageSwitch } from './package-switch';
import { carriedInstallerPath, type PackageSwitchInstall, readPackageSwitchFacts } from './package-switch-facts';
import type { UpdateChannel } from './update-feed';

export interface PackageSwitchRpcOptions {
  /** This install, as its own process knows it. */
  readonly install: PackageSwitchInstall;
  /** `app.getPath('temp')`. */
  readonly tempDir: string;
  /** `process.execPath`. */
  readonly executablePath: string;
  /** `process.pid`. */
  readonly pid: number;
  /** The update channel this install follows now. */
  readonly getChannel: () => UpdateChannel;
  readonly fetch: typeof fetch;
  /** Hands the state to every open window. */
  readonly broadcast: (state: PackageSwitchState) => void;
  readonly log: { info(message: string): void; warn(message: string): void };
  /** Test seams; default to the app's own readers, start and quit. */
  readonly seams?: {
    readonly readFacts?: typeof readPackageSwitchFacts;
    readonly start?: typeof startPackageSwitch;
    readonly quit?: () => void;
  };
}

export interface PackageSwitchRpc {
  /** Answers the two `oh.desktop.packageSwitch.*` channels; undefined for any other type, and off a classic install. */
  dispatch(type: unknown): Promise<PackageSwitchState> | undefined;
}

const WORKING: PackageSwitchState = { phase: 'working' };

interface Judged {
  readonly channel: UpdateChannel;
  readonly facts: PackageSwitchFacts;
}

export function createPackageSwitchRpc(options: PackageSwitchRpcOptions): PackageSwitchRpc {
  const readFacts = options.seams?.readFacts ?? readPackageSwitchFacts;
  const startSwitch = options.seams?.start ?? startPackageSwitch;
  const quit = options.seams?.quit ?? (() => requestQuit({ reason: 'package-switch' }));
  let working = false;
  let lastStop: { readonly code: number | null } | null = null;

  async function judge(askWindows: boolean): Promise<Judged> {
    const channel = options.getChannel();
    const facts = await readFacts(options.install, { channel, askWindows }, { fetch: options.fetch, log: options.log });
    return { channel, facts };
  }

  function idle({ channel, facts }: Judged): PackageSwitchState {
    return {
      phase: 'idle',
      verdict: packageSwitchEligibility(facts),
      channel,
      offeredVersion: facts.offer.state === 'read' ? facts.offer.version : null,
      packageDataDir: facts.packageDir,
      lastStop,
    };
  }

  async function getState(): Promise<PackageSwitchState> {
    if (working) return WORKING;
    const judged = await judge(false);
    // A switch may have begun while this PC was read.
    return working ? WORKING : idle(judged);
  }

  /** The move is over with this install as it was: the page gets its line, and the verdict as it is now. */
  async function stopped(end: PackageSwitchEnd): Promise<void> {
    // Handed over: the app is quitting, and no window is left to tell.
    if (end.outcome === 'handed-over') return;
    lastStop = { code: end.code };
    working = false;
    options.broadcast(idle(await judge(false)));
  }

  async function start(): Promise<PackageSwitchState> {
    if (working) return WORKING;
    working = true;
    try {
      const judged = await judge(true);
      const installer = carriedInstallerPath(options.install);
      if (installer === null || !packageSwitchEligibility(judged.facts).eligible) {
        working = false;
        return idle(judged);
      }
      const started = await startSwitch(
        packageSwitchPlan({
          installer,
          tempDir: options.tempDir,
          executablePath: options.executablePath,
          pid: options.pid,
          classicDir: judged.facts.classicDir,
          channel: judged.channel,
        }),
        { quit, log: options.log },
      );
      if (!started.started) {
        working = false;
        lastStop = { code: null };
        return idle(judged);
      }
      lastStop = null;
      void started.ended.then(stopped).catch((error: unknown) => {
        options.log.warn(`the switch's end could not be told: ${error instanceof Error ? error.message : error}`);
      });
      options.broadcast(WORKING);
      return WORKING;
    } catch (error) {
      working = false;
      throw error;
    }
  }

  return {
    dispatch(type) {
      if (options.install.installKind !== 'nsis') return undefined;
      if (type === 'oh.desktop.packageSwitch.getState') return getState();
      if (type === 'oh.desktop.packageSwitch.start') return start();
      return undefined;
    },
  };
}
