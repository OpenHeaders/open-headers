//! One wire hop: resolve (or take the pinned address), get a QUIC
//! connection — pooled when the trust tuple matches one already open,
//! fresh otherwise — run the HTTP/3 exchange, and stream the response
//! back as frames. Reuse discipline is retry-once-on-stale (see
//! `pool.rs`); a `captureNetwork` hop always dials fresh, instrumented,
//! and reports socket facts + dial timings on RESPONSE_HEAD.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};

use bytes::{Buf, Bytes};
use h3::client::{RequestStream, SendRequest};
use h3_quinn::OpenStreams;
use http::Uri;
use tokio::sync::mpsc;

use crate::error::{wire_error, HelperError};
use crate::framing::encode_frame;
use crate::pool::{FreshConnection, Pool, PoolKey, StoreOutcome};
use crate::protocol::{frame_type, DialTimings, ErrorFrame, RequestHead, ResponseHead, SocketFacts};
use crate::tls;

const DEFAULT_IDLE_TIMEOUT_MS: u64 = 30_000;
const BODY_CHUNK_BYTES: usize = 64 * 1024;
/// How many resolved addresses one dial will try before giving up —
/// bounds the worst case (every address a 30 s handshake blackhole)
/// well inside the node-side deadline while still covering the real
/// failure this exists for: a dual-stack host whose first answer is an
/// unroutable leg, which fails fast and lets the next family through.
const MAX_DIAL_ADDRESSES: usize = 4;

pub async fn run(id: u32, head: RequestHead, body: Vec<u8>, out: mpsc::Sender<Vec<u8>>, pool: Arc<Pool>) {
    if let Err(e) = run_inner(id, &head, body, &out, &pool).await {
        let frame = ErrorFrame { code: e.code, message: e.message };
        let payload = serde_json::to_vec(&frame).unwrap_or_default();
        let _ = out.send(encode_frame(frame_type::ERROR, id, &payload)).await;
    }
}

/// What a fresh dial observed — present only when the head asked.
type DialFacts = Option<(SocketFacts, DialTimings)>;

/// A failed exchange, split at the replay boundary's finer grain:
/// `sent` turns true once the request head crossed to the server
/// (`send_request` succeeded) — past that point a retry could execute
/// a non-idempotent request twice server-side.
struct ExchangeFailure {
    sent: bool,
    error: HelperError,
}

/// RFC 9110 §9.2.2 idempotent methods — the ones safe to replay after
/// a reused connection died with the request already on the wire.
fn idempotent(method: &str) -> bool {
    matches!(
        method.to_ascii_uppercase().as_str(),
        "GET" | "HEAD" | "PUT" | "DELETE" | "OPTIONS" | "TRACE"
    )
}

async fn run_inner(
    id: u32,
    head: &RequestHead,
    body: Vec<u8>,
    out: &mpsc::Sender<Vec<u8>>,
    pool: &Arc<Pool>,
) -> Result<(), HelperError> {
    let uri: Uri = head
        .url
        .parse()
        .map_err(|e| HelperError::new("bad-request", format!("URL: {e}")))?;
    if uri.scheme_str() != Some("https") {
        return Err(HelperError::new("bad-request", "HTTP/3 targets must be https://"));
    }
    let host = uri
        .host()
        .ok_or_else(|| HelperError::new("bad-request", "URL has no host"))?
        .to_string();
    let port = uri.port_u16().unwrap_or(443);

    // The request is wire-independent — build (and thereby validate) it
    // before any connection work so a reused connection's exchange
    // failure can only ever mean a stale wire, never a bad head misread
    // as one. `http::Request` is not Clone; the retry path rebuilds.
    let body = Bytes::from(body);
    let key = PoolKey::of(&host, port, head);
    if !head.capture_network {
        if let Some(pooled) = pool.checkout(&key) {
            let request = build_request(head, &uri)?;
            let mut send_request = pooled.send_request;
            match exchange(&mut send_request, request, body.clone()).await {
                Ok((response, stream)) => {
                    return stream_response(id, response, stream, out, None).await;
                }
                Err(stale) => {
                    // Retry-once-on-stale: the reused connection failed
                    // before any response bytes came back — discard it
                    // and fall through to ONE fresh dial. The fresh
                    // dial's outcome is the hop's honest answer.
                    pool.discard(&key, pooled.generation);
                    if stale.sent && !idempotent(&head.method) {
                        // The head (and possibly the body) already
                        // crossed on the reused connection — replaying
                        // a non-idempotent request could execute it
                        // twice server-side. Honest failure instead;
                        // the common stale shape (a dead connection
                        // failing at stream-open, nothing sent) still
                        // retries for every method.
                        return Err(stale.error);
                    }
                }
            }
        }
    }

    let request = build_request(head, &uri)?;
    let (fresh, facts) = dial(head, &host, port).await?;
    let mut send_request = fresh.send_request.clone();
    // Offer the connection for reuse before the exchange so concurrent
    // hops multiplex onto it; a captureNetwork dial stays send-local.
    let stored = if head.capture_network {
        StoreOutcome::Raced(fresh)
    } else {
        pool.store(key.clone(), fresh)
    };
    let result = match exchange(&mut send_request, request, body).await {
        Ok((response, stream)) => stream_response(id, response, stream, out, facts).await,
        // A FRESH connection's exchange failure is the hop's honest
        // one-shot answer — the replay boundary applies to reuse only.
        Err(failure) => Err(failure.error),
    };
    match stored {
        StoreOutcome::Stored(generation) => {
            // A connection whose very first exchange failed is not
            // worth a second hop's stale round-trip — evict it now.
            if result.is_err() {
                pool.discard(&key, generation);
            }
        }
        // The un-pooled connection winds down on drop (FreshConnection's
        // Drop) — the one-connection-per-hop shutdown.
        StoreOutcome::Raced(connection) => drop(connection),
    }
    result
}

