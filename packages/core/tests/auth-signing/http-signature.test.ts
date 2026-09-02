import { constants, createHmac, createPublicKey, generateKeyPairSync, verify as nodeVerify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildHttpSignatureBase,
  contentDigestValue,
  HTTP_SIGNATURE_ALGORITHMS,
  HTTP_SIGNATURE_DEFAULT_COMPONENTS,
  HTTP_SIGNATURE_DEFAULT_LABEL,
  HTTP_SIGNATURE_DERIVED_COMPONENTS,
  type HttpSignatureCredentials,
  type HttpSignatureSignInput,
  isHttpSignatureAlgorithm,
  parseHttpSignatureComponents,
  signHttpMessage,
} from '../../src/auth-signing/index';

// ── RFC 9421 Appendix B — the example keys (B.1) and the test-request
//    message (B.2) every vector below signs. ──

const RFC_RSA_PUBLIC_PEM = [
  '-----BEGIN RSA PUBLIC KEY-----',
  'MIIBCgKCAQEAhAKYdtoeoy8zcAcR874L8cnZxKzAGwd7v36APp7Pv6Q2jdsPBRrw',
  'WEBnez6d0UDKDwGbc6nxfEXAy5mbhgajzrw3MOEt8uA5txSKobBpKDeBLOsdJKFq',
  'MGmXCQvEG7YemcxDTRPxAleIAgYYRjTSd/QBwVW9OwNFhekro3RtlinV0a75jfZg',
  'kne/YiktSvLG34lw2zqXBDTC5NHROUqGTlML4PlNZS5Ri2U4aCNx2rUPRcKIlE0P',
  'uKxI4T+HIaFpv8+rdV6eUgOrB2xeI1dSFFn/nnv5OoZJEIB+VmuKn3DCUcCZSFlQ',
  'PSXSfBDiUGhwOw76WuSSsf1D4b/vLoJ10wIDAQAB',
  '-----END RSA PUBLIC KEY-----',
].join('\n');

const RFC_RSA_PRIVATE_PEM = [
  '-----BEGIN RSA PRIVATE KEY-----',
  'MIIEqAIBAAKCAQEAhAKYdtoeoy8zcAcR874L8cnZxKzAGwd7v36APp7Pv6Q2jdsP',
  'BRrwWEBnez6d0UDKDwGbc6nxfEXAy5mbhgajzrw3MOEt8uA5txSKobBpKDeBLOsd',
  'JKFqMGmXCQvEG7YemcxDTRPxAleIAgYYRjTSd/QBwVW9OwNFhekro3RtlinV0a75',
  'jfZgkne/YiktSvLG34lw2zqXBDTC5NHROUqGTlML4PlNZS5Ri2U4aCNx2rUPRcKI',
  'lE0PuKxI4T+HIaFpv8+rdV6eUgOrB2xeI1dSFFn/nnv5OoZJEIB+VmuKn3DCUcCZ',
  'SFlQPSXSfBDiUGhwOw76WuSSsf1D4b/vLoJ10wIDAQABAoIBAG/JZuSWdoVHbi56',
  'vjgCgkjg3lkO1KrO3nrdm6nrgA9P9qaPjxuKoWaKO1cBQlE1pSWp/cKncYgD5WxE',
  'CpAnRUXG2pG4zdkzCYzAh1i+c34L6oZoHsirK6oNcEnHveydfzJL5934egm6p8DW',
  '+m1RQ70yUt4uRc0YSor+q1LGJvGQHReF0WmJBZHrhz5e63Pq7lE0gIwuBqL8SMaA',
  'yRXtK+JGxZpImTq+NHvEWWCu09SCq0r838ceQI55SvzmTkwqtC+8AT2zFviMZkKR',
  'Qo6SPsrqItxZWRty2izawTF0Bf5S2VAx7O+6t3wBsQ1sLptoSgX3QblELY5asI0J',
  'YFz7LJECgYkAsqeUJmqXE3LP8tYoIjMIAKiTm9o6psPlc8CrLI9CH0UbuaA2JCOM',
  'cCNq8SyYbTqgnWlB9ZfcAm/cFpA8tYci9m5vYK8HNxQr+8FS3Qo8N9RJ8d0U5Csw',
  'DzMYfRghAfUGwmlWj5hp1pQzAuhwbOXFtxKHVsMPhz1IBtF9Y8jvgqgYHLbmyiu1',
  'mwJ5AL0pYF0G7x81prlARURwHo0Yf52kEw1dxpx+JXER7hQRWQki5/NsUEtv+8RT',
  'qn2m6qte5DXLyn83b1qRscSdnCCwKtKWUug5q2ZbwVOCJCtmRwmnP131lWRYfj67',
  'B/xJ1ZA6X3GEf4sNReNAtaucPEelgR2nsN0gKQKBiGoqHWbK1qYvBxX2X3kbPDkv',
  '9C+celgZd2PW7aGYLCHq7nPbmfDV0yHcWjOhXZ8jRMjmANVR/eLQ2EfsRLdW69bn',
  'f3ZD7JS1fwGnO3exGmHO3HZG+6AvberKYVYNHahNFEw5TsAcQWDLRpkGybBcxqZo',
  '81YCqlqidwfeO5YtlO7etx1xLyqa2NsCeG9A86UjG+aeNnXEIDk1PDK+EuiThIUa',
  '/2IxKzJKWl1BKr2d4xAfR0ZnEYuRrbeDQYgTImOlfW6/GuYIxKYgEKCFHFqJATAG',
  'IxHrq1PDOiSwXd2GmVVYyEmhZnbcp8CxaEMQoevxAta0ssMK3w6UsDtvUvYvF22m',
  'qQKBiD5GwESzsFPy3Ga0MvZpn3D6EJQLgsnrtUPZx+z2Ep2x0xc5orneB5fGyF1P',
  'WtP+fG5Q6Dpdz3LRfm+KwBCWFKQjg7uTxcjerhBWEYPmEMKYwTJF5PBG9/ddvHLQ',
  'EQeNC8fHGg4UXU8mhHnSBt3EA10qQJfRDs15M38eG2cYwB1PZpDHScDnDA0=',
  '-----END RSA PRIVATE KEY-----',
].join('\n');

