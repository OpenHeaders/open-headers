/**
 * Self-signed h2-ALPN TLS terminator for the E8 verify-off leg: accepts
 * TLS on `tlsPort`, pipes raw bytes to the h2c gRPC probe on
 * `targetPort`. A client verifying against the system roots must
 * REJECT the handshake; with verification off the call round-trips.
 *
 * The fixture pair is the S6 transport-test cert (CN/SAN 127.0.0.1,
 * 100-year expiry) — test data only, never trusted anywhere else.
 */

import net from 'node:net';
import tls from 'node:tls';

const SELF_SIGNED_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDDDDQqwCVx00Yf
xgcPjYjk3bf6LUo/0wcCO6LEOwHXg93l5BBfhi1mOCaECumswwlgv7cRgIgYGoKQ
sQE+FmovHu+8f4hbv5mXTVNkk9aoSCtX9r1/EbXkzFbSTQBbykVNWiA5+dKjCher
XU47BCv3dRZF6GIFQxLS1n3uif8LMYoCJjfATyVOd/ECkQpZsaZwqdCFHYkIkqVt
jGlI8urskMTGX/RPyWnQWkgropJig1z776kuYuGgetomtko1TDg8jOqTDPSc181f
9o5XD4zTeTeQgeN87CthPd6NTUlXhoGXuzjEg164aSzHGyzXqr5hqGyNC7sd+rsD
uGHckt5NAgMBAAECggEAArkh5VLncu5jNUBbiuEL/z4FOo31UmzM1UAl5p14Sh0C
NRp5DAxgh+PSzdclKg9TCzHCCZGE1OlR11lRTh+b/eptqHETY0yKhW1D88yIm7Le
QA0m2iZSJs6fi7IdhiqNyyWt+4E8aqBSckcMN5C4WG0fEXzMGYy1L5JlEbaFhA93
urBd0p1y5rQUgR8rdSWTEUJ+dvb5XqQ+IMvFMLfgKMH7/lD/Hp1XAmj0AZSfvOSO
+qP5gjU5uLk8TD0OxcwNH0TuKSoYgRJyJ8LNKEgEKjBUbcaarul21L5aMEZITDC9
z3/YDKPqVq0KqGQc6R8bftUAw49MzMFSKFokJWQWdQKBgQD4HY4bO3aqF7fxoWuf
kTmjnh2vqfwTjdeRsjefMN94HQLozngPjlBpmqP2CdCWYB+oYJ/ZwWzO98SupJXJ
1vtBY99mkt74mkUFY2Yp3/zcHU+NfSkwgU4Y8liP5NTdz0tx+EpDbZcf3yh93/1D
pIUrAv+wRLKIw0gbrZxVU1FDBwKBgQDJPu/R0oyEH9AqsGpcbPiminyJpUo2otkU
AC+VFCP9Z7cOhlE/yyLu7vAegMUGfxbNK/jBqk7Ih/06e99PKuLAwkfVq50mfWlP
V8juX811ns1xh7nvRXBCf1n+vricFPMoLRt4s4pT8lOdb28+MBBrYMIHYujnW4DY
gNUf+NLbCwKBgEaxnRjTQ4dJRMbbGGAZr9OXrJutkj48DuzbW4/HDBUcJwUQNxMv
mGfOgOMMftspvjtqdIFF5GvAGtEr4eXllCdYfoGqXU92HS5g2O4bfN92loEY5VCF
tyvSeTteluwwMS3i8b3ujr2tBst+s5m/WZYcv5+Io1nmUjhYqg+BssinAoGAOJpE
F67xqMPN6APglohr02PGLWzZF87r4Y0/1N1qVf7S5PnwZlH7TFrWHK45PF+IiUKh
387IA+0D02w93eWBC5hZXga717SUZyWYtTsq7bcxr4nuSRctwPZS2KzJ/dSCo700
KdnNwVi6HeDW2BXquFjpmew+97ur3Lk3uJtiqwsCgYEAr1N/tBbH2hA2tSx/U/0g
raCxlPhvse9Cj4TgIcO75Qz99B2bEsvFd6ZShRxzh26Tj5U+w3MAdmLbe0fWpXDE
BKD92prib0vgFPyZ4QdugfbPzs25bg4gSTQxviUkqlOJ51ygtCsmjblMpfOgqBp/
/uy3x6xVazoDcMYMJb4JUPY=
-----END PRIVATE KEY-----`;

const SELF_SIGNED_CERT = `-----BEGIN CERTIFICATE-----
MIIDJzCCAg+gAwIBAgIUYeq6SMGrvTGMEnrUHEMIdoHLo6QwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMCAXDTI2MDcxNzA4MTQyM1oYDzIxMjYw
NjIzMDgxNDIzWjAUMRIwEAYDVQQDDAkxMjcuMC4wLjEwggEiMA0GCSqGSIb3DQEB
AQUAA4IBDwAwggEKAoIBAQDDDDQqwCVx00YfxgcPjYjk3bf6LUo/0wcCO6LEOwHX
g93l5BBfhi1mOCaECumswwlgv7cRgIgYGoKQsQE+FmovHu+8f4hbv5mXTVNkk9ao
SCtX9r1/EbXkzFbSTQBbykVNWiA5+dKjCherXU47BCv3dRZF6GIFQxLS1n3uif8L
MYoCJjfATyVOd/ECkQpZsaZwqdCFHYkIkqVtjGlI8urskMTGX/RPyWnQWkgropJi
g1z776kuYuGgetomtko1TDg8jOqTDPSc181f9o5XD4zTeTeQgeN87CthPd6NTUlX
hoGXuzjEg164aSzHGyzXqr5hqGyNC7sd+rsDuGHckt5NAgMBAAGjbzBtMB0GA1Ud
DgQWBBShiaGXNlBoiofmZPdCFkXNxVM1rjAfBgNVHSMEGDAWgBShiaGXNlBoiofm
ZPdCFkXNxVM1rjAPBgNVHRMBAf8EBTADAQH/MBoGA1UdEQQTMBGHBH8AAAGCCWxv
Y2FsaG9zdDANBgkqhkiG9w0BAQsFAAOCAQEAX31x2DeQGgRUMSLfiWwQ/pd5nOTr
gvWeCUCMdjeSAD+2Jb4kbLa5f1FQQRPtlP7UPL/YvRPhd7E77I4vNshvelbSIlsj
YlG8QnNgf5/voGRvPjM3zAsw2RXioJ1m93OTSQO41mNhbOsCW064P5zx+NfVCpOl
AObp885gq0Q9lpQMUH+KhLle7No2KRznvpS97FCaMo6jI8460AuTCvAsDQ9M4NsM
NUQJ3Oxn7CJkys1GEUb7wHVnkYTG0P1ftJw0c51vRYQDfT7nHe1CetbrJoh1acP5
KfxyzWrzAL8PG19NaZob/0EuYlX0UvfHNDflMMDwVEJDmafFC9vqkk6OYQ==
-----END CERTIFICATE-----`;

export function startGrpcTlsTerminator(tlsPort: number, targetPort: number): Promise<tls.Server> {
  const server = tls.createServer({ key: SELF_SIGNED_KEY, cert: SELF_SIGNED_CERT, ALPNProtocols: ['h2'] }, (socket) => {
    const upstream = net.connect(targetPort, '127.0.0.1');
    socket.pipe(upstream);
    upstream.pipe(socket);
    const drop = (): void => {
      socket.destroy();
      upstream.destroy();
    };
    socket.on('error', drop);
    upstream.on('error', drop);
    socket.on('close', () => upstream.destroy());
    upstream.on('close', () => socket.destroy());
  });
  return new Promise((resolve) => {
    server.listen(tlsPort, '127.0.0.1', () => resolve(server));
  });
}
