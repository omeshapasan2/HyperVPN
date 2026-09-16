use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, CONTENT_TYPE, COOKIE, ORIGIN, REFERER, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SltCredentials {
    pub subscriber_id: String,
    pub token: String,
    pub client_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogCredentials {
    pub msisdn: String,
    pub uuid: String,
    pub cookie: String,
    pub selected_usage_type_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IspVerificationResponse {
    pub provider: String,
    pub timestamp: i64,
    pub remaining_text: String,
    pub remaining_bytes: Option<u64>,
    pub package_name: Option<String>,
    pub error: Option<String>,
}

/// Parses strings like "13.69 GB", "500 MB", "1.2 TB" into approximate bytes
pub fn parse_usage_string_to_bytes(text: &str) -> Option<u64> {
    let clean = text.trim();
    let parts: Vec<&str> = clean.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }

    let num: f64 = parts[0].replace(',', "").parse().ok()?;
    let unit = if parts.len() > 1 {
        parts[1].to_uppercase()
    } else {
        "GB".to_string()
    };

    let multiplier: f64 = match unit.as_str() {
        "B" | "BYTES" => 1.0,
        "KB" | "KIB" => 1024.0,
        "MB" | "MIB" => 1024.0 * 1024.0,
        "GB" | "GIB" => 1024.0 * 1024.0 * 1024.0,
        "TB" | "TIB" => 1024.0 * 1024.0 * 1024.0 * 1024.0,
        _ => 1024.0 * 1024.0 * 1024.0, // Default to GB
    };

    Some((num * multiplier) as u64)
}

/// Sanitizes SLT credentials, extracting clean token and client ID if the user pasted raw headers
fn sanitize_slt_credentials(mut creds: SltCredentials) -> SltCredentials {
    let raw_token = creds.token.trim().to_string();

    // Check if user pasted multi-line headers into the token field
    if raw_token.contains('\n') || raw_token.contains("x-ibm-client-id") || raw_token.to_lowercase().contains("authorization:") {
        for line in raw_token.lines() {
            let line_trim = line.trim();
            if line_trim.to_lowercase().starts_with("authorization:") {
                let val = line_trim[14..].trim();
                creds.token = val.to_string();
            } else if line_trim.to_lowercase().starts_with("x-ibm-client-id:") {
                let val = line_trim[16..].trim();
                if creds.client_id.trim().is_empty() {
                    creds.client_id = val.to_string();
                }
            } else if !line_trim.contains(':') && !line_trim.is_empty() && !line_trim.starts_with("http") {
                if !line_trim.starts_with("Origin") && !line_trim.starts_with("Referer") {
                    creds.token = line_trim.to_string();
                }
            }
        }
    }

    // Strip leading "Bearer " if present
    let mut token_str = creds.token.trim().to_string();
    if token_str.to_lowercase().starts_with("bearer ") {
        token_str = token_str[7..].trim().to_string();
    }
    creds.token = token_str;

    // Default to SLT's standard MySLT web portal client-id if empty
    if creds.client_id.trim().is_empty() || creds.client_id.trim().eq_ignore_ascii_case("selfcare") {
        creds.client_id = "b7402e9d66808f762ccedbe42c20668e".to_string();
    } else {
        let mut cid = creds.client_id.trim();
        if cid.to_lowercase().starts_with("x-ibm-client-id:") {
            cid = cid[16..].trim();
        }
        creds.client_id = cid.to_string();
    }

    creds.subscriber_id = creds.subscriber_id.trim().to_string();
    creds
}

fn extract_slt_remaining(json_val: &serde_json::Value) -> (String, Option<String>) {
    let mut remaining_str = String::new();
    let mut package_name = None;

    if let Some(pkg_info) = json_val.pointer("/dataBundle/my_package_info") {
        if let Some(pkg) = pkg_info.get("package_name").and_then(|p| p.as_str()) {
            package_name = Some(pkg.to_string());
        }

        if let Some(details) = pkg_info.get("usageDetails").and_then(|d| d.as_array()) {
            for item in details {
                if let Some(rem) = item.get("remaining") {
                    if let Some(s) = rem.as_str() {
                        if !s.is_empty() {
                            remaining_str = s.to_string();
                            break;
                        }
                    } else if let Some(n) = rem.as_f64() {
                        remaining_str = format!("{:.2} GB", n);
                        break;
                    }
                }
            }
        }
    }

    if remaining_str.is_empty() {
        if let Some(rem) = json_val.pointer("/dataBundle/remaining").and_then(|r| r.as_str()) {
            remaining_str = rem.to_string();
        } else if let Some(rem) = json_val.pointer("/dataBundle/remaining").and_then(|r| r.as_f64()) {
            remaining_str = format!("{:.2} GB", rem);
        }
    }

    // Generic recursive search if nested under different keys
    if remaining_str.is_empty() {
        find_remaining_recursive(json_val, &mut remaining_str);
    }

    (remaining_str, package_name)
}

fn find_remaining_recursive(val: &serde_json::Value, result: &mut String) {
    if !result.is_empty() {
        return;
    }
    match val {
        serde_json::Value::Object(map) => {
            for (k, v) in map {
                let lower = k.to_lowercase();
                if lower == "remaining" || lower == "remaining_amount" || lower == "remaining_data" || lower == "remainingdata" {
                    if let Some(s) = v.as_str() {
                        if !s.is_empty() {
                            *result = s.to_string();
                            return;
                        }
                    } else if let Some(n) = v.as_f64() {
                        *result = format!("{:.2} GB", n);
                        return;
                    }
                }
                find_remaining_recursive(v, result);
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                find_remaining_recursive(v, result);
            }
        }
        _ => {}
    }
}

/// Queries SLT Usage API
pub async fn query_slt_usage(raw_creds: SltCredentials) -> Result<IspVerificationResponse, String> {
    let creds = sanitize_slt_credentials(raw_creds);

    if creds.subscriber_id.is_empty() || creds.token.is_empty() {
        return Err("SLT Subscriber ID and Bearer Token are required".to_string());
    }

    let url = format!(
        "https://omniscapp.slt.lk/slt/ext/api/BBVAS/UsageSummary?subscriberID={}",
        creds.subscriber_id
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut headers = HeaderMap::new();
    let auth_val = format!("Bearer {}", creds.token);
    if let Ok(val) = HeaderValue::from_str(&auth_val) {
        headers.insert(AUTHORIZATION, val);
    }
    if let Ok(val) = HeaderValue::from_str(&creds.client_id) {
        headers.insert("x-ibm-client-id", val);
    }
    headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/plain, */*"));
    headers.insert(ORIGIN, HeaderValue::from_static("https://myslt.slt.lk"));
    headers.insert(REFERER, HeaderValue::from_static("https://myslt.slt.lk/"));
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    );

    let response = client
        .get(&url)
        .headers(headers)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to SLT API: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "SLT API returned HTTP status {} — please verify or refresh your credentials",
            status
        ));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read SLT response: {}", e))?;

    let json_val: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("Failed to parse SLT response JSON: {}", e))?;

    // Check if SLT returned an error payload
    if let Some(is_success) = json_val.get("isSuccess").and_then(|v| v.as_bool()) {
        if !is_success {
            let msg = json_val
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("SLT authentication failed");
            return Err(format!("SLT Error: {} — please refresh your token", msg));
        }
    }

    let (remaining_str, package_name) = extract_slt_remaining(&json_val);

    if remaining_str.is_empty() {
        return Err("Could not find remaining data allowance in SLT response".to_string());
    }

    let bytes = parse_usage_string_to_bytes(&remaining_str);

    Ok(IspVerificationResponse {
        provider: "slt".to_string(),
        timestamp: chrono::Utc::now().timestamp_millis(),
        remaining_text: remaining_str,
        remaining_bytes: bytes,
        package_name,
        error: None,
    })
}

/// Queries Dialog Selfcare Usage API
pub async fn query_dialog_usage(creds: DialogCredentials) -> Result<IspVerificationResponse, String> {
    if creds.msisdn.trim().is_empty() || creds.cookie.trim().is_empty() {
        return Err("Dialog MSISDN and Session Cookie are required".to_string());
    }

    let url = "https://dialog.lk/selfcare-proxy?r=usage/get";

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/json, text/plain, */*"),
    );
    headers.insert("lang", HeaderValue::from_static("en"));

    if let Ok(val) = HeaderValue::from_str(creds.msisdn.trim()) {
        headers.insert("msisdn", val);
    }
    if let Ok(val) = HeaderValue::from_str(creds.uuid.trim()) {
        headers.insert("uuid", val);
    }

    headers.insert(ORIGIN, HeaderValue::from_static("https://dialog.lk"));
    headers.insert(
        REFERER,
        HeaderValue::from_static("https://dialog.lk/mydialog-web/services/data-detail-tab"),
    );
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    );

    if let Ok(val) = HeaderValue::from_str(creds.cookie.trim()) {
        headers.insert(COOKIE, val);
    }

    let response = client
        .post(url)
        .headers(headers)
        .body("{}")
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Dialog API: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "Dialog API returned HTTP status {} — your session cookie may have expired. Please refresh your credentials.",
            status
        ));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Dialog response: {}", e))?;

    let json_val: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("Failed to parse Dialog response JSON: {}", e))?;

    // Check Dialog success field
    if let Some(success) = json_val.get("success").and_then(|v| v.as_bool()) {
        if !success {
            let msg = json_val
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("Dialog authentication expired");
            return Err(format!("Dialog Error: {} — please refresh your session cookie", msg));
        }
    }

    let mut remaining_str = String::new();
    let mut package_name = None;
    let selected_idx = creds.selected_usage_type_index.unwrap_or(0);

    // Extract remaining from data.usage_types[].usages[].remaining_amount
    if let Some(usage_types) = json_val.pointer("/data/usage_types").and_then(|t| t.as_array()) {
        if let Some(type_item) = usage_types.get(selected_idx).or_else(|| usage_types.first()) {
            if let Some(tname) = type_item.get("usage_type_name").and_then(|n| n.as_str()) {
                package_name = Some(tname.to_string());
            }

            if let Some(usages) = type_item.get("usages").and_then(|u| u.as_array()) {
                for u in usages {
                    if let Some(rem) = u.get("remaining_amount").and_then(|r| r.as_str()) {
                        if !rem.is_empty() {
                            remaining_str = rem.to_string();
                            break;
                        }
                    }
                }
            }
        }
    }

    if remaining_str.is_empty() {
        return Err("Could not find remaining data allowance in Dialog response. Please verify account active.".to_string());
    }

    let bytes = parse_usage_string_to_bytes(&remaining_str);

    Ok(IspVerificationResponse {
        provider: "dialog".to_string(),
        timestamp: chrono::Utc::now().timestamp_millis(),
        remaining_text: remaining_str,
        remaining_bytes: bytes,
        package_name,
        error: None,
    })
}