const RFC_RSA_PSS_PUBLIC_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr4tmm3r20Wd/PbqvP1s2',
  '+QEtvpuRaV8Yq40gjUR8y2Rjxa6dpG2GXHbPfvMs8ct+Lh1GH45x28Rw3Ry53mm+',
  'oAXjyQ86OnDkZ5N8lYbggD4O3w6M6pAvLkhk95AndTrifbIFPNU8PPMO7OyrFAHq',
  'gDsznjPFmTOtCEcN2Z1FpWgchwuYLPL+Wokqltd11nqqzi+bJ9cvSKADYdUAAN5W',
  'Utzdpiy6LbTgSxP7ociU4Tn0g5I6aDZJ7A8Lzo0KSyZYoA485mqcO0GVAdVw9lq4',
  'aOT9v6d+nb4bnNkQVklLQ3fVAvJm+xdDOp9LCNCN48V2pnDOkFV6+U9nV5oyc6XI',
  '2wIDAQAB',
  '-----END PUBLIC KEY-----',
].join('\n');

const RFC_RSA_PSS_PRIVATE_PEM = [
  '-----BEGIN PRIVATE KEY-----',
  'MIIEvgIBADALBgkqhkiG9w0BAQoEggSqMIIEpgIBAAKCAQEAr4tmm3r20Wd/Pbqv',
  'P1s2+QEtvpuRaV8Yq40gjUR8y2Rjxa6dpG2GXHbPfvMs8ct+Lh1GH45x28Rw3Ry5',
  '3mm+oAXjyQ86OnDkZ5N8lYbggD4O3w6M6pAvLkhk95AndTrifbIFPNU8PPMO7Oyr',
  'FAHqgDsznjPFmTOtCEcN2Z1FpWgchwuYLPL+Wokqltd11nqqzi+bJ9cvSKADYdUA',
  'AN5WUtzdpiy6LbTgSxP7ociU4Tn0g5I6aDZJ7A8Lzo0KSyZYoA485mqcO0GVAdVw',
  '9lq4aOT9v6d+nb4bnNkQVklLQ3fVAvJm+xdDOp9LCNCN48V2pnDOkFV6+U9nV5oy',
  'c6XI2wIDAQABAoIBAQCUB8ip+kJiiZVKF8AqfB/aUP0jTAqOQewK1kKJ/iQCXBCq',
  'pbo360gvdt05H5VZ/RDVkEgO2k73VSsbulqezKs8RFs2tEmU+JgTI9MeQJPWcP6X',
  'aKy6LIYs0E2cWgp8GADgoBs8llBq0UhX0KffglIeek3n7Z6Gt4YFge2TAcW2WbN4',
  'XfK7lupFyo6HHyWRiYHMMARQXLJeOSdTn5aMBP0PO4bQyk5ORxTUSeOciPJUFktQ',
  'HkvGbym7KryEfwH8Tks0L7WhzyP60PL3xS9FNOJi9m+zztwYIXGDQuKM2GDsITeD',
  '2mI2oHoPMyAD0wdI7BwSVW18p1h+jgfc4dlexKYRAoGBAOVfuiEiOchGghV5vn5N',
  'RDNscAFnpHj1QgMr6/UG05RTgmcLfVsI1I4bSkbrIuVKviGGf7atlkROALOG/xRx',
  'DLadgBEeNyHL5lz6ihQaFJLVQ0u3U4SB67J0YtVO3R6lXcIjBDHuY8SjYJ7Ci6Z6',
  'vuDcoaEujnlrtUhaMxvSfcUJAoGBAMPsCHXte1uWNAqYad2WdLjPDlKtQJK1diCm',
  'rqmB2g8QE99hDOHItjDBEdpyFBKOIP+NpVtM2KLhRajjcL9Ph8jrID6XUqikQuVi',
  '4J9FV2m42jXMuioTT13idAILanYg8D3idvy/3isDVkON0X3UAVKrgMEne0hJpkPL',
  'FYqgetvDAoGBAKLQ6JZMbSe0pPIJkSamQhsehgL5Rs51iX4m1z7+sYFAJfhvN3Q/',
  'OGIHDRp6HjMUcxHpHw7U+S1TETxePwKLnLKj6hw8jnX2/nZRgWHzgVcY+sPsReRx',
  'NJVf+Cfh6yOtznfX00p+JWOXdSY8glSSHJwRAMog+hFGW1AYdt7w80XBAoGBAImR',
  'NUugqapgaEA8TrFxkJmngXYaAqpA0iYRA7kv3S4QavPBUGtFJHBNULzitydkNtVZ',
  '3w6hgce0h9YThTo/nKc+OZDZbgfN9s7cQ75x0PQCAO4fx2P91Q+mDzDUVTeG30mE',
  't2m3S0dGe47JiJxifV9P3wNBNrZGSIF3mrORBVNDAoGBAI0QKn2Iv7Sgo4T/XjND',
  'dl2kZTXqGAk8dOhpUiw/HdM3OGWbhHj2NdCzBliOmPyQtAr770GITWvbAI+IRYyF',
  'S7Fnk6ZVVVHsxjtaHy1uJGFlaZzKR4AGNaUTOJMs6NadzCmGPAxNQQOCqoUjn4XR',
  'rOjr9w349JooGXhOxbu8nOxX',
  '-----END PRIVATE KEY-----',
].join('\n');