fn build_request(head: &RequestHead, uri: &Uri) -> Result<http::Request<()>, HelperError> {
    let mut builder = http::Request::builder().method(head.method.as_str()).uri(&head.url);
    if let Some(authority) = &head.authority {
        let mut parts = uri.clone().into_parts();
        parts.authority = Some(
            authority
                .parse()
                .map_err(|e| HelperError::new("bad-request", format!("authority: {e}")))?,
        );
        let with_authority = Uri::from_parts(parts).map_err(|e| HelperError::new("bad-request", format!("authority: {e}")))?;
        builder = builder.method(head.method.as_str()).uri(with_authority);
    }
    for (name, value) in &head.headers {
        builder = builder.header(name.as_str(), value.as_str());
    }
    builder
        .body(())
        .map_err(|e| HelperError::new("bad-request", format!("request build: {e}")))
}

/// Dial one fresh QUIC connection for the head's trust tuple, spawn its
/// h3 driver, and observe the dial when the head asked for it.
async fn dial(head: &RequestHead, host: &str, port: u16) -> Result<(FreshConnection, DialFacts), HelperError> {
    let mut dns_ms: Option<f64> = None;
    let remotes: Vec<SocketAddr> = match &head.connect_address {
        // The resolveToAddress pin: dial this address; SNI and
        // certificate verification below keep the URL's host.
        Some(address) => {
            let ip = address
                .parse()
                .map_err(|e| HelperError::new("bad-request", format!("connectAddress: {e}")))?;
            vec![SocketAddr::new(ip, port)]
        }
        None => {
            let dns_start = Instant::now();
            let resolved: Vec<SocketAddr> = tokio::net::lookup_host((host, port))
                .await
                .map_err(|e| HelperError::new("dns", format!("resolving {host}: {e}")))?
                .take(MAX_DIAL_ADDRESSES)
                .collect();
            if resolved.is_empty() {
                return Err(HelperError::new("dns", format!("resolving {host}: no addresses")));
            }
            if head.capture_network {
                dns_ms = Some(dns_start.elapsed().as_secs_f64() * 1000.0);
            }
            resolved
        }
    };

    let tls_config = tls::client_config(head)?;
    let quic_tls = quinn::crypto::rustls::QuicClientConfig::try_from(tls_config)
        .map_err(|e| HelperError::new("internal", format!("QUIC TLS config: {e}")))?;
    let mut client_config = quinn::ClientConfig::new(Arc::new(quic_tls));
    let idle_ms = head.idle_timeout_ms.unwrap_or(DEFAULT_IDLE_TIMEOUT_MS);
    let mut transport = quinn::TransportConfig::default();
    transport.max_idle_timeout(Some(
        quinn::IdleTimeout::try_from(Duration::from_millis(idle_ms))
            .map_err(|e| HelperError::new("bad-request", format!("idleTimeoutMs: {e}")))?,
    ));
    client_config.transport_config(Arc::new(transport));

    // Try each resolved address in answer order — the resolver's
    // preference. An unroutable first answer (a dual-stack host's dead
    // IPv6 leg) fails fast and the next address gets its chance; only
    // when every address failed does the LAST failure name the hop's.
    let mut last_err: Option<HelperError> = None;
    for remote in remotes {
        let bind: SocketAddr = if remote.is_ipv4() { "0.0.0.0:0".parse().unwrap() } else { "[::]:0".parse().unwrap() };
        let mut endpoint = match quinn::Endpoint::client(bind) {
            Ok(endpoint) => endpoint,
            Err(e) => {
                last_err = Some(HelperError::new("internal", format!("UDP bind: {e}")));
                continue;
            }
        };
        endpoint.set_default_client_config(client_config.clone());

        let handshake_start = Instant::now();
        let connecting = match endpoint.connect(remote, host) {
            Ok(connecting) => connecting,
            Err(e) => {
                last_err = Some(HelperError::new("bad-request", format!("dial: {e}")));
                continue;
            }
        };
        let connection = match connecting.await {
            Ok(connection) => connection,
            Err(e) => {
                last_err = Some(wire_error("connect", e));
                continue;
            }
        };
        let handshake_ms = handshake_start.elapsed().as_secs_f64() * 1000.0;

        let facts: DialFacts = if head.capture_network {
            let local = endpoint
                .local_addr()
                .map_err(|e| HelperError::new("internal", format!("local address: {e}")))?;
            let remote_addr = connection.remote_address();
            Some((
                SocketFacts {
                    local_address: local.ip().to_string(),
                    local_port: local.port(),
                    remote_address: remote_addr.ip().to_string(),
                    remote_port: remote_addr.port(),
                },
                DialTimings { dns_ms, handshake_ms },
            ))
        } else {
            None
        };

        // The connection is up — an h3 setup failure past this point is
        // not an address problem, so it ends the hop rather than trying
        // the next address.
        let quinn_conn = h3_quinn::Connection::new(connection);
        let (mut driver, send_request) = h3::client::new(quinn_conn).await.map_err(|e| wire_error("h3", e))?;
        // The driver polls connection-level H3 state until it winds
        // down; its outcome type varies across pre-1.0 h3 releases, so
        // only the completion matters here — per-request failures
        // surface on the request stream below.
        let drive = tokio::spawn(async move {
            let _ = std::future::poll_fn(|cx| driver.poll_close(cx)).await;
        });

        return Ok((FreshConnection { endpoint, send_request, drive }, facts));
    }
    Err(last_err.unwrap_or_else(|| HelperError::new("internal", "dial: no addresses attempted")))
}

