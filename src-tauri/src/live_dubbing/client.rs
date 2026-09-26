/// Tokio-Tungstenite bidirectional WebSocket client for Gemini Live API.
/// Connects to GenerativeService.BidiGenerateContent for low-latency streaming.
/// Adheres to Constitution Principle VIII (strictly <= 300 lines).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::protocol::Message;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};

const GEMINI_LIVE_WS_BASE: &str =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

pub struct GeminiLiveClient {
    is_connected: Arc<AtomicBool>,
    audio_tx: Option<mpsc::Sender<Vec<u8>>>,
    stop_tx: Option<tokio::sync::broadcast::Sender<()>>,
}

impl GeminiLiveClient {
    pub fn new() -> Self {
        Self {
            is_connected: Arc::new(AtomicBool::new(false)),
            audio_tx: None,
            stop_tx: None,
        }
    }

    pub fn is_connected(&self) -> bool {
        self.is_connected.load(Ordering::SeqCst)
    }

    pub async fn connect(
        &mut self,
        api_key: &str,
        target_lang: &str,
        voice_persona: &str,
        on_audio_received: mpsc::Sender<Vec<u8>>,
    ) -> Result<(), String> {
        let ws_url = format!("{}?key={}", GEMINI_LIVE_WS_BASE, api_key.trim());
        let (ws_stream, _) = connect_async(&ws_url)
            .await
            .map_err(|e| format!("Gemini Live WebSocket connection failed: {}", e))?;

        let (mut write_half, mut read_half) = ws_stream.split();
        let (audio_in_tx, mut audio_in_rx) = mpsc::channel::<Vec<u8>>(64);
        let (stop_tx, mut stop_rx) = tokio::sync::broadcast::channel::<()>(1);

        let voice = if voice_persona.is_empty() { "Aoede" } else { voice_persona };
        let setup_msg = json!({
            "setup": {
                "model": "models/gemini-2.0-flash-exp",
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "speechConfig": {
                        "voiceConfig": {
                            "prebuiltVoiceConfig": {
                                "voiceName": voice
                            }
                        }
                    }
                },
                "systemInstruction": {
                    "parts": [
                        {
                            "text": format!(
                                "You are a real-time live audio dubbing engine. Directly translate any heard speech into {} and speak ONLY the translation. Never converse, explain, or add filler words.",
                                target_lang
                            )
                        }
                    ]
                }
            }
        });

        write_half
            .send(Message::Text(setup_msg.to_string().into()))
            .await
            .map_err(|e| format!("Failed to send setup message: {}", e))?;

        let is_connected_flag = self.is_connected.clone();
        is_connected_flag.store(true, Ordering::SeqCst);

        // Sender task: forwards 16kHz PCM audio buffers to Gemini
        let is_conn_tx = is_connected_flag.clone();
        let mut stop_rx_send = stop_tx.subscribe();
        tokio::spawn(async move {
            use base64::Engine;
            while is_conn_tx.load(Ordering::Relaxed) {
                tokio::select! {
                    Some(pcm) = audio_in_rx.recv() => {
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&pcm);
                        let audio_payload = json!({
                            "realtimeInput": {
                                "mediaChunks": [
                                    {
                                        "mimeType": "audio/pcm;rate=16000",
                                        "data": b64
                                    }
                                ]
                            }
                        });
                        if let Err(e) = write_half.send(Message::Text(audio_payload.to_string().into())).await {
                            eprintln!("Error sending audio chunk to Gemini: {}", e);
                            break;
                        }
                    }
                    _ = stop_rx_send.recv() => break,
                    else => break,
                }
            }
            let _ = write_half.close().await;
        });

        // Receiver task: listens for model audio chunks and emits them
        let is_conn_rx = is_connected_flag.clone();
        tokio::spawn(async move {
            use base64::Engine;
            while is_conn_rx.load(Ordering::Relaxed) {
                tokio::select! {
                    msg = read_half.next() => {
                        match msg {
                            Some(Ok(Message::Text(text))) => {
                                if let Ok(val) = serde_json::from_str::<Value>(&text) {
                                    if let Some(parts) = val.pointer("/serverContent/modelTurn/parts")
                                        .and_then(|p| p.as_array()) {
                                        for part in parts {
                                            if let Some(b64) = part.pointer("/inlineData/data").and_then(|d| d.as_str()) {
                                                if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) {
                                                    let _ = on_audio_received.send(bytes).await;
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            Some(Ok(Message::Close(_))) | None => {
                                is_conn_rx.store(false, Ordering::SeqCst);
                                break;
                            }
                            Some(Err(e)) => {
                                eprintln!("WebSocket read error: {}", e);
                                is_conn_rx.store(false, Ordering::SeqCst);
                                break;
                            }
                            _ => {}
                        }
                    }
                    _ = stop_rx.recv() => break,
                }
            }
        });

        self.audio_tx = Some(audio_in_tx);
        self.stop_tx = Some(stop_tx);
        Ok(())
    }

    pub async fn send_audio_chunk(&self, pcm_bytes: Vec<u8>) -> Result<(), String> {
        if let Some(tx) = &self.audio_tx {
            tx.send(pcm_bytes)
                .await
                .map_err(|e| format!("Failed to queue audio chunk: {}", e))
        } else {
            Err("Client not connected".to_string())
        }
    }

    pub fn disconnect(&mut self) {
        self.is_connected.store(false, Ordering::SeqCst);
        if let Some(stop) = self.stop_tx.take() {
            let _ = stop.send(());
        }
        self.audio_tx = None;
    }
}

impl Default for GeminiLiveClient {
    fn default() -> Self {
        Self::new()
    }
}
