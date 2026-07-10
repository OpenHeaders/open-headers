/**
 * mDNS advertiser transport (Phase 6 discovery) — the `node:dgram`
 * lifecycle around the pure responder core: bind the mDNS port with
 * address reuse (the platform responder — mDNSResponder, avahi — holds
 * it too; both receive every multicast), join the IPv4 mDNS group on
 * each LAN interface, announce on start, answer matching queries, and
 * send a goodbye on stop so peer caches drop the instance immediately.
 *
 * Driven by `setAdvertisedPort(port | null)` from the boot spine's bind
 * lifecycle: a port advertises, null withdraws. Transitions are
 * serialized through an internal queue (same discipline as the bind
 * supervisor) so a rapid rebind can't race two sockets onto the group.
 *
 * Outbound traffic is link-local multicast only (224.0.0.251, TTL 255
 * per RFC 6762 §11) — nothing leaves the LAN, so the daemon's
 * zero-outbound posture holds. A failure to bind the mDNS port is
 * logged and leaves discovery off; it never affects the daemon itself.
 */

import * as dgram from 'node:dgram';
import * as os from 'node:os';
import { hostLogger as logger } from '@openheaders/core/logger';
import { listLanIpv4Addresses } from '../lan-addresses';
import { encodeDnsResponse, parseDnsQuery } from './dns-wire';
import { announcementRecords, answerQuestions, goodbyeRecords, type ServiceAdvertisement } from './responder-core';

const SCOPE = 'MdnsAdvertiser';

const MDNS_GROUP = '224.0.0.251';
const MDNS_PORT = 5353;
/** RFC 6762 §8.3 — announce twice, one second apart. */
const ANNOUNCE_REPEATS = 2;
const ANNOUNCE_INTERVAL_MS = 1000;

export interface MdnsAdvertiserOptions {
  /** TXT entries published on the instance (`key=value`), e.g. the daemon version. */
  readonly textEntries: readonly string[];
}

export interface MdnsAdvertiser {
  /** Advertise the service on `port`, or withdraw when null. Idempotent per value. */
  setAdvertisedPort(port: number | null): void;
  /** Withdraw (goodbye) and close. Idempotent. */
  dispose(): Promise<void>;
}

/**
 * The OS hostname's first label, lower-cased — the platform responder
 * already keeps the hostname LAN-unique, so this responder skips RFC
 * 6762 probing and rides that uniqueness for its instance name too.
 */
function hostInstanceLabel(): string {
  let raw: string;
  try {
    raw = os.hostname();
  } catch {
    raw = '';
  }
  const label = raw.split('.')[0]?.trim().toLowerCase() ?? '';
  return label !== '' ? label : 'openheaders-daemon';
}

interface ActiveSocket {
  readonly socket: dgram.Socket;
  readonly advertisement: ServiceAdvertisement;
  announceTimer: NodeJS.Timeout | null;
}

export function createMdnsAdvertiser(options: MdnsAdvertiserOptions): MdnsAdvertiser {
  let desiredPort: number | null = null;
  let active: ActiveSocket | null = null;
  let inflight: Promise<void> = Promise.resolve();
  let disposed = false;

  function buildAdvertisement(port: number): ServiceAdvertisement {
    return {
      instanceLabel: hostInstanceLabel(),
      port,
      ipv4Addresses: listLanIpv4Addresses().map((a) => a.host),
      textEntries: options.textEntries,
    };
  }

  function send(socket: dgram.Socket, payload: Buffer, port: number, address: string): void {
    socket.send(payload, port, address, (err) => {
      if (err) logger.debug(SCOPE, `send to ${address}:${port} failed`, err);
    });
  }

  function respond(entry: ActiveSocket, message: Buffer, rinfo: dgram.RemoteInfo): void {
    const questions = parseDnsQuery(message);
    if (questions === null) return;
    // Addresses re-resolve per answer so an interface change after start
    // is reflected without a rebind of the mDNS socket.
    const advertisement: ServiceAdvertisement = {
      ...entry.advertisement,
      ipv4Addresses: listLanIpv4Addresses().map((a) => a.host),
    };
    const answers = answerQuestions(questions, advertisement);
    if (answers.length === 0) return;
    const payload = encodeDnsResponse(answers);
    send(entry.socket, payload, MDNS_PORT, MDNS_GROUP);
    // Legacy unicast query (RFC 6762 §6.7): a querier not on the mDNS
    // port can't hear the multicast reply — answer it directly too.
    if (rinfo.port !== MDNS_PORT) send(entry.socket, payload, rinfo.port, rinfo.address);
  }

  function announce(entry: ActiveSocket): void {
    const payload = encodeDnsResponse(announcementRecords(entry.advertisement));
    let remaining = ANNOUNCE_REPEATS;
    const tick = (): void => {
      send(entry.socket, payload, MDNS_PORT, MDNS_GROUP);
      remaining -= 1;
      entry.announceTimer = remaining > 0 ? setTimeout(tick, ANNOUNCE_INTERVAL_MS) : null;
    };
    tick();
  }

  async function open(port: number): Promise<void> {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const advertisement = buildAdvertisement(port);
    const entry: ActiveSocket = { socket, advertisement, announceTimer: null };
    try {
      await new Promise<void>((resolve, reject) => {
        socket.once('error', reject);
        socket.bind(MDNS_PORT, () => {
          socket.removeListener('error', reject);
          resolve();
        });
      });
      socket.setMulticastTTL(255);
      socket.setMulticastLoopback(true);
      const joined = new Set<string>();
      for (const address of advertisement.ipv4Addresses) {
        try {
          socket.addMembership(MDNS_GROUP, address);
          joined.add(address);
        } catch (err) {
          logger.debug(SCOPE, `multicast join on ${address} failed`, err);
        }
      }
      if (joined.size === 0) socket.addMembership(MDNS_GROUP);
    } catch (err) {
      logger.warn(SCOPE, 'mDNS socket failed to start; LAN discovery is off', err);
      socket.close();
      return;
    }
    socket.on('error', (err) => {
      logger.warn(SCOPE, 'mDNS socket error', err);
    });
    socket.on('message', (message, rinfo) => {
      respond(entry, message, rinfo);
    });
    active = entry;
    announce(entry);
    logger.info(SCOPE, `advertising ${advertisement.instanceLabel} on _openheaders._tcp port ${advertisement.port}`);
  }

  async function close(): Promise<void> {
    const entry = active;
    if (!entry) return;
    active = null;
    if (entry.announceTimer !== null) clearTimeout(entry.announceTimer);
    // Goodbye before close: TTL-0 records evict this instance from peer
    // caches now instead of after the record TTL runs out.
    await new Promise<void>((resolve) => {
      entry.socket.send(encodeDnsResponse(goodbyeRecords(entry.advertisement)), MDNS_PORT, MDNS_GROUP, () => {
        resolve();
      });
    });
    await new Promise<void>((resolve) => {
      entry.socket.close(() => {
        resolve();
      });
    });
  }

  async function reconcile(): Promise<void> {
    if (disposed) {
      await close();
      return;
    }
    if (active && desiredPort !== null && active.advertisement.port === desiredPort) return;
    await close();
    if (desiredPort !== null) await open(desiredPort);
  }

  function schedule(): void {
    inflight = inflight.catch(() => undefined).then(() => reconcile());
  }

  return {
    setAdvertisedPort(port) {
      if (disposed || port === desiredPort) return;
      desiredPort = port;
      schedule();
    },
    async dispose() {
      if (disposed) return;
      disposed = true;
      desiredPort = null;
      schedule();
      await inflight.catch(() => undefined);
    },
  };
}
