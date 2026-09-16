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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SltVasBundleItem {
    pub name: String,
    pub package_id: Option<String>,
    pub total_data: String,
    pub used_data: String,
    pub remaining_data: String,
    pub percentage: f64,
    pub is_entertainment: bool,
    pub valid_till: Option<String>,
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
pub fn sanitize_slt_credentials(mut creds: SltCredentials) -> SltCredentials {
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

/// Helper to check if a package is an Entertainment / Streaming bundle
fn is_entertainment_bundle(name: &str, pkg_id: Option<&str>) -> bool {
    let lower_name = name.to_lowercase();
    let lower_id = pkg_id.unwrap_or("").to_lowercase();

    let keywords = [
        "entertainment",
        "netflix",
        "youtube",
        "gaming",
        "combo",
        "video",
        "stream",
        "social",
        "chat",
        "meet",
        "study",
        "work",
        "vas",
        "unlimited",
        "tiktok",
        "facebook",
        "instagram",
        "spotify",
    ];

    keywords.iter().any(|&k| lower_name.contains(k) || lower_id.contains(k))
}

/// Helper to parse string or number JSON value to String
fn json_val_to_string(v: Option<&serde_json::Value>) -> String {
    match v {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Number(n)) => {
            if let Some(f) = n.as_f64() {
                format!("{:.2} GB", f)
            } else {
                n.to_string()
            }
        }
        _ => "".to_string(),
    }
}

/// Parses an SLT VAS bundle JSON object into SltVasBundleItem
fn parse_vas_bundle_object(obj: &serde_json::Map<String, serde_json::Value>) -> Option<SltVasBundleItem> {
    let name = obj
        .get("package_name")
        .or_else(|| obj.get("name"))
        .or_else(|| obj.get("bundle_name"))
        .or_else(|| obj.get("service_name"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if name.is_empty() {
        return None;
    }

    let package_id = obj
        .get("package_id")
        .or_else(|| obj.get("packageId"))
        .or_else(|| obj.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let total_data = json_val_to_string(
        obj.get("volume")
            .or_else(|| obj.get("total_data"))
            .or_else(|| obj.get("total"))
            .or_else(|| obj.get("allocated")),
    );

    let used_data = json_val_to_string(
        obj.get("used")
            .or_else(|| obj.get("used_data"))
            .or_else(|| obj.get("consumed")),
    );

    let remaining_data = json_val_to_string(
        obj.get("remaining")
            .or_else(|| obj.get("remaining_data"))
            .or_else(|| obj.get("balance")),
    );

    let percentage = if let Some(p) = obj.get("percentage").and_then(|v| v.as_f64()) {
        p
    } else if let Some(p_str) = obj.get("percentage").and_then(|v| v.as_str()) {
        p_str.replace('%', "").trim().parse::<f64>().unwrap_or(0.0)
    } else {
        // Calculate from used and total if available
        let used_b = parse_usage_string_to_bytes(&used_data).unwrap_or(0);
        let total_b = parse_usage_string_to_bytes(&total_data).unwrap_or(0);
        if total_b > 0 {
            ((used_b as f64) / (total_b as f64)) * 100.0
        } else {
            0.0
        }
    };

    let valid_till = obj
        .get("valid_till")
        .or_else(|| obj.get("expiry_date"))
        .or_else(|| obj.get("expireDate"))
        .or_else(|| obj.get("validTill"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let is_ent = is_entertainment_bundle(&name, package_id.as_deref());

    Some(SltVasBundleItem {
        name,
        package_id,
        total_data: if total_data.is_empty() { "—".to_string() } else { total_data },
        used_data: if used_data.is_empty() { "0 GB".to_string() } else { used_data },
        remaining_data: if remaining_data.is_empty() { "—".to_string() } else { remaining_data },
        percentage: (percentage * 10.0).round() / 10.0,
        is_entertainment: is_ent,
        valid_till,
    })
}

/// Queries SLT Dashboard VAS Bundles API:
/// GET https://omniscapp.slt.lk/slt/ext/api/BBVAS/GetDashboardVASBundles?subscriberID=<subscriberID>
pub async fn query_slt_vas_bundles(raw_creds: SltCredentials) -> Result<Vec<SltVasBundleItem>, String> {
    let creds = sanitize_slt_credentials(raw_creds);

    if creds.subscriber_id.is_empty() || creds.token.is_empty() {
        return Err("SLT Subscriber ID and Bearer Token are required".to_string());
    }

    let url = format!(
        "https://omniscapp.slt.lk/slt/ext/api/BBVAS/GetDashboardVASBundles?subscriberID={}",
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
        .map_err(|e| format!("Failed to connect to SLT VAS API: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "SLT VAS API returned HTTP status {} — please verify or refresh your credentials",
            status
        ));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read SLT VAS response: {}", e))?;

    let json_val: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("Failed to parse SLT VAS JSON: {}", e))?;

    let mut bundles: Vec<SltVasBundleItem> = Vec::new();

    // 1. Search in dataBundle.vas_bundle / vas_bundles
    let bundle_arrays = [
        json_val.pointer("/dataBundle/vas_bundle"),
        json_val.pointer("/dataBundle/vas_bundles"),
        json_val.pointer("/dataBundle/addOns"),
        json_val.pointer("/dataBundle/vasBundles"),
        json_val.pointer("/vas_bundle"),
        json_val.pointer("/data/vas_bundle"),
    ];

    for arr_opt in bundle_arrays {
        if let Some(arr) = arr_opt.and_then(|v| v.as_array()) {
            for item in arr {
                if let Some(map) = item.as_object() {
                    if let Some(parsed) = parse_vas_bundle_object(map) {
                        bundles.push(parsed);
                    }
                }
            }
        }
    }

    // 2. Also search in dataBundle.my_package_info.usageDetails for package details
    if let Some(details) = json_val.pointer("/dataBundle/my_package_info/usageDetails").and_then(|d| d.as_array()) {
        for item in details {
            if let Some(map) = item.as_object() {
                if let Some(parsed) = parse_vas_bundle_object(map) {
                    // Check if already present
                    if !bundles.iter().any(|b| b.name == parsed.name) {
                        bundles.push(parsed);
                    }
                }
            }
        }
    }

    // 3. Fallback generic recursive search for any object with 'package_name' or 'bundle_name'
    if bundles.is_empty() {
        collect_bundles_recursive(&json_val, &mut bundles);
    }

    if bundles.is_empty() {
        return Err("No active VAS add-on packages found in SLT account".to_string());
    }

    Ok(bundles)
}

fn collect_bundles_recursive(val: &serde_json::Value, list: &mut Vec<SltVasBundleItem>) {
    match val {
        serde_json::Value::Object(map) => {
            if (map.contains_key("package_name") || map.contains_key("bundle_name"))
                && (map.contains_key("volume") || map.contains_key("remaining") || map.contains_key("used"))
            {
                if let Some(item) = parse_vas_bundle_object(map) {
                    if !list.iter().any(|b| b.name == item.name) {
                        list.push(item);
                    }
                }
            }
            for v in map.values() {
                collect_bundles_recursive(v, list);
            }
        }
        serde_json::Value::Array(arr) => {
            for v in arr {
                collect_bundles_recursive(v, list);
            }
        }
        _ => {}
    }
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
