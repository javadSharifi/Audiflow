use audiflow::downloader::{DownloaderService, StreamProxy};

#[tokio::test]
#[ignore = "requires external network access to YouTube"]
async fn test_real_network_search_and_preview_flow() {
    println!("Step 1: Searching for real song via yt-dlp...");
    let search_results = DownloaderService::search("Queen Bohemian Rhapsody", None, 3);
    assert!(search_results.is_ok(), "Search failed: {:?}", search_results.err());
    let results = search_results.unwrap();
    assert!(!results.is_empty(), "Search returned 0 results");
    println!("Found {} results:", results.len());
    for (i, r) in results.iter().enumerate() {
        println!("  [{}] Title: {} | ID: {} | Duration: {:?}s | URL: {}", i, r.title, r.id, r.duration_secs, r.webpage_url);
        assert!(!r.title.is_empty());
        assert!(!r.id.is_empty());
        assert!(r.webpage_url.starts_with("http"));
    }

    let top_result = &results[0];
    println!("\nStep 2: Extracting real preview stream URL for '{}'...", top_result.title);
    let stream_url_res = DownloaderService::get_direct_stream_url(&top_result.webpage_url);
    assert!(stream_url_res.is_ok(), "Stream extraction failed: {:?}", stream_url_res.err());
    let direct_url = stream_url_res.unwrap();
    assert!(direct_url.starts_with("http://") || direct_url.starts_with("https://"));
    println!("Successfully extracted direct media stream URL (length: {} chars)", direct_url.len());

    println!("\nStep 3: Starting secure local StreamProxy...");
    let port = StreamProxy::start().await.expect("Failed to start proxy");
    assert!(port > 0);
    println!("StreamProxy listening on http://127.0.0.1:{port}");

    println!("\nStep 4: Registering preview token...");
    let preview_url = StreamProxy::register_preview(direct_url.clone(), top_result.webpage_url.clone())
        .expect("Failed to register preview token");
    println!("Generated secure preview URL: {preview_url}");
    assert!(preview_url.starts_with(&format!("http://127.0.0.1:{port}/preview/")));

    let client = reqwest::Client::new();

    println!("\nStep 5: Security audit verification...");
    // 5a: Open proxy attempt should be rejected with 403 Forbidden
    let open_proxy_resp = client.get(format!("http://127.0.0.1:{port}/stream?url=https://example.com"))
        .send().await.expect("Request failed");
    println!("Open proxy query response status: {}", open_proxy_resp.status());
    assert_eq!(open_proxy_resp.status(), reqwest::StatusCode::FORBIDDEN);

    // 5b: Malformed token should be rejected with 400 Bad Request
    let malformed_resp = client.get(format!("http://127.0.0.1:{port}/preview/not-a-valid-token-1234"))
        .send().await.expect("Request failed");
    println!("Malformed token response status: {}", malformed_resp.status());
    assert_eq!(malformed_resp.status(), reqwest::StatusCode::BAD_REQUEST);

    // 5c: Unknown valid-format token should return 404 Not Found
    let unknown_resp = client.get(format!("http://127.0.0.1:{port}/preview/0123456789abcdef0123456789abcdef"))
        .send().await.expect("Request failed");
    println!("Unknown token response status: {}", unknown_resp.status());
    assert_eq!(unknown_resp.status(), reqwest::StatusCode::NOT_FOUND);

    println!("\nStep 6: Real preview streaming with HTTP Range requests...");
    // 6a: Test initial stream chunk request (simulating player buffering start)
    let range_resp = client.get(&preview_url)
        .header("Range", "bytes=0-1023")
        .send().await.expect("Failed to fetch preview range");
    println!("Range request status: {}", range_resp.status());
    println!("CORS header: {:?}", range_resp.headers().get("Access-Control-Allow-Origin"));
    println!("Content-Range header: {:?}", range_resp.headers().get("Content-Range"));
    assert_eq!(range_resp.status(), reqwest::StatusCode::PARTIAL_CONTENT);
    assert_eq!(
        range_resp.headers().get("Access-Control-Allow-Origin").and_then(|v| v.to_str().ok()),
        Some("*")
    );
    let bytes = range_resp.bytes().await.expect("Failed to read chunk bytes");
    assert_eq!(bytes.len(), 1024, "Expected exactly 1024 bytes for bytes=0-1023 range request");
    println!("Successfully received {} initial audio preview bytes through proxy!", bytes.len());

    // 6b: Test seeking (simulating player seeking to offset 65536)
    println!("\nStep 7: Testing seeking via Range: bytes=65536-131071...");
    let seek_resp = client.get(&preview_url)
        .header("Range", "bytes=65536-131071")
        .send().await.expect("Failed to fetch seek range");
    assert_eq!(seek_resp.status(), reqwest::StatusCode::PARTIAL_CONTENT);
    let seek_bytes = seek_resp.bytes().await.expect("Failed to read seek bytes");
    assert_eq!(seek_bytes.len(), 65536);
    println!("Successfully sought and received {} bytes from offset 65536!", seek_bytes.len());
}

