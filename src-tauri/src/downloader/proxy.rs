use std::collections::HashMap;
use std::sync::atomic::{AtomicU16, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

use crate::error::AppError;
use super::service::DownloaderService;

static PROXY_PORT: AtomicU16 = AtomicU16::new(0);

struct TokenEntry {
    upstream_url: String,
    webpage_url: String,
    expires_at: Instant,
}

static TOKEN_STORE: Mutex<Option<HashMap<String, TokenEntry>>> = Mutex::new(None);

pub struct StreamProxy;

impl StreamProxy {
    /// Start the loopback HTTP audio proxy on an available port.
    pub async fn start() -> Result<u16, AppError> {
        let current = PROXY_PORT.load(Ordering::SeqCst);
        if current > 0 {
            return Ok(current);
        }

        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .map_err(|e| AppError::Other(format!("Failed to bind stream proxy listener: {e}")))?;

        let port = listener
            .local_addr()
            .map_err(|e| AppError::Other(format!("Failed to obtain proxy local port: {e}")))?
            .port();

        PROXY_PORT.store(port, Ordering::SeqCst);
        crate::log_info!("Stream proxy running securely at http://127.0.0.1:{port}");

        let client = Arc::new(
            reqwest::Client::builder()
                .redirect(reqwest::redirect::Policy::limited(10))
                .build()
                .unwrap_or_default(),
        );

        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((stream, _)) => {
                        let c = Arc::clone(&client);
                        tokio::spawn(async move {
                            if let Err(err) = handle_connection(stream, c).await {
                                crate::log_warn!("Stream proxy error: {err}");
                            }
                        });
                    }
                    Err(e) => {
                        crate::log_warn!("Stream proxy accept error: {e}");
                        break;
                    }
                }
            }
        });

        Ok(port)
    }

    /// Register a direct stream URL server-side and return an opaque preview URL.
    pub fn register_preview(upstream_url: String, webpage_url: String) -> Result<String, AppError> {
        let port = PROXY_PORT.load(Ordering::SeqCst);
        if port == 0 {
            return Err(AppError::Other("Stream proxy is not running".into()));
        }

        let token = generate_secure_token();
        let expires_at = Instant::now() + Duration::from_secs(3600); // 1 hour TTL

        {
            let mut guard = TOKEN_STORE.lock().unwrap();
            let store = guard.get_or_insert_with(HashMap::new);
            let now = Instant::now();
            store.retain(|_, v| v.expires_at > now);
            store.insert(token.clone(), TokenEntry { upstream_url, webpage_url, expires_at });
        }

        Ok(format!("http://127.0.0.1:{port}/preview/{token}"))
    }

    /// Return the active proxy port if started.
    pub fn get_port() -> Option<u16> {
        let p = PROXY_PORT.load(Ordering::SeqCst);
        if p > 0 { Some(p) } else { None }
    }
}

fn generate_secure_token() -> String {
    use std::hash::{BuildHasher, Hasher};
    let s = std::collections::hash_map::RandomState::new();
    let mut h = s.build_hasher();
    h.write_u128(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos());
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    h.write_u64(COUNTER.fetch_add(1, Ordering::Relaxed));
    let h1 = h.finish();
    let mut h2 = s.build_hasher();
    h2.write_u64(h1);
    format!("{h1:016x}{:016x}", h2.finish())
}