const RFC_P256_PUBLIC_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEqIVYZVLCrPZHGHjP17CTW0/+D9Lf',
  'w0EkjqF7xB4FivAxzic30tMM4GF+hR6Dxh71Z50VGGdldkkDXZCnTNnoXQ==',
  '-----END PUBLIC KEY-----',
].join('\n');

const RFC_P256_PRIVATE_PEM = [
  '-----BEGIN EC PRIVATE KEY-----',
  'MHcCAQEEIFKbhfNZfpDsW43+0+JjUr9K+bTeuxopu653+hBaXGA7oAoGCCqGSM49',
  'AwEHoUQDQgAEqIVYZVLCrPZHGHjP17CTW0/+D9Lfw0EkjqF7xB4FivAxzic30tMM',
  '4GF+hR6Dxh71Z50VGGdldkkDXZCnTNnoXQ==',
  '-----END EC PRIVATE KEY-----',
].join('\n');

const RFC_ED25519_PUBLIC_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAJrQLj5P/89iXES9+vFgrIy29clF9CC/oPPsw3c5D0bs=',
  '-----END PUBLIC KEY-----',
].join('\n');

const RFC_ED25519_PRIVATE_PEM = [
  '-----BEGIN PRIVATE KEY-----',
  'MC4CAQAwBQYDK2VwBCIEIJ+DYvh6SEqVTm50DFtMDoQikTmiCqirVv9mWG9qfSnF',
  '-----END PRIVATE KEY-----',
].join('\n');

