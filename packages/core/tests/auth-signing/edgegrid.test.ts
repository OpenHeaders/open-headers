import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildEdgeGridDataToSign,
  EDGEGRID_DEFAULT_MAX_BODY,
  type EdgeGridCredentials,
  edgeGridHeadersToSign,
  edgeGridSigningKey,
  edgeGridTimestamp,
  signEdgeGrid,
} from '../../src/auth-signing/index';

// ── The scheme's published vectors (the official clients' shared
//    test data) — credentials, nonce, timestamp, and the fifteen cases
//    with their expected data-to-sign strings and signatures. ──

const HOST = 'akaa-baseurl-xxxxxxxxxxx-xxxxxxxxxxxxx.luna.akamaiapis.net';

const VECTOR_CREDENTIALS: EdgeGridCredentials = {
  clientToken: 'akab-client-token-xxx-xxxxxxxxxxxxxxxx',
  accessToken: 'akab-access-token-xxx-xxxxxxxxxxxxxxxx',
  clientSecret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx=',
  headersToSign: 'X-Test1, X-Test2, X-Test3',
  maxBodySize: 2048,
};
const NONCE = 'nonce-xx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const TIMESTAMP = '20140321T19:34:21+0000';
const PREFIX =
  `EG1-HMAC-SHA256 client_token=${VECTOR_CREDENTIALS.clientToken};` +
  `access_token=${VECTOR_CREDENTIALS.accessToken};timestamp=${TIMESTAMP};nonce=${NONCE};`;

interface Vector {
  name: string;
  method: string;
  path: string;
  headers?: Array<{ key: string; value: string }>;
  body?: string;
  dataToSign?: string;
  signature: string;
}