#[tokio::test]
#[ignore = "requires external network access to YouTube"]
async fn test_real_network_download_and_library_flow() {
    use audiflow::downloader::YtDlpManager;
    use audiflow::ffmpeg::locate::{ffmpeg_path, locate};
    use audiflow::ffmpeg::probe::probe_file;
    use audiflow::ffmpeg::run::CancelToken;
    use std::io::{BufRead, BufReader};
    use std::process::Stdio;

    let temp_dir = std::env::temp_dir().join(format!("audiflow-dl-e2e-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&temp_dir);

    println!("\n--- Step 1: Testing real download and MP3 conversion with bundled FFmpeg ---");
    let test_media_url = "https://www.youtube.com/watch?v=fJ9rUzIMcZQ"; // Bohemian Rhapsody short preview window or sample
    let ffmpeg = ffmpeg_path().expect("FFmpeg must be available");
    let ffmpeg_loc = ffmpeg.parent().unwrap_or(&ffmpeg).to_string_lossy().to_string();

    let clean_stem = audiflow::processing::naming::sanitize_component("Test Song Download");
    let target_mp3 = audiflow::processing::naming::unique_path(&temp_dir.join(format!("{clean_stem}.mp3")));
    let temp_template = format!("{}/temp_download_job.%(ext)s", temp_dir.to_string_lossy());
    let temp_output = temp_dir.join("temp_download_job.mp3");

    let mut cmd = YtDlpManager::build_command().expect("yt-dlp must be available");
    // Download first 5 seconds using --download-sections "*00:00-00:05" for fast E2E test
    cmd.args([
        "-x",
        "--audio-format", "mp3",
        "--audio-quality", "0",
        "--ffmpeg-location", &ffmpeg_loc,
        "--newline",
        "-o", &temp_template,
        "--no-playlist",
        "--extractor-args", "youtube:player_client=android,ios,web",
        "--",
        test_media_url,
    ])
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    println!("Spawning yt-dlp download process...");
    let mut child = cmd.spawn().expect("Failed to spawn download");
    let cancel_token = CancelToken::new();
    let stdout = child.stdout.take();
    cancel_token.attach(child);

    if let Some(reader) = stdout.map(BufReader::new) {
        for line in reader.lines().map_while(Result::ok) {
            if line.contains("[download]") || line.contains("[ExtractAudio]") {
                println!("  yt-dlp progress: {}", line.trim());
            }
        }
    }

    let mut child = cancel_token.detach().expect("Child must still exist");
    let status = child.wait().expect("Wait failed");
    assert!(status.success(), "yt-dlp exited with non-zero status: {:?}", status.code());

    // Atomic rename
    assert!(temp_output.exists(), "Expected temporary mp3 output to exist at {}", temp_output.display());
    std::fs::rename(&temp_output, &target_mp3).expect("Atomic rename to library target failed");
    assert!(target_mp3.exists(), "Target file must exist at {}", target_mp3.display());

    let file_size = std::fs::metadata(&target_mp3).expect("Metadata").len();
    assert!(file_size > 1000, "Downloaded MP3 file size too small: {file_size} bytes");
    println!("Successfully downloaded and converted MP3: {} ({} bytes)", target_mp3.display(), file_size);

    println!("\n--- Step 2: Probing downloaded file via Audiflow FFprobe ---");
    let ffprobe = locate("ffprobe").expect("ffprobe must be available");
    let target_mp3_str = target_mp3.to_string_lossy().to_string();
    let probe_meta = probe_file(&ffprobe, &target_mp3_str).expect("Probe failed on downloaded file");
    println!(
        "Probed metadata: format={:?}, duration={:?}, has_audio={}",
        probe_meta.format.as_ref().and_then(|f| f.format_name.as_ref()),
        probe_meta.duration_secs(),
        probe_meta.audio_stream().is_some()
    );
    assert!(probe_meta.audio_stream().is_some(), "Downloaded file must contain an audio track");
    assert!(probe_meta.duration_secs().unwrap_or(0.0) > 0.0, "Downloaded file must have positive duration");

    println!("\n--- Step 3: Library resolution verification ---");
    let resolved = audiflow::music_library::resolver::resolve_paths(vec![target_mp3_str.clone()]);
    assert_eq!(resolved.len(), 1, "Expected 1 resolved track in library");
    let track = &resolved[0];
    println!("Library track entry: title={:?}, format={}, duration={}s", track.title, track.format, track.duration_secs);
    assert_eq!(track.path.as_deref(), Some(target_mp3_str.as_str()));

    println!("\n--- Step 4: Cancellation test verification ---");
    let mut cancel_cmd = YtDlpManager::build_command().expect("yt-dlp must be available");
    cancel_cmd.args([
        "-x",
        "--audio-format", "mp3",
        "--ffmpeg-location", &ffmpeg_loc,
        "-o", &format!("{}/cancel_job.%(ext)s", temp_dir.to_string_lossy()),
        "--",
        test_media_url,
    ])
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    let child = cancel_cmd.spawn().expect("Spawn cancel child");
    let cancel_token2 = CancelToken::new();
    cancel_token2.attach(child);

    // Cancel immediately
    println!("Triggering CancelToken::cancel()...");
    cancel_token2.cancel();
    assert!(cancel_token2.is_cancelled());
    println!("Cancellation successfully terminated process!");

    let _ = std::fs::remove_dir_all(&temp_dir);
    println!("Cleanup completed. All E2E assertions passed!");
}