/** B.1.5 — 64 random bytes, base64. */
const RFC_SHARED_SECRET = 'uzvJfB4u3N0Jy4T7NZ75MDVcr8zSTInedJtkgcu46YW4XByzNJjxBdtjUkdJPBtbmHhIDi6pcl8jsasjlTMtDQ==';

const CREATED = 1_618_884_473;
const NONCE = 'b3k2pp5k7z-50gnwp.yemd';
const BODY = '{"hello": "world"}';
/** The Content-Digest the test-request carries (RFC 9530 §B, sha-512 of the body). */
const RFC_CONTENT_DIGEST =
  'sha-512=:WZDPaVn/7XgHaAy8pmojAkGWoRx2UFChF41A2svX+TaPm+AbwAgBWnrIiYllu7BNNyealdVLvRwEmTHWXvJwew==:';

/** The test-request's rows the executor would hold — `Host` is the
 *  runtime's (covered through `@authority`), the rest are the message's. */
const TEST_REQUEST: HttpSignatureSignInput = {
  method: 'POST',
  url: 'https://example.com/foo?param=Value&Pet=dog',
  headers: [
    { key: 'Date', value: 'Tue, 20 Apr 2021 02:07:55 GMT' },
    { key: 'Content-Type', value: 'application/json' },
    { key: 'Content-Length', value: '18' },
  ],
  body: BODY,
  timestampSec: CREATED,
  nonce: NONCE,
};

const RSA_PSS: HttpSignatureCredentials = {
  algorithm: 'rsa-pss-sha512',
  privateKey: RFC_RSA_PSS_PRIVATE_PEM,
  secret: '',
  keyId: 'test-key-rsa-pss',
  components: '',
};

const PSS_VERIFY = { hash: 'sha512', padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 };

function header(signed: { headers: Array<{ key: string; value: string }> }, name: string): string {
  const row = signed.headers.find((h) => h.key === name);
  if (row === undefined) throw new Error(`no ${name} header`);
  return row.value;
}

/** The signature bytes under `label` in a `Signature` field value. */
function signatureBytes(value: string, label: string): Buffer {
  const prefix = `${label}=:`;
  if (!value.startsWith(prefix) || !value.endsWith(':')) throw new Error(`Signature is not "${label}=:…:" — ${value}`);
  return Buffer.from(value.slice(prefix.length, -1), 'base64');
}

async function signAndVerify(
  credentials: HttpSignatureCredentials,
  input: HttpSignatureSignInput,
  publicPem: string,
  verifyOptions: { hash: string | null; padding?: number; saltLength?: number; dsaEncoding?: 'ieee-p1363' },
): Promise<{ base: string; signatureInput: string }> {
  const signed = await signHttpMessage(credentials, input);
  const label = credentials.label ?? HTTP_SIGNATURE_DEFAULT_LABEL;
  const sig = signatureBytes(header(signed, 'Signature'), label);
  const { hash, ...keyOptions } = verifyOptions;
  const key = createPublicKey(publicPem);
  expect(nodeVerify(hash, Buffer.from(signed.signatureBase), { key, ...keyOptions }, sig)).toBe(true);
  // A flipped byte fails — the verify is real, not a shape check.
  const tampered = Buffer.from(sig);
  tampered[0] ^= 0x01;
  expect(nodeVerify(hash, Buffer.from(signed.signatureBase), { key, ...keyOptions }, tampered)).toBe(false);
  const signatureInput = header(signed, 'Signature-Input');
  expect(signatureInput.startsWith(`${label}=`)).toBe(true);
  return { base: signed.signatureBase, signatureInput: signatureInput.slice(label.length + 1) };
}

// ── RFC 9530 — the Content-Digest field ─────────────────────────────

describe('contentDigestValue — RFC 9530 §B', () => {
  it('sha-512 and sha-256 of the test body match the published values', async () => {
    expect(await contentDigestValue('sha-512', BODY)).toBe(RFC_CONTENT_DIGEST);
    expect(await contentDigestValue('sha-256', BODY)).toBe('sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:');
  });

  it('the empty content digests too (a bodyless send under the digest setting)', async () => {
    expect(await contentDigestValue('sha-256', '')).toBe('sha-256=:47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=:');
  });
});

// ── RFC 9421 Appendix B.2 — the request vectors ─────────────────────