/// Open the request stream, send head + body, and wait for the response
/// head. Everything here happens BEFORE any response bytes — the
/// retry-once-on-stale boundary. A failure records whether the request
/// head already crossed (`sent`), the caller's idempotency gate.
async fn exchange(
    send_request: &mut SendRequest<OpenStreams, Bytes>,
    request: http::Request<()>,
    body: Bytes,
) -> Result<(http::Response<()>, RequestStream<h3_quinn::BidiStream<Bytes>, Bytes>), ExchangeFailure> {
    let mut stream = send_request
        .send_request(request)
        .await
        .map_err(|e| ExchangeFailure { sent: false, error: wire_error("h3", e) })?;
    if !body.is_empty() {
        stream
            .send_data(body)
            .await
            .map_err(|e| ExchangeFailure { sent: true, error: wire_error("h3", e) })?;
    }
    stream.finish().await.map_err(|e| ExchangeFailure { sent: true, error: wire_error("h3", e) })?;
    let response = stream
        .recv_response()
        .await
        .map_err(|e| ExchangeFailure { sent: true, error: wire_error("h3", e) })?;
    Ok((response, stream))
}

/// Emit RESPONSE_HEAD (with the dial's facts when instrumented), then
/// stream body, trailers, and RESPONSE_END.
async fn stream_response(
    id: u32,
    response: http::Response<()>,
    mut stream: RequestStream<h3_quinn::BidiStream<Bytes>, Bytes>,
    out: &mpsc::Sender<Vec<u8>>,
    facts: DialFacts,
) -> Result<(), HelperError> {
    let (socket, timings) = match facts {
        Some((socket, timings)) => (Some(socket), Some(timings)),
        None => (None, None),
    };
    let response_head = ResponseHead {
        status: response.status().as_u16(),
        headers: response
            .headers()
            .iter()
            .map(|(k, v)| (k.as_str().to_string(), latin1(v.as_bytes())))
            .collect(),
        socket,
        timings,
    };
    let payload = serde_json::to_vec(&response_head)
        .map_err(|e| HelperError::new("internal", format!("response head encode: {e}")))?;
    send(out, encode_frame(frame_type::RESPONSE_HEAD, id, &payload)).await?;

    while let Some(mut chunk) = stream.recv_data().await.map_err(|e| wire_error("h3", e))? {
        let bytes = chunk.copy_to_bytes(chunk.remaining());
        for slice in bytes.chunks(BODY_CHUNK_BYTES) {
            send(out, encode_frame(frame_type::RESPONSE_BODY, id, slice)).await?;
        }
    }
    if let Some(trailers) = stream.recv_trailers().await.map_err(|e| wire_error("h3", e))? {
        let pairs: Vec<(String, String)> = trailers
            .iter()
            .map(|(k, v)| (k.as_str().to_string(), latin1(v.as_bytes())))
            .collect();
        let payload = serde_json::to_vec(&pairs)
            .map_err(|e| HelperError::new("internal", format!("trailers encode: {e}")))?;
        send(out, encode_frame(frame_type::RESPONSE_TRAILERS, id, &payload)).await?;
    }
    send(out, encode_frame(frame_type::RESPONSE_END, id, &[])).await?;
    Ok(())
}

/// Header-value bytes as the string whose code points ARE the bytes
/// (latin1) — the reading Node's own HTTP stack gives non-UTF-8 header
/// values, instead of `from_utf8_lossy`'s replacement characters.
fn latin1(bytes: &[u8]) -> String {
    bytes.iter().map(|&b| char::from(b)).collect()
}

async fn send(out: &mpsc::Sender<Vec<u8>>, frame: Vec<u8>) -> Result<(), HelperError> {
    out.send(frame)
        .await
        .map_err(|_| HelperError::new("internal", "writer closed"))
}
