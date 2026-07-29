//! One wire hop: resolve (or take the pinned address), dial one fresh
//! QUIC connection with SNI = the URL's host, run the HTTP/3 exchange,
//! and stream the response back as frames. One connection per hop —
//! the per-hop failure discipline; pooling is a post-Phase-E residual.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use bytes::{Buf, Bytes};
use http::Uri;
use tokio::sync::mpsc;

use crate::error::{wire_error, HelperError};
use crate::framing::encode_frame;
use crate::protocol::{frame_type, ErrorFrame, RequestHead, ResponseHead};
use crate::tls;

const DEFAULT_IDLE_TIMEOUT_MS: u64 = 30_000;
const BODY_CHUNK_BYTES: usize = 64 * 1024;

pub async fn run(id: u32, head: RequestHead, body: Vec<u8>, out: mpsc::Sender<Vec<u8>>) {
    if let Err(e) = run_inner(id, &head, body, &out).await {
        let frame = ErrorFrame { code: e.code, message: e.message };
        let payload = serde_json::to_vec(&frame).unwrap_or_default();
        let _ = out.send(encode_frame(frame_type::ERROR, id, &payload)).await;
    }
}

async fn run_inner(id: u32, head: &RequestHead, body: Vec<u8>, out: &mpsc::Sender<Vec<u8>>) -> Result<(), HelperError> {
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

    let remote: SocketAddr = match &head.connect_address {
        // The resolveToAddress pin: dial this address; SNI and
        // certificate verification below keep the URL's host.
        Some(address) => {
            let ip = address
                .parse()
                .map_err(|e| HelperError::new("bad-request", format!("connectAddress: {e}")))?;
            SocketAddr::new(ip, port)
        }
        None => tokio::net::lookup_host((host.as_str(), port))
            .await
            .map_err(|e| HelperError::new("dns", format!("resolving {host}: {e}")))?
            .next()
            .ok_or_else(|| HelperError::new("dns", format!("resolving {host}: no addresses")))?,
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

    let connecting = endpoint
        .connect(remote, &host)
        .map_err(|e| HelperError::new("bad-request", format!("dial: {e}")))?;
    let connection = connecting.await.map_err(|e| wire_error("connect", e))?;

    let quinn_conn = h3_quinn::Connection::new(connection);
    let (mut driver, mut send_request) = h3::client::new(quinn_conn).await.map_err(|e| wire_error("h3", e))?;
    // The driver polls connection-level H3 state until it winds down;
    // its outcome type varies across pre-1.0 h3 releases, so only the
    // completion matters here — per-request failures surface on the
    // request stream below.
    let drive = tokio::spawn(async move {
        let _ = std::future::poll_fn(|cx| driver.poll_close(cx)).await;
    });

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
    let request = builder
        .body(())
        .map_err(|e| HelperError::new("bad-request", format!("request build: {e}")))?;

    let mut stream = send_request.send_request(request).await.map_err(|e| wire_error("h3", e))?;
    if !body.is_empty() {
        stream.send_data(Bytes::from(body)).await.map_err(|e| wire_error("h3", e))?;
    }
    stream.finish().await.map_err(|e| wire_error("h3", e))?;

    let response = stream.recv_response().await.map_err(|e| wire_error("h3", e))?;
    let response_head = ResponseHead {
        status: response.status().as_u16(),
        headers: response
            .headers()
            .iter()
            .map(|(k, v)| (k.as_str().to_string(), String::from_utf8_lossy(v.as_bytes()).into_owned()))
            .collect(),
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

    drop(send_request);
    drive.abort();
    endpoint.close(0u32.into(), b"done");
    Ok(())
}

async fn send(out: &mpsc::Sender<Vec<u8>>, frame: Vec<u8>) -> Result<(), HelperError> {
    out.send(frame)
        .await
        .map_err(|_| HelperError::new("internal", "writer closed"))
}