describe('signHttpMessage — the RFC 9421 B.2 request vectors', () => {
  it('B.2.1 — the minimal signature: an empty covered set, created + keyid + nonce, verifying under the RSA-PSS key', async () => {
    const { base, signatureInput } = await signAndVerify(
      { ...RSA_PSS, nonce: true, label: 'sig-b21' },
      TEST_REQUEST,
      RFC_RSA_PSS_PUBLIC_PEM,
      PSS_VERIFY,
    );
    expect(base).toBe(`"@signature-params": ();created=1618884473;keyid="test-key-rsa-pss";nonce="${NONCE}"`);
    expect(signatureInput).toBe(`();created=1618884473;keyid="test-key-rsa-pss";nonce="${NONCE}"`);
  });

  it('B.2.3 — full coverage: every derived component and header, the minted sha-512 Content-Digest, the base byte-exact', async () => {
    const credentials: HttpSignatureCredentials = {
      ...RSA_PSS,
      components: 'date @method @path @query @authority content-type content-digest content-length',
      contentDigest: 'sha-512',
      label: 'sig-b23',
    };
    const { base, signatureInput } = await signAndVerify(credentials, TEST_REQUEST, RFC_RSA_PSS_PUBLIC_PEM, PSS_VERIFY);
    const params =
      '("date" "@method" "@path" "@query" "@authority" "content-type" "content-digest" "content-length");created=1618884473;keyid="test-key-rsa-pss"';
    expect(base).toBe(
      [
        '"date": Tue, 20 Apr 2021 02:07:55 GMT',
        '"@method": POST',
        '"@path": /foo',
        '"@query": ?param=Value&Pet=dog',
        '"@authority": example.com',
        '"content-type": application/json',
        `"content-digest": ${RFC_CONTENT_DIGEST}`,
        '"content-length": 18',
        `"@signature-params": ${params}`,
      ].join('\n'),
    );
    expect(signatureInput).toBe(params);
    const signed = await signHttpMessage(credentials, TEST_REQUEST);
    expect(signed.headers.map((h) => h.key)).toEqual(['Content-Digest', 'Signature-Input', 'Signature']);
    expect(header(signed, 'Content-Digest')).toBe(RFC_CONTENT_DIGEST);
  });

  it('B.2.2 — the tag parameter and a covered Content-Digest the request already carries', async () => {
    const carried: HttpSignatureSignInput = {
      ...TEST_REQUEST,
      headers: [...TEST_REQUEST.headers, { key: 'Content-Digest', value: RFC_CONTENT_DIGEST }],
    };
    const { base } = await signAndVerify(
      { ...RSA_PSS, components: '@authority content-digest', tag: 'header-example', label: 'sig-b22' },
      carried,
      RFC_RSA_PSS_PUBLIC_PEM,
      PSS_VERIFY,
    );
    expect(base).toBe(
      [
        '"@authority": example.com',
        `"content-digest": ${RFC_CONTENT_DIGEST}`,
        '"@signature-params": ("@authority" "content-digest");created=1618884473;keyid="test-key-rsa-pss";tag="header-example"',
      ].join('\n'),
    );
  });

  it('B.2.5 — hmac-sha256 under the base64 shared secret: the published signature, byte-exact', async () => {
    const signed = await signHttpMessage(
      {
        algorithm: 'hmac-sha256',
        privateKey: '',
        secret: RFC_SHARED_SECRET,
        secretBase64: true,
        keyId: 'test-shared-secret',
        components: 'date @authority content-type',
        label: 'sig-b25',
      },
      TEST_REQUEST,
    );
    expect(signed.signatureBase).toBe(
      [
        '"date": Tue, 20 Apr 2021 02:07:55 GMT',
        '"@authority": example.com',
        '"content-type": application/json',
        '"@signature-params": ("date" "@authority" "content-type");created=1618884473;keyid="test-shared-secret"',
      ].join('\n'),
    );
    expect(signed.headers).toEqual([
      {
        key: 'Signature-Input',
        value: 'sig-b25=("date" "@authority" "content-type");created=1618884473;keyid="test-shared-secret"',
      },
      { key: 'Signature', value: 'sig-b25=:pxcQw6G3AjtMBQjwo8XzkZf/bws5LelbaMk5rGIGtE8=:' },
    ]);
  });

  it('B.2.6 — ed25519 under the RFC key: the published signature, byte-exact (EdDSA is deterministic)', async () => {
    const signed = await signHttpMessage(
      {
        algorithm: 'ed25519',
        privateKey: RFC_ED25519_PRIVATE_PEM,
        secret: '',
        keyId: 'test-key-ed25519',
        components: 'date @method @path @authority content-type content-length',
        label: 'sig-b26',
      },
      TEST_REQUEST,
    );
    expect(header(signed, 'Signature-Input')).toBe(
      'sig-b26=("date" "@method" "@path" "@authority" "content-type" "content-length");created=1618884473;keyid="test-key-ed25519"',
    );
    expect(header(signed, 'Signature')).toBe(
      'sig-b26=:wqcAqbmYJ2ji2glfAMaRy4gruYYnx2nEFN2HN6jrnDnQCK1u02Gb04v9EDgwUPiu4A0w6vuQv5lIp5WPpBKRCw==:',
    );
    await signAndVerify(
      { algorithm: 'ed25519', privateKey: RFC_ED25519_PRIVATE_PEM, secret: '', components: '@method' },
      TEST_REQUEST,
      RFC_ED25519_PUBLIC_PEM,
      { hash: null },
    );
  });
});

