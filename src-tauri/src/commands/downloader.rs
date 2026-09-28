use tauri::State;

use crate::downloader::{
    DownloadItem, DownloadQueueManager, DownloadRequest, DownloaderService, MusicSearchResult,
    MusicSource, StreamProxy, YtDlpInfo, YtDlpManager,
};
use crate::error::AppError;

#[tauri::command]
#[specta::specta]
pub async fn search_internet_music(
    query: String,
    source: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<MusicSearchResult>, AppError> {
    #[cfg(target_os = "android")]
    {
        let _ = (query, source, limit);
        return Err(AppError::Unsupported(
            "Internet Music Search is currently supported on desktop only.".into(),
        ));
    }

    #[cfg(not(target_os = "android"))]
    {
        tokio::task::spawn_blocking(move || {
            let max_results = limit.unwrap_or(15) as usize;
            DownloaderService::search(&query, source.as_deref(), max_results)
        })
        .await
        .map_err(|e| AppError::Other(format!("Search task failed: {e}")))?
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_internet_preview_url(url: String) -> Result<String, AppError> {
    #[cfg(target_os = "android")]
    {
        let _ = url;
        return Err(AppError::Unsupported(
            "Internet Music Preview is currently supported on desktop only.".into(),
        ));
    }

    #[cfg(not(target_os = "android"))]
    {
        let webpage_url = url.clone();
        let direct_url = tokio::task::spawn_blocking(move || {
            DownloaderService::get_direct_stream_url(&url)
        })
        .await
        .map_err(|e| AppError::Other(format!("Stream extraction task failed: {e}")))??;

        StreamProxy::register_preview(direct_url, webpage_url)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn start_internet_download(
    manager: State<'_, DownloadQueueManager>,
    request: DownloadRequest,
) -> Result<String, AppError> {
    #[cfg(target_os = "android")]
    {
        let _ = (manager, request);
        return Err(AppError::Unsupported(
            "Internet Music Download is currently supported on desktop only.".into(),
        ));
    }

    #[cfg(not(target_os = "android"))]
    {
        manager.enqueue(request)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn cancel_internet_download(
    manager: State<'_, DownloadQueueManager>,
    id: String,
) -> Result<(), AppError> {
    #[cfg(target_os = "android")]
    {
        let _ = (manager, id);
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        manager.cancel(&id)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn retry_internet_download(
    manager: State<'_, DownloadQueueManager>,
    id: String,
) -> Result<(), AppError> {
    #[cfg(target_os = "android")]
    {
        let _ = (manager, id);
        return Err(AppError::Unsupported(
            "Internet Music Download is currently supported on desktop only.".into(),
        ));
    }

    #[cfg(not(target_os = "android"))]
    {
        manager.retry(&id)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_internet_downloads(
    manager: State<'_, DownloadQueueManager>,
) -> Result<Vec<DownloadItem>, AppError> {
    #[cfg(target_os = "android")]
    {
        let _ = manager;
        return Ok(Vec::new());
    }

    #[cfg(not(target_os = "android"))]
    {
        Ok(manager.get_downloads())
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_ytdlp_info() -> Result<YtDlpInfo, AppError> {
    #[cfg(target_os = "android")]
    {
        return Err(AppError::Unsupported(
            "yt-dlp is currently supported on desktop only.".into(),
        ));
    }

    #[cfg(not(target_os = "android"))]
    {
        tokio::task::spawn_blocking(YtDlpManager::get_info)
            .await
            .map_err(|e| AppError::Other(format!("Failed to retrieve yt-dlp info: {e}")))?
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_internet_music_sources() -> Result<Vec<MusicSource>, AppError> {
    #[cfg(target_os = "android")]
    {
        return Ok(Vec::new());
    }

    #[cfg(not(target_os = "android"))]
    {
        Ok(DownloaderService::get_sources())
    }
}
