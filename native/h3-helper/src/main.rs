//! oh-h3-helper — the HTTP/3 wire pipeline behind the request engine's
//! wire-hop seam. Reads frames from stdin, writes frames to stdout
//! (single writer task — frames never interleave mid-frame), one tokio
//! task per in-flight request. stdin EOF is the graceful shutdown
//! signal: drain in-flight requests, then exit. stderr is human log
//! text only, never protocol data.

mod error;
mod framing;
mod protocol;
mod request;
mod tls;

use std::collections::HashMap;

use tokio::io::AsyncWriteExt;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

use framing::{encode_frame, read_frame, Frame};
use protocol::{frame_type, ErrorFrame, Hello, RequestHead, PROTOCOL_VERSION};

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

    let mut stdin = tokio::io::stdin();
    let mut pending: HashMap<u32, PendingBody> = HashMap::new();
    let mut running: HashMap<u32, JoinHandle<()>> = HashMap::new();

    loop {
        let frame = match read_frame(&mut stdin).await {
            Ok(Some(frame)) => frame,
            // Clean EOF or an unrecoverable stdin failure — either way
            // the session is over; drain what's in flight below.
            Ok(None) => break,
            Err(e) => {
                eprintln!("oh-h3-helper: stdin: {e}");
                break;
            }
        };
        running.retain(|_, handle| !handle.is_finished());
        match frame.frame_type {
            frame_type::REQUEST => match serde_json::from_slice::<RequestHead>(&frame.payload) {
                Ok(head) => {
                    if head.body_bytes == 0 {
                        running.insert(frame.id, tokio::spawn(request::run(frame.id, head, Vec::new(), out_tx.clone())));
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
                    running.insert(frame.id, tokio::spawn(request::run(frame.id, entry.head, entry.body, out_tx.clone())));
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
