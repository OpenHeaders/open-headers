/**
 * Loopback `/healthz` probe — `oh daemon status` and the show-token
 * single-writer guard. Loopback always answers regardless of the
 * configured bind (`0.0.0.0` includes it), so the probe never needs
 * the LAN address.
 */

export async function probeHealthz(port: number, timeoutMs = 2000): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok;
  } catch {
    return false;
  }
}