// ── The other families ──────────────────────────────────────────────

describe('signHttpMessage — every registered algorithm verifies under its public key', () => {
  it('ecdsa-p256-sha256 signs the RFC SEC1 key (wrapped) and emits the raw r‖s pair', async () => {
    const credentials: HttpSignatureCredentials = {
      algorithm: 'ecdsa-p256-sha256',
      privateKey: RFC_P256_PRIVATE_PEM,
      secret: '',
      components: '@method @path',
    };
    const signed = await signHttpMessage(credentials, TEST_REQUEST);
    expect(signatureBytes(header(signed, 'Signature'), 'sig1')).toHaveLength(64);
    await signAndVerify(credentials, TEST_REQUEST, RFC_P256_PUBLIC_PEM, { hash: 'sha256', dsaEncoding: 'ieee-p1363' });
  });

  it('ecdsa-p384-sha384 signs a P-384 key with a 96-byte signature', async () => {
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-384' });
    const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const credentials: HttpSignatureCredentials = {
      algorithm: 'ecdsa-p384-sha384',
      privateKey,
      secret: '',
      components: '@target-uri',
    };
    const signed = await signHttpMessage(credentials, TEST_REQUEST);
    expect(signatureBytes(header(signed, 'Signature'), 'sig1')).toHaveLength(96);
    await signAndVerify(credentials, TEST_REQUEST, publicKey, { hash: 'sha384', dsaEncoding: 'ieee-p1363' });
  });

  it('rsa-v1_5-sha256 signs the RFC PKCS#1 key (wrapped) and verifies under its public half', async () => {
    await signAndVerify(
      {
        algorithm: 'rsa-v1_5-sha256',
        privateKey: RFC_RSA_PRIVATE_PEM,
        secret: '',
        keyId: 'test-key-rsa',
        components: '@method @authority',
      },
      TEST_REQUEST,
      RFC_RSA_PUBLIC_PEM,
      { hash: 'sha256', padding: constants.RSA_PKCS1_PADDING },
    );
  });

  it('rsa-pss-sha512 also takes an rsaEncryption PKCS#8 key (the shape openssl genrsa writes)', async () => {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKey = pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicKey = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    await signAndVerify(
      { algorithm: 'rsa-pss-sha512', privateKey, secret: '', components: '@method' },
      TEST_REQUEST,
      publicKey,
      PSS_VERIFY,
    );
  });

  it('hmac-sha256 keys a plain-text secret when not base64', async () => {
    const signed = await signHttpMessage(
      { algorithm: 'hmac-sha256', privateKey: '', secret: 'plain-secret', components: '@method' },
      TEST_REQUEST,
    );
    const expected = createHmac('sha256', 'plain-secret').update(signed.signatureBase).digest('base64');
    expect(header(signed, 'Signature')).toBe(`sig1=:${expected}:`);
  });

  it('names the six registered values and the seven request-derived components', () => {
    expect(HTTP_SIGNATURE_ALGORITHMS).toEqual([
      'rsa-pss-sha512',
      'rsa-v1_5-sha256',
      'hmac-sha256',
      'ecdsa-p256-sha256',
      'ecdsa-p384-sha384',
      'ed25519',
    ]);
    expect(isHttpSignatureAlgorithm('ed25519')).toBe(true);
    expect(isHttpSignatureAlgorithm('rsa-v1_5-sha1')).toBe(false);
    expect(HTTP_SIGNATURE_DERIVED_COMPONENTS).toEqual([
      '@method',
      '@target-uri',
      '@authority',
      '@scheme',
      '@request-target',
      '@path',
      '@query',
    ]);
    expect(HTTP_SIGNATURE_DEFAULT_COMPONENTS).toBe('@method @target-uri');
    expect(HTTP_SIGNATURE_DEFAULT_LABEL).toBe('sig1');
  });
});

