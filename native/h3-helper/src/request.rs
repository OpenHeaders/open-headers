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

pub async fn run(id: u32, head: RequestHead, body: Vec<u8>, out: mpsc::Sender<Vec<u8>>, pool: Arc<Pool>) {
    if let Err(e) = run_inner(id, &head, body, &out, &pool).await {
        let frame = ErrorFrame { code: e.code, message: e.message };
        let payload = serde_json::to_vec(&frame).unwrap_or_default();
        let _ = out.send(encode_frame(frame_type::ERROR, id, &payload)).await;
    }
}

/// What a fresh dial observed — present only when the head asked.
type DialFacts = Option<(SocketFacts, DialTimings)>;

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
                Err(_stale) => {
                    // Retry-once-on-stale: the reused connection failed
                    // before any response bytes came back — discard it
                    // and fall through to ONE fresh dial. The fresh
                    // dial's outcome is the hop's honest answer.
                    pool.discard(&key, pooled.generation);
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
        Err(e) => Err(e),
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
    let remote: SocketAddr = match &head.connect_address {
        // The resolveToAddress pin: dial this address; SNI and
        // certificate verification below keep the URL's host.
        Some(address) => {
            let ip = address
                .parse()
                .map_err(|e| HelperError::new("bad-request", format!("connectAddress: {e}")))?;
            SocketAddr::new(ip, port)
        }
        None => {
            let dns_start = Instant::now();
            let resolved = tokio::net::lookup_host((host, port))
                .await
                .map_err(|e| HelperError::new("dns", format!("resolving {host}: {e}")))?
                .next()
                .ok_or_else(|| HelperError::new("dns", format!("resolving {host}: no addresses")))?;
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

    let bind: SocketAddr = if remote.is_ipv4() { "0.0.0.0:0".parse().unwrap() } else { "[::]:0".parse().unwrap() };
    let mut endpoint = quinn::Endpoint::client(bind).map_err(|e| HelperError::new("internal", format!("UDP bind: {e}")))?;
    endpoint.set_default_client_config(client_config);

    let handshake_start = Instant::now();
    let connecting = endpoint
        .connect(remote, host)
        .map_err(|e| HelperError::new("bad-request", format!("dial: {e}")))?;
    let connection = connecting.await.map_err(|e| wire_error("connect", e))?;
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

    let quinn_conn = h3_quinn::Connection::new(connection);
    let (mut driver, send_request) = h3::client::new(quinn_conn).await.map_err(|e| wire_error("h3", e))?;
    // The driver polls connection-level H3 state until it winds down;
    // its outcome type varies across pre-1.0 h3 releases, so only the
    // completion matters here — per-request failures surface on the
    // request stream below.
    let drive = tokio::spawn(async move {
        let _ = std::future::poll_fn(|cx| driver.poll_close(cx)).await;
    });

    Ok((FreshConnection { endpoint, send_request, drive }, facts))
}

/// Open the request stream, send head + body, and wait for the response
/// head. Everything here happens BEFORE any response bytes — the
/// retry-once-on-stale boundary.
async fn exchange(
    send_request: &mut SendRequest<OpenStreams, Bytes>,
    request: http::Request<()>,
    body: Bytes,
) -> Result<(http::Response<()>, RequestStream<h3_quinn::BidiStream<Bytes>, Bytes>), HelperError> {
    let mut stream = send_request.send_request(request).await.map_err(|e| wire_error("h3", e))?;
    if !body.is_empty() {
        stream.send_data(body).await.map_err(|e| wire_error("h3", e))?;
    }
    stream.finish().await.map_err(|e| wire_error("h3", e))?;
    let response = stream.recv_response().await.map_err(|e| wire_error("h3", e))?;
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
            .map(|(k, v)| (k.as_str().to_string(), String::from_utf8_lossy(v.as_bytes()).into_owned()))
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
            .map(|(k, v)| (k.as_str().to_string(), String::from_utf8_lossy(v.as_bytes()).into_owned()))
            .collect();
        let payload = serde_json::to_vec(&pairs)
            .map_err(|e| HelperError::new("internal", format!("trailers encode: {e}")))?;
        send(out, encode_frame(frame_type::RESPONSE_TRAILERS, id, &payload)).await?;
    }
    send(out, encode_frame(frame_type::RESPONSE_END, id, &[])).await?;
    Ok(())
}

async fn send(out: &mpsc::Sender<Vec<u8>>, frame: Vec<u8>) -> Result<(), HelperError> {
    out.send(frame)
        .await
        .map_err(|_| HelperError::new("internal", "writer closed"))
}