const VECTORS: Vector[] = [
  {
    name: 'simple GET',
    method: 'GET',
    path: '/',
    dataToSign: `GET\thttps\t${HOST}\t/\t\t\t`,
    signature: 'tL+y4hxyHxgWVD30X3pWnGKHcPzmrIF+LThiAOhMxYU=',
  },
  {
    name: 'GET with querystring',
    method: 'GET',
    path: '/testapi/v1/t1?p1=1&p2=2',
    dataToSign: `GET\thttps\t${HOST}\t/testapi/v1/t1?p1=1&p2=2\t\t\t`,
    signature: 'hKDH1UlnQySSHjvIcZpDMbQHihTQ0XyVAKZaApabdeA=',
  },
  {
    name: 'POST inside limit',
    method: 'POST',
    path: '/testapi/v1/t3',
    body: 'datadatadatadatadatadatadatadata',
    dataToSign: `POST\thttps\t${HOST}\t/testapi/v1/t3\t\tfDimoYqXOLntG3If/Z0K2aS9I19Pkv9P5OMCoL8lY0w=\t`,
    signature: 'hXm4iCxtpN22m4cbZb4lVLW5rhX8Ca82vCFqXzSTPe4=',
  },
  {
    name: 'POST too large',
    method: 'POST',
    path: '/testapi/v1/t3',
    body: 'd'.repeat(3000),
    dataToSign: `POST\thttps\t${HOST}\t/testapi/v1/t3\t\tiysZKJ78BqF0NvDrpv9Hc3pJBWC5f5apR4qUK/Qfo5k=\t`,
    signature: '6Q6PiTipLae6n4GsSIDTCJ54bEbHUBp+4MUXrbQCBoY=',
  },
  {
    name: 'POST length equals max_body',
    method: 'POST',
    path: '/testapi/v1/t3',
    body: 'd'.repeat(2048),
    dataToSign: `POST\thttps\t${HOST}\t/testapi/v1/t3\t\tiysZKJ78BqF0NvDrpv9Hc3pJBWC5f5apR4qUK/Qfo5k=\t`,
    signature: '6Q6PiTipLae6n4GsSIDTCJ54bEbHUBp+4MUXrbQCBoY=',
  },
  {
    name: 'POST empty body',
    method: 'POST',
    path: '/testapi/v1/t6',
    body: '',
    dataToSign: `POST\thttps\t${HOST}\t/testapi/v1/t6\t\t\t`,
    signature: '1gEDxeQGD5GovIkJJGcBaKnZ+VaPtrc4qBUHixjsPCQ=',
  },
  {
    name: 'Simple header signing with GET',
    method: 'GET',
    path: '/testapi/v1/t4',
    headers: [{ key: 'X-Test1', value: 'test-simple-header' }],
    dataToSign: `GET\thttps\t${HOST}\t/testapi/v1/t4\tx-test1:test-simple-header\t\t`,
    signature: '8F9AybcRw+PLxnvT+H0JRkjROrrUgsxJTnRXMzqvcwY=',
  },
  {
    name: 'Header containing spaces',
    method: 'GET',
    path: '/testapi/v1/t4',
    headers: [{ key: 'X-Test1', value: '"     test-header-with-spaces     "' }],
    dataToSign: `GET\thttps\t${HOST}\t/testapi/v1/t4\tx-test1:" test-header-with-spaces "\t\t`,
    signature: 'ucq2AbjCNtobHfCTuS38fdkl5UDdWHZhQX46fYR8CqI=',
  },
  {
    name: 'Header with leading and interior spaces',
    method: 'GET',
    path: '/testapi/v1/t4',
    headers: [{ key: 'X-Test1', value: '     first-thing      second-thing' }],
    signature: 'WtnneL539UadAAOJwnsXvPqT4Kt6z7HMgBEwAFpt3+c=',
  },
  {
    name: 'Headers out of order',
    method: 'GET',
    path: '/testapi/v1/t4',
    headers: [
      { key: 'X-Test2', value: 't2' },
      { key: 'X-Test1', value: 't1' },
      { key: 'X-Test3', value: 't3' },
    ],
    dataToSign: `GET\thttps\t${HOST}\t/testapi/v1/t4\tx-test1:t1\tx-test2:t2\tx-test3:t3\t\t`,
    signature: 'Wus73Nx8jOYM+kkBFF2q8D1EATRIMr0WLWwpLBgkBqY=',
  },
  {
    name: 'Extra header',
    method: 'GET',
    path: '/testapi/v1/t5',
    headers: [
      { key: 'X-Test2', value: 't2' },
      { key: 'X-Test1', value: 't1' },
      { key: 'X-Test3', value: 't3' },
      { key: 'X-Extra', value: "this won't be included" },
    ],
    dataToSign: `GET\thttps\t${HOST}\t/testapi/v1/t5\tx-test1:t1\tx-test2:t2\tx-test3:t3\t\t`,
    signature: 'Knd/jc0A5Ghhizjayr0AUUvl2MZjBpS3FDSzvtq4Ixc=',
  },
  {
    name: 'PUT test',
    method: 'PUT',
    path: '/testapi/v1/t6',
    body: 'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    dataToSign: `PUT\thttps\t${HOST}\t/testapi/v1/t6\t\t\t`,
    signature: 'GNBWEYSEWOLtu+7dD52da2C39aX/Jchpon3K/AmBqBU=',
  },
  {
    name: 'PATCH test',
    method: 'PATCH',
    path: '/testapi/v1/t6',
    body: 'PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP',
    dataToSign: `PATCH\thttps\t${HOST}\t/testapi/v1/t6\t\t\t`,
    signature: 'JIl05ImY1AOnMtmw+9LKgaFA8mnzsEKabbnHmI8LsQ4=',
  },
  {
    name: 'GET with query params',
    method: 'GET',
    path: '/testapi/v1/configs/111?from=12345&limit=200000',
    dataToSign: `GET\thttps\t${HOST}\t/testapi/v1/configs/111?from=12345&limit=200000\t\t\t`,
    signature: 'XM+hsuSs6nuy/5eDRty1IjtVCAdr8xPFRAZ/b8RXDm8=',
  },
  {
    name: 'GET with query params and separator in path',
    method: 'GET',
    path: '/testapi/v1/configs/111;222;333?from=12345&limit=200000',
    dataToSign: `GET\thttps\t${HOST}\t/testapi/v1/configs/111;222;333?from=12345&limit=200000\t\t\t`,
    signature: 'pmQF7Is2+O4r/mMojPR4yeF58BrempNNoBX5/DT0Fxs=',
  },
];

function inputOf(v: Vector) {
  return {
    method: v.method,
    url: `https://${HOST}${v.path}`,
    headers: v.headers ?? [],
    ...(v.body !== undefined ? { body: v.body } : {}),
    timestamp: TIMESTAMP,
    nonce: NONCE,
  };
}

// ── Independent reference (node:crypto) — shares no code with the
//    WebCrypto signer, so an error there can't self-confirm. ──