// ── Components and the base (§2) ────────────────────────────────────

const HMAC: HttpSignatureCredentials = {
  algorithm: 'hmac-sha256',
  privateKey: '',
  secret: 's',
  components: '',
};

async function baseOf(components: string, input: Partial<HttpSignatureSignInput> = {}): Promise<string> {
  return (await buildHttpSignatureBase({ ...HMAC, components }, { ...TEST_REQUEST, ...input })).base;
}

describe('buildHttpSignatureBase — derived components (§2.2)', () => {
  it('@target-uri is the parsed target without the fragment; @scheme and @request-target follow', async () => {
    expect(
      await baseOf('@target-uri @scheme @request-target', { url: 'HTTPS://Example.COM:443/a%20b/../c?x=1#frag' }),
    ).toBe(
      [
        '"@target-uri": https://example.com/c?x=1',
        '"@scheme": https',
        '"@request-target": /c?x=1',
        '"@signature-params": ("@target-uri" "@scheme" "@request-target");created=1618884473',
      ].join('\n'),
    );
  });

  it('@authority lowercases and drops the default port, keeps another', async () => {
    expect(await baseOf('@authority', { url: 'http://Api.Openheaders.IO:80/' })).toContain(
      '"@authority": api.openheaders.io\n',
    );
    expect(await baseOf('@authority', { url: 'http://api.openheaders.io:8080/' })).toContain(
      '"@authority": api.openheaders.io:8080\n',
    );
  });

  it('@path is "/" for a bare origin and @query is "?" when the target has none', async () => {
    expect(await baseOf('@path @query', { url: 'https://api.openheaders.io' })).toBe(
      ['"@path": /', '"@query": ?', '"@signature-params": ("@path" "@query");created=1618884473'].join('\n'),
    );
  });

  it('@method is the wire (uppercase) method', async () => {
    expect(await baseOf('@method', { method: 'patch' })).toContain('"@method": PATCH\n');
  });
});

describe('buildHttpSignatureBase — header fields (§2.1)', () => {
  it('reads the field by lowercase name, joins repeated rows with a comma and a space, trims and unfolds', async () => {
    const base = await baseOf('cache-control x-ows', {
      headers: [
        { key: 'Cache-Control', value: 'max-age=60' },
        { key: 'X-OWS', value: '  Leading and\r\n\t folded.  ' },
        { key: 'cache-control', value: 'must-revalidate' },
      ],
    });
    expect(base).toBe(
      [
        '"cache-control": max-age=60, must-revalidate',
        '"x-ows": Leading and folded.',
        '"@signature-params": ("cache-control" "x-ows");created=1618884473',
      ].join('\n'),
    );
  });

  it('an empty field value signs as the empty string', async () => {
    expect(await baseOf('x-empty', { headers: [{ key: 'X-Empty', value: '' }] })).toContain('"x-empty": \n');
  });

  it('a covered field the request does not carry is the error naming it', async () => {
    await expect(baseOf('date x-missing')).rejects.toThrow('the request carries no "x-missing" header to cover');
  });

  it('a covered content-digest with no digest setting names the setting; with one set it is minted', async () => {
    await expect(baseOf('content-digest')).rejects.toThrow(
      '"content-digest" is covered but no Content Digest algorithm is set',
    );
    const built = await buildHttpSignatureBase(
      { ...HMAC, components: 'content-digest', contentDigest: 'sha-256' },
      { ...TEST_REQUEST, body: undefined },
    );
    expect(built.contentDigest).toBe('sha-256=:47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=:');
    expect(built.base).toContain(`"content-digest": ${built.contentDigest}\n`);
  });

  it('a non-ASCII field value cannot be covered', async () => {
    await expect(baseOf('x-name', { headers: [{ key: 'X-Name', value: 'Zoë' }] })).rejects.toThrow(
      'the "x-name" header value is not ASCII',
    );
  });
});

