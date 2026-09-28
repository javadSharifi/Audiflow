use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};

use crate::error::AppError;
use crate::ffmpeg::run::CancelToken;
use super::types::{DownloadItem, DownloadRequest, DownloadStatus};
use super::worker::{run_worker_loop, update_and_emit};

pub struct DownloadQueueManager {
    inner: Arc<QueueInner>,
}

pub(crate) struct QueueInner {
    pub(crate) app_handle: tauri::AppHandle,
    pub(crate) items: Mutex<HashMap<String, DownloadItem>>,
    pub(crate) tokens: Mutex<HashMap<String, CancelToken>>,
    pub(crate) order: Mutex<VecDeque<String>>,
    pub(crate) active_count: std::sync::atomic::AtomicUsize,
}

impl DownloadQueueManager {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self {
            inner: Arc::new(QueueInner {
                app_handle,
                items: Mutex::new(HashMap::new()),
                tokens: Mutex::new(HashMap::new()),
                order: Mutex::new(VecDeque::new()),
                active_count: std::sync::atomic::AtomicUsize::new(0),
            }),
        }
    }

    pub fn enqueue(&self, req: DownloadRequest) -> Result<String, AppError> {
        let id = req.id.clone();
        let cancel_token = CancelToken::new();

        let item = DownloadItem {
            id: id.clone(),
            webpage_url: req.webpage_url.clone(),
            title: req.title.clone(),
            artist: req.artist.clone(),
            thumbnail_url: req.thumbnail_url.clone(),
            status: DownloadStatus::Queued,
            percent: 0.0,
            downloaded_bytes: None,
            total_bytes: None,
            speed_bytes_per_sec: None,
            eta_secs: None,
            output_path: None,
            error: None,
        };

        {
            self.inner.items.lock().unwrap().insert(id.clone(), item);
            self.inner.tokens.lock().unwrap().insert(id.clone(), cancel_token);
            self.inner.order.lock().unwrap().push_back(id.clone());
        }

        update_and_emit(&self.inner, &id, DownloadStatus::Queued, 0.0, None, None, None, None, None, None);
        self.spawn_workers_if_needed();

        Ok(id)
    }

    pub fn cancel(&self, id: &str) -> Result<(), AppError> {
        let token_opt = self.inner.tokens.lock().unwrap().get(id).cloned();
        if let Some(token) = token_opt {
            token.cancel();
        }

        let mut items = self.inner.items.lock().unwrap();
        if let Some(item) = items.get_mut(id) {
            item.status = DownloadStatus::Cancelled;
            item.error = Some("Cancelled by user".into());
        }

        update_and_emit(&self.inner, id, DownloadStatus::Cancelled, 0.0, None, None, None, None, None, None);
        Ok(())
    }

    pub fn retry(&self, id: &str) -> Result<(), AppError> {
        let req = {
            let items = self.inner.items.lock().unwrap();
            let item = items
                .get(id)
                .ok_or_else(|| AppError::NotFound(format!("Download item {id} not found")))?;
            DownloadRequest {
                id: item.id.clone(),
                webpage_url: item.webpage_url.clone(),
                title: item.title.clone(),
                artist: item.artist.clone(),
                thumbnail_url: item.thumbnail_url.clone(),
                format: Some("mp3".into()),
            }
        };

        self.enqueue(req).map(|_| ())
    }

    pub fn get_downloads(&self) -> Vec<DownloadItem> {
        let items = self.inner.items.lock().unwrap();
        items.values().cloned().collect()
    }

    pub fn cancel_all(&self) {
        let tokens: Vec<CancelToken> = self.inner.tokens.lock().unwrap().values().cloned().collect();
        for token in tokens {
            token.cancel();
        }
    }

    fn spawn_workers_if_needed(&self) {
        let max_concurrent = 2;
        let current = self.inner.active_count.load(std::sync::atomic::Ordering::SeqCst);
        if current < max_concurrent {
            let inner_clone = Arc::clone(&self.inner);
            std::thread::spawn(move || {
                run_worker_loop(inner_clone);
            });
        }
    }
}
