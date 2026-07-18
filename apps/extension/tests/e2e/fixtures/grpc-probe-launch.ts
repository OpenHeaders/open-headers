/**
 * E2e launcher for the playground gRPC probe — the grpc-forwarded spec
 * spawns this under tsx so the daemon has a REAL BookService endpoint
 * to egress against (the probe imports `@openheaders/core/proto`
 * source, which the Playwright loader can't resolve in-process).
 *
 * Prints `grpc-probe-ready <port>` once listening; the spec waits for
 * that line before running any leg.
 */

import { startGrpcProbe } from '../../../../../playground/server/grpc-probe';

const port = Number(process.env.OH_E2E_GRPC_PORT ?? 3230);
const server = startGrpcProbe(port);
server.on('listening', () => {
  console.log(`grpc-probe-ready ${port}`);
});