describe('parseHttpSignatureComponents', () => {
  it('splits on whitespace and commas, lowercases, keeps the order', () => {
    expect(parseHttpSignatureComponents(' @Method, Content-Type\n date,,@path ')).toEqual([
      '@method',
      'content-type',
      'date',
      '@path',
    ]);
    expect(parseHttpSignatureComponents('')).toEqual([]);
  });

  it('refuses duplicates, unknown derived components, @query-param, @signature-params, parameters, bad names', () => {
    expect(() => parseHttpSignatureComponents('@method @method')).toThrow('component "@method" is listed twice');
    expect(() => parseHttpSignatureComponents('@status')).toThrow('unknown derived component "@status"');
    expect(() => parseHttpSignatureComponents('@query-param')).toThrow('"@query-param" needs a name parameter');
    expect(() => parseHttpSignatureComponents('@signature-params')).toThrow('never listed');
    expect(() => parseHttpSignatureComponents('date;sf')).toThrow('carries a parameter');
    expect(() => parseHttpSignatureComponents('content type')).not.toThrow();
    expect(() => parseHttpSignatureComponents('x:y')).toThrow('is not a valid header field name');
  });
});

// ── Signature parameters (§2.3) and the two headers (§4) ────────────

describe('signHttpMessage — parameters, label and the header pair', () => {
  it('writes the parameters in the fixed order created, expires, keyid, alg, nonce, tag', async () => {
    const signed = await signHttpMessage(
      {
        ...HMAC,
        components: '@method',
        expiresInSeconds: 300,
        keyId: ' key-7 ',
        includeAlgorithm: true,
        nonce: true,
        tag: 'app',
      },
      TEST_REQUEST,
    );
    expect(header(signed, 'Signature-Input')).toBe(
      `sig1=("@method");created=1618884473;expires=1618884773;keyid="key-7";alg="hmac-sha256";nonce="${NONCE}";tag="app"`,
    );
  });

  it('created off drops the parameter; expires without created is refused', async () => {
    const signed = await signHttpMessage({ ...HMAC, components: '@method', created: false }, TEST_REQUEST);
    expect(header(signed, 'Signature-Input')).toBe('sig1=("@method")');
    await expect(
      signHttpMessage({ ...HMAC, components: '@method', created: false, expiresInSeconds: 60 }, TEST_REQUEST),
    ).rejects.toThrow('"expires" needs "created"');
  });

  it('escapes quotes and backslashes inside string parameters; refuses non-printable ones', async () => {
    const signed = await signHttpMessage({ ...HMAC, components: '', keyId: 'k"e\\y' }, TEST_REQUEST);
    expect(header(signed, 'Signature-Input')).toBe('sig1=();created=1618884473;keyid="k\\"e\\\\y"');
    await expect(signHttpMessage({ ...HMAC, components: '', tag: 'tab\there' }, TEST_REQUEST)).rejects.toThrow(
      'not printable ASCII',
    );
  });

  it('the label defaults to sig1, takes a valid dictionary key, refuses an invalid one', async () => {
    const blank = await signHttpMessage({ ...HMAC, label: ' ' }, TEST_REQUEST);
    expect(header(blank, 'Signature').startsWith('sig1=:')).toBe(true);
    const signed = await signHttpMessage({ ...HMAC, label: 'oh-sig.1' }, TEST_REQUEST);
    expect(header(signed, 'Signature-Input').startsWith('oh-sig.1=(')).toBe(true);
    expect(header(signed, 'Signature').startsWith('oh-sig.1=:')).toBe(true);
    await expect(signHttpMessage({ ...HMAC, label: 'Sig 1' }, TEST_REQUEST)).rejects.toThrow('is not a valid key');
  });

  it('refuses an empty or malformed key by name and a relative URL', async () => {
    await expect(signHttpMessage({ ...HMAC, secret: '' }, TEST_REQUEST)).rejects.toThrow('the shared secret is empty');
    await expect(signHttpMessage({ ...HMAC, secret: '!!', secretBase64: true }, TEST_REQUEST)).rejects.toThrow(
      'not valid base64',
    );
    await expect(
      signHttpMessage({ algorithm: 'ed25519', privateKey: ' ', secret: '', components: '' }, TEST_REQUEST),
    ).rejects.toThrow('the private key is empty');
    await expect(
      signHttpMessage(
        { algorithm: 'ecdsa-p256-sha256', privateKey: RFC_RSA_PRIVATE_PEM, secret: '', components: '' },
        TEST_REQUEST,
      ),
    ).rejects.toThrow();
    await expect(signHttpMessage(HMAC, { ...TEST_REQUEST, url: '/relative' })).rejects.toThrow('is not absolute');
  });
});
