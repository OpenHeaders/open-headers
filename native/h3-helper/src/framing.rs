//! Frame codec: 9-byte big-endian header (u8 type, u32 request id,
//! u32 payload length) followed by the payload.

use tokio::io::{AsyncRead, AsyncReadExt};

pub const MAX_PAYLOAD_BYTES: usize = 16 * 1024 * 1024;

pub struct Frame {
    pub frame_type: u8,
    pub id: u32,
    pub payload: Vec<u8>,
}

/// Read one frame; `None` on a clean EOF at a frame boundary (the
/// graceful-shutdown signal — node closed our stdin).
pub async fn read_frame<R: AsyncRead + Unpin>(reader: &mut R) -> std::io::Result<Option<Frame>> {
    let mut header = [0u8; 9];
    match reader.read_exact(&mut header).await {
        Ok(_) => {}
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    }
    let frame_type = header[0];
    let id = u32::from_be_bytes([header[1], header[2], header[3], header[4]]);
    let len = u32::from_be_bytes([header[5], header[6], header[7], header[8]]) as usize;
    if len > MAX_PAYLOAD_BYTES {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("frame payload of {len} bytes exceeds the {MAX_PAYLOAD_BYTES}-byte ceiling"),
        ));
    }
    let mut payload = vec![0u8; len];
    reader.read_exact(&mut payload).await?;
    Ok(Some(Frame { frame_type, id, payload }))
}

pub fn encode_frame(frame_type: u8, id: u32, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(9 + payload.len());
    out.push(frame_type);
    out.extend_from_slice(&id.to_be_bytes());
    out.extend_from_slice(&(payload.len() as u32).to_be_bytes());
    out.extend_from_slice(payload);
    out
}
