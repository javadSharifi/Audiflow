use std::time::Duration;
use reqwest::Client;

const DEFAULT_TIMEOUT: Duration = Duration::from_secs(12);
const DEFAULT_USER_AGENT: &str =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

/// Builds a reqwest Client configured with browser User-Agent, timeouts,
/// and automatic OS proxy/VPN inheritance.
pub fn create_http_client() -> Result<Client, String> {
    Client::builder()
        .user_agent(DEFAULT_USER_AGENT)
        .timeout(DEFAULT_TIMEOUT)
        .connect_timeout(Duration::from_secs(6))
        .pool_max_idle_per_host(8)
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))
}