function refSign(creds: EdgeGridCredentials, input: ReturnType<typeof inputOf>): string {
  const url = new URL(input.url);
  const names = (creds.headersToSign ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  const canonical = names
    .flatMap((name) => {
      const hit = input.headers.find((h) => h.key.toLowerCase() === name.toLowerCase());
      return hit && hit.value !== '' ? [`${name.toLowerCase()}:${hit.value.trim().replace(/\s+/g, ' ')}`] : [];
    })
    .join('\t');
  let hash = '';
  if (input.method === 'POST' && input.body) {
    const bytes = Buffer.from(input.body, 'utf8').subarray(0, creds.maxBodySize ?? 131072);
    hash = createHash('sha256').update(bytes).digest('base64');
  }
  const prefix =
    `EG1-HMAC-SHA256 client_token=${creds.clientToken};access_token=${creds.accessToken};` +
    `timestamp=${input.timestamp};nonce=${input.nonce};`;
  const data = [
    input.method,
    url.protocol.slice(0, -1),
    url.host,
    url.pathname + url.search,
    canonical,
    hash,
    prefix,
  ].join('\t');
  const key = createHmac('sha256', creds.clientSecret).update(input.timestamp).digest('base64');
  return createHmac('sha256', key).update(data).digest('base64');
}

describe('signEdgeGrid — the published vectors', () => {
  it('derives the published signing key from the timestamp and the secret', async () => {
    expect(await edgeGridSigningKey(VECTOR_CREDENTIALS.clientSecret, TIMESTAMP)).toBe(
      'znsRMDBRqTXGJ7Ojip3/h2FGPu3LuoMYWgv9PKEnE/o=',
    );
  });

  it.each(VECTORS.map((v) => [v.name, v] as const))('%s', async (_name, v) => {
    const input = inputOf(v);
    // The published strings stop at the empty seventh slot — the
    // header prefix every client appends before signing.
    if (v.dataToSign !== undefined) {
      expect(await buildEdgeGridDataToSign(VECTOR_CREDENTIALS, input, PREFIX)).toBe(`${v.dataToSign}${PREFIX}`);
    }
    const [header] = await signEdgeGrid(VECTOR_CREDENTIALS, input);
    expect(header?.key).toBe('Authorization');
    expect(header?.value).toBe(`${PREFIX}signature=${v.signature}`);
    expect(refSign(VECTOR_CREDENTIALS, input)).toBe(v.signature);
  });
});

describe('signEdgeGrid — the rules beyond the vectors', () => {
  it('defaults the content-hash window to 128 KiB and truncates by BYTES', async () => {
    expect(EDGEGRID_DEFAULT_MAX_BODY).toBe(131072);
    const creds: EdgeGridCredentials = { ...VECTOR_CREDENTIALS, maxBodySize: 4 };
    // 'é' is two bytes: a four-BYTE window keeps 'aé' + one dangling
    // byte, never 'aéb' (four characters).
    const input = { ...inputOf({ name: '', method: 'POST', path: '/x', signature: '' }), body: 'aébc' };
    const data = await buildEdgeGridDataToSign(creds, input, PREFIX);
    const expected = createHash('sha256').update(Buffer.from('aébc', 'utf8').subarray(0, 4)).digest('base64');
    expect(data.split('\t')[5]).toBe(expected);
    expect(refSign(creds, input)).toBe((await signEdgeGrid(creds, input))[0]?.value.split('signature=')[1]);
  });

  it('a listed header the request lacks is skipped; an unlisted one never signs', async () => {
    const creds: EdgeGridCredentials = { ...VECTOR_CREDENTIALS, headersToSign: 'X-Missing, Content-Type' };
    const input = inputOf({
      name: '',
      method: 'GET',
      path: '/x',
      headers: [
        { key: 'content-type', value: '  application/json  ' },
        { key: 'X-Other', value: 'no' },
      ],
      signature: '',
    });
    const data = await buildEdgeGridDataToSign(creds, input, PREFIX);
    expect(data.split('\t')[4]).toBe('content-type:application/json');
  });

  it('keeps a non-default port in the signed host and signs http as http', async () => {
    const input = inputOf({ name: '', method: 'GET', path: '/x?y=1', signature: '' });
    const local = { ...input, url: 'http://localhost:3000/x?y=1' };
    const data = await buildEdgeGridDataToSign(VECTOR_CREDENTIALS, local, PREFIX);
    expect(data.startsWith('GET\thttp\tlocalhost:3000\t/x?y=1\t')).toBe(true);
    const [header] = await signEdgeGrid(VECTOR_CREDENTIALS, local);
    expect(header?.value.split('signature=')[1]).toBe(refSign(VECTOR_CREDENTIALS, local));
  });

  it('formats the timestamp as yyyyMMddTHH:mm:ss+0000 and splits the header list', () => {
    expect(edgeGridTimestamp(new Date('2014-03-21T19:34:21.987Z'))).toBe(TIMESTAMP);
    expect(edgeGridHeadersToSign(' X-Test1 ,, X-Test2 ')).toEqual(['X-Test1', 'X-Test2']);
    expect(edgeGridHeadersToSign(undefined)).toEqual([]);
  });
});
