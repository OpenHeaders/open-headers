//! oh-h3-helper — the HTTP/3 wire pipeline behind the request engine's
//! wire-hop seam. Reads frames from stdin, writes frames to stdout
//! (single writer task — frames never interleave mid-frame), one tokio
//! task per in-flight request, one shared connection pool. stdin EOF is
//! the graceful shutdown signal: drain in-flight requests, then exit.
//! The helper also exits on its own after 120 idle seconds with nothing
//! in flight (exit code 0 — the client treats that as benign; the next
//! send respawns). stderr is human log text only, never protocol data.

mod error;
mod framing;
mod pool;
mod protocol;
mod request;
mod tls;

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use framing::{encode_frame, read_frame, Frame};
use protocol::{frame_type, ErrorFrame, Hello, RequestHead, PROTOCOL_VERSION};

const IDLE_EXIT_SECS: u64 = 120;

/// A request head whose announced body is still streaming in.
struct PendingBody {
    head: RequestHead,
    body: Vec<u8>,
}

#[tokio::main]
async fn main() {
    let (out_tx, mut out_rx) = mpsc::channel::<Vec<u8>>(64);
    let writer = tokio::spawn(async move {
        let mut stdout = tokio::io::stdout();
        while let Some(frame) = out_rx.recv().await {
            if stdout.write_all(&frame).await.is_err() {
                return;
            }
            if stdout.flush().await.is_err() {
                return;
            }
        }
    });

    let hello = Hello { protocol: PROTOCOL_VERSION, helper: env!("CARGO_PKG_VERSION") };
    let payload = serde_json::to_vec(&hello).expect("HELLO encodes");
    if out_tx.send(encode_frame(frame_type::HELLO, 0, &payload)).await.is_err() {
        return;
    }

    // stdin reads run in their own task feeding a channel — `select!`
    // cancels the losing branch, and a cancelled read_exact would drop
    // partially consumed header bytes; a channel recv is cancel-safe.
    let (frame_tx, mut frame_rx) = mpsc::channel::<Frame>(16);
    tokio::spawn(async move {
        let mut stdin = tokio::io::stdin();
        loop {
            match read_frame(&mut stdin).await {
                Ok(Some(frame)) => {
                    if frame_tx.send(frame).await.is_err() {
                        return;
                    }
                }
                // Clean EOF or an unrecoverable stdin failure — either
                // way the session is over; the closed channel tells the
                // frame loop.
                Ok(None) => return,
                Err(e) => {
                    eprintln!("oh-h3-helper: stdin: {e}");
                    return;
                }
            }
        }
    });

    let pool = Arc::new(pool::Pool::new());
    let mut pending: HashMap<u32, PendingBody> = HashMap::new();
    let mut running: HashMap<u32, JoinHandle<()>> = HashMap::new();

    loop {
        let frame = tokio::select! {
            maybe = frame_rx.recv() => match maybe {
                Some(frame) => frame,
                None => break,
            },
            // Re-armed every loop turn, so it fires only after a full
            // idle window since the last frame (or the last check).
            _ = tokio::time::sleep(Duration::from_secs(IDLE_EXIT_SECS)) => {
                running.retain(|_, handle| !handle.is_finished());
                if running.is_empty() && pending.is_empty() {
                    return;
                }
                continue;
            }
        };
        running.retain(|_, handle| !handle.is_finished());
        match frame.frame_type {
            frame_type::REQUEST => match serde_json::from_slice::<RequestHead>(&frame.payload) {
                Ok(head) => {
                    if head.body_bytes == 0 {
                        running.insert(
                            frame.id,
                            tokio::spawn(request::run(frame.id, head, Vec::new(), out_tx.clone(), pool.clone())),
                        );
                    } else {
                        pending.insert(frame.id, PendingBody { head, body: Vec::new() });
                    }
                }
                Err(e) => send_error(&out_tx, frame.id, "bad-request", format!("request head: {e}")).await,
            },
            frame_type::REQUEST_BODY => {
                if let Some(entry) = pending.get_mut(&frame.id) {
                    entry.body.extend_from_slice(&frame.payload);
                }
            }
            frame_type::REQUEST_END => {
                if let Some(entry) = pending.remove(&frame.id) {
                    if entry.body.len() as u64 != entry.head.body_bytes {
                        send_error(
                            &out_tx,
                            frame.id,
                            "body-mismatch",
                            format!("announced {} body bytes, received {}", entry.head.body_bytes, entry.body.len()),
                        )
                        .await;
                        continue;
                    }
                    running.insert(
                        frame.id,
                        tokio::spawn(request::run(frame.id, entry.head, entry.body, out_tx.clone(), pool.clone())),
                    );
                }
            }
            frame_type::CANCEL => {
                pending.remove(&frame.id);
                if let Some(handle) = running.remove(&frame.id) {
                    // An aborted task sends nothing further; a frame
                    // already queued is dropped node-side (the client
                    // forgot the id when it canceled).
                    handle.abort();
                }
            }
            other => {
                eprintln!("oh-h3-helper: unknown frame type 0x{other:02x} for id {}", frame.id);
            }
        }
    }

    for (_, handle) in running {
        let _ = handle.await;
    }
    drop(out_tx);
    let _ = writer.await;
}

async fn send_error(out: &mpsc::Sender<Vec<u8>>, id: u32, code: &'static str, message: String) {
    let frame = ErrorFrame { code, message };
    let payload = serde_json::to_vec(&frame).unwrap_or_default();
    let _ = out.send(encode_frame(frame_type::ERROR, id, &payload)).await;
}
