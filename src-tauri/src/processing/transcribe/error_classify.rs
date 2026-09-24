//! Classification of Gemini HTTP failures into [`GeminiErrorKind`].
//!
//! Rules (per spec):
//! - 403 + "location"/"region"/"territory" (case-insensitive) → `RegionNotSupported`
//! - 403 + "denied access" → `AccountFlagged`
//! - 403 otherwise → `InvalidKey`
//! - 401 → `InvalidKey` ("missing key" is reserved for the keychain-empty path;
//!   our requests ALWAYS carry `x-goog-api-key`, so a 401 means Google rejected
//!   the *presented* key, not that none exists)
//! - 429 → parse `error.details[]` for `google.rpc.QuotaFailure` and extract
//!   the first violation's `quotaMetric`/`quotaValue` → `QuotaExceeded`.
//!   Unparseable bodies still yield `QuotaExceeded` with empty fields.
//! - >= 500 → `ServerError`, anything else → `Unknown`.

use crate::error::GeminiErrorKind;

/// Classify a Gemini HTTP failure from its status code and raw body.
pub fn classify_gemini_error(status: u16, body: &str) -> GeminiErrorKind {
    if status == 403 {
        let lower = body.to_lowercase();
        if lower.contains("location") || lower.contains("region") || lower.contains("territory") {
            return GeminiErrorKind::RegionNotSupported;
        }
        if lower.contains("denied access") {
            return GeminiErrorKind::AccountFlagged;
        }
        return GeminiErrorKind::InvalidKey;
    }
    if status == 401 {
        return GeminiErrorKind::InvalidKey;
    }
    if status == 429 {
        let (metric, value) = parse_quota_failure(body);
        return GeminiErrorKind::QuotaExceeded { metric, value };
    }
    if status >= 500 {
        return GeminiErrorKind::ServerError;
    }
    GeminiErrorKind::Unknown
}

/// Extract `(quotaMetric, quotaValue)` from a `google.rpc.QuotaFailure`
/// details entry. Returns empty strings when the body is not JSON or carries
/// no such entry — callers still report `QuotaExceeded` in that case.
fn parse_quota_failure(body: &str) -> (String, String) {
    let parsed: serde_json::Value = match serde_json::from_str(body) {
        Ok(v) => v,
        Err(_) => return (String::new(), String::new()),
    };
    let details = parsed.pointer("/error/details").and_then(|d| d.as_array());
    let Some(details) = details else {
        return (String::new(), String::new());
    };
    for entry in details {
        let is_quota_failure = entry
            .get("@type")
            .and_then(|t| t.as_str())
            .map(|t| t.contains("google.rpc.QuotaFailure"))
            .unwrap_or(false);
        if !is_quota_failure {
            continue;
        }
        let violations = entry.get("violations").and_then(|v| v.as_array());
        if let Some(violations) = violations {
            if let Some(first) = violations.first() {
                let metric = first
                    .get("quotaMetric")
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();
                let value = first
                    .get("quotaValue")
                    .and_then(|m| m.as_str())
                    .unwrap_or("")
                    .to_string();
                return (metric, value);
            }
        }
        return (String::new(), String::new());
    }
    (String::new(), String::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn region_keywords_map_to_region_not_supported() {
        for body in [
            "User location is not supported for this API",
            "FAILED_PRECONDITION: region not supported",
            "Request had invalid territory",
            "LOCATION restriction (uppercase check)",
        ] {
            assert_eq!(
                classify_gemini_error(403, body),
                GeminiErrorKind::RegionNotSupported,
                "body: {body}"
            );
        }
    }

    #[test]
    fn denied_access_maps_to_account_flagged() {
        assert_eq!(
            classify_gemini_error(403, "Permission denied access for consumer project"),
            GeminiErrorKind::AccountFlagged
        );
    }

    #[test]
    fn plain_403_maps_to_invalid_key() {
        assert_eq!(
            classify_gemini_error(
                403,
                r#"{"error":{"code":403,"message":"API key not valid"}}"#
            ),
            GeminiErrorKind::InvalidKey
        );
        assert_eq!(classify_gemini_error(403, ""), GeminiErrorKind::InvalidKey);
    }

    #[test]
    fn status_401_maps_to_invalid_key() {
        assert_eq!(
            classify_gemini_error(401, "Unauthorized"),
            GeminiErrorKind::InvalidKey
        );
    }

    #[test]
    fn quota_failure_json_is_parsed() {
        let body = r#"{
            "error": {
                "code": 429,
                "message": "Quota exceeded",
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [
                            {"quotaMetric": "generativelanguage.googleapis.com/interactions_free_tier_audio", "quotaValue": "10"}
                        ]
                    }
                ]
            }
        }"#;
        assert_eq!(
            classify_gemini_error(429, body),
            GeminiErrorKind::QuotaExceeded {
                metric: "generativelanguage.googleapis.com/interactions_free_tier_audio".into(),
                value: "10".into(),
            }
        );
    }

    #[test]
    fn quota_failure_without_details_still_quota_exceeded() {
        assert_eq!(
            classify_gemini_error(429, "Too Many Requests"),
            GeminiErrorKind::QuotaExceeded {
                metric: String::new(),
                value: String::new(),
            }
        );
        assert_eq!(
            classify_gemini_error(429, r#"{"error":{"code":429}}"#),
            GeminiErrorKind::QuotaExceeded {
                metric: String::new(),
                value: String::new(),
            }
        );
    }

    #[test]
    fn server_errors_and_unknown() {
        assert_eq!(
            classify_gemini_error(500, "Internal error"),
            GeminiErrorKind::ServerError
        );
        assert_eq!(
            classify_gemini_error(503, "Unavailable"),
            GeminiErrorKind::ServerError
        );
        assert_eq!(
            classify_gemini_error(400, "Bad request"),
            GeminiErrorKind::Unknown
        );
        assert_eq!(
            classify_gemini_error(404, "Not found"),
            GeminiErrorKind::Unknown
        );
    }
}