async fn handle_connection(
    mut stream: TcpStream,
    client: Arc<reqwest::Client>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = [0u8; 4096];
    let n = stream.read(&mut buf).await?;
    if n == 0 { return Ok(()); }

    let request = String::from_utf8_lossy(&buf[..n]);
    let mut lines = request.lines();
    let req_line = lines.next().unwrap_or_default();
    let parts: Vec<&str> = req_line.split_whitespace().collect();
    if parts.len() < 2 { return Ok(()); }

    let (method, path) = (parts[0], parts[1]);

    if method == "OPTIONS" {
        let res = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Allow-Headers: Range, Accept, Origin\r\nAccess-Control-Max-Age: 86400\r\nConnection: close\r\n\r\n";
        stream.write_all(res.as_bytes()).await?;
        return Ok(());
    }

    if method != "GET" && method != "HEAD" {
        let res = "HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\n\r\n";
        stream.write_all(res.as_bytes()).await?;
        return Ok(());
    }

    // Security gate: only `/preview/<token>` paths are permitted. Reject open proxy attempts.
    let token = match path.strip_prefix("/preview/") {
        Some(rest) => {
            let t = rest.split('?').next().unwrap_or_default();
            if t.len() == 32 && t.chars().all(|c| c.is_ascii_hexdigit()) {
                t
            } else {
                let res = "HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\nMalformed preview token";
                stream.write_all(res.as_bytes()).await?;
                return Ok(());
            }
        }
        None => {
            let res = "HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\nAccess denied: only registered preview tokens permitted";
            stream.write_all(res.as_bytes()).await?;
            return Ok(());
        }
    };

    let lookup = {
        let guard = TOKEN_STORE.lock().unwrap();
        guard.as_ref().and_then(|s| s.get(token)).map(|e| {
            (e.upstream_url.clone(), e.webpage_url.clone(), Instant::now() > e.expires_at)
        })
    };

    let (upstream_url, webpage_url) = match lookup {
        Some((u, w, false)) => (u, w),
        Some((_, w, true)) => match DownloaderService::get_direct_stream_url(&w) {
            Ok(fresh) => {
                if let Ok(mut guard) = TOKEN_STORE.lock() {
                    if let Some(store) = guard.as_mut() {
                        if let Some(entry) = store.get_mut(token) {
                            entry.upstream_url = fresh.clone();
                            entry.expires_at = Instant::now() + Duration::from_secs(3600);
                        }
                    }
                }
                (fresh, w)
            }
            Err(_) => {
                let _ = stream.write_all(b"HTTP/1.1 410 Gone\r\nConnection: close\r\n\r\nExpired").await;
                return Ok(());
            }
        },
        None => {
            let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\nUnknown token").await;
            return Ok(());
        }
    };

    let mut range_header = None;
    for line in lines {
        if line.is_empty() { break; }
        if let Some(r) = line.strip_prefix("Range: ").or_else(|| line.strip_prefix("range: ")) {
            range_header = Some(r.trim().to_string());
        }
    }

    let send_upstream = |url: &str, rng: Option<&str>| {
        let mut req = client.get(url);
        if let Some(r) = rng { req = req.header("Range", r); }
        req.header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        )
    };

    let mut upstream = match send_upstream(&upstream_url, range_header.as_deref()).send().await {
        Ok(r) => r,
        Err(e) => {
            let res = format!("HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n{e}");
            stream.write_all(res.as_bytes()).await?;
            return Ok(());
        }
    };

    if (upstream.status() == reqwest::StatusCode::FORBIDDEN || upstream.status() == reqwest::StatusCode::GONE)
        && !webpage_url.is_empty()
    {
        if let Ok(refreshed) = DownloaderService::get_direct_stream_url(&webpage_url) {
            if let Ok(new_resp) = send_upstream(&refreshed, range_header.as_deref()).send().await {
                if new_resp.status().is_success() || new_resp.status() == reqwest::StatusCode::PARTIAL_CONTENT {
                    if let Ok(mut guard) = TOKEN_STORE.lock() {
                        if let Some(store) = guard.as_mut() {
                            if let Some(entry) = store.get_mut(token) {
                                entry.upstream_url = refreshed;
                                entry.expires_at = Instant::now() + Duration::from_secs(3600);
                            }
                        }
                    }
                    upstream = new_resp;
                }
            }
        }
    }

    let status_code = upstream.status().as_u16();
    let reason = upstream.status().canonical_reason().unwrap_or("OK");
    let ct = upstream.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("audio/mp4");
    let cl = upstream.headers().get(reqwest::header::CONTENT_LENGTH).and_then(|v| v.to_str().ok());
    let cr = upstream.headers().get(reqwest::header::CONTENT_RANGE).and_then(|v| v.to_str().ok());

    let mut headers = format!(
        "HTTP/1.1 {status_code} {reason}\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Methods: GET, HEAD, OPTIONS\r\n\
Access-Control-Allow-Headers: Range, Accept, Origin\r\n\
Access-Control-Expose-Headers: Content-Range, Content-Length, Accept-Ranges\r\n\
Accept-Ranges: bytes\r\n\
Content-Type: {ct}\r\n"
    );
    if let Some(v) = cl { headers.push_str(&format!("Content-Length: {v}\r\n")); }
    if let Some(v) = cr { headers.push_str(&format!("Content-Range: {v}\r\n")); }
    headers.push_str("Connection: close\r\n\r\n");
    stream.write_all(headers.as_bytes()).await?;

    if method == "HEAD" { return Ok(()); }

    let mut body = upstream;
    while let Some(chunk) = body.chunk().await? {
        if stream.write_all(&chunk).await.is_err() { break; }
    }

    let _ = stream.flush().await;
    Ok(())
}
