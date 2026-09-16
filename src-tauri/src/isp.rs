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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SltPackageUsageDetail {
    pub name: String,
    pub limit: String,
    pub used: String,
    pub remaining: String,
    pub volume_unit: String,
    pub percentage: f64,
    pub expiry_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SltPrimaryPackageData {
    pub package_name: String,
    pub status: Option<String>,
    pub reported_time: Option<String>,
    pub usage_details: Vec<SltPackageUsageDetail>,
    pub total_limit: String,
    pub total_used: String,
    pub total_remaining: String,
    pub volume_unit: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SltVasBundleData {
    pub name: String,
    pub used: String,
    pub limit: Option<String>,
    pub remaining: Option<String>,
    pub volume_unit: String,
    pub percentage: f64,
    pub expiry_date: Option<String>,
    pub subscription_id: Option<String>,
    pub is_entertainment: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SltUsageResponse {
    pub primary_package: Option<SltPrimaryPackageData>,
    pub vas_bundles: Vec<SltVasBundleData>,
    pub reported_time: Option<String>,
    pub status: Option<String>,
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

fn json_val_to_raw_string(v: Option<&serde_json::Value>) -> String {
    match v {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Number(n)) => {
            if let Some(f) = n.as_f64() {
                format!("{:.1}", f)
            } else {
                n.to_string()
            }
        }
        _ => "0.0".to_string(),
    }
}

fn json_val_to_optional_string(v: Option<&serde_json::Value>) -> Option<String> {
    match v {
        Some(serde_json::Value::String(s)) => {
            let tr = s.trim();
            if tr.is_empty() || tr.eq_ignore_ascii_case("null") {
                None
            } else {
                Some(tr.to_string())
            }
        }
        Some(serde_json::Value::Number(n)) => {
            if let Some(f) = n.as_f64() {
                Some(format!("{:.1}", f))
            } else {
                Some(n.to_string())
            }
        }
        _ => None,
    }
}

fn parse_percentage(v: Option<&serde_json::Value>, used_str: &str, limit_str: &str) -> f64 {
    if let Some(p) = v.and_then(|val| val.as_f64()) {
        if p > 0.0 {
            return (p * 10.0).round() / 10.0;
        }
    } else if let Some(p_str) = v.and_then(|val| val.as_str()) {
        if let Ok(p) = p_str.replace('%', "").trim().parse::<f64>() {
            if p > 0.0 {
                return (p * 10.0).round() / 10.0;
            }
        }
    }

    let u: f64 = used_str.parse().unwrap_or(0.0);
    let l: f64 = limit_str.parse().unwrap_or(0.0);
    if l > 0.0 {
        ((u / l) * 100.0 * 10.0).round() / 10.0
    } else {
        0.0
    }
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
                    let unit = item.get("volume_unit").and_then(|u| u.as_str()).unwrap_or("GB");
                    if let Some(s) = rem.as_str() {
                        if !s.is_empty() {
                            remaining_str = if s.to_uppercase().contains("GB") || s.to_uppercase().contains("MB") {
                                s.to_string()
                            } else {
                                format!("{} {}", s, unit)
                            };
                            break;
                        }
                    } else if let Some(n) = rem.as_f64() {
                        remaining_str = format!("{:.1} {}", n, unit);
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
            remaining_str = format!("{:.1} GB", rem);
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
                        *result = format!("{:.1} GB", n);
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

/// Helper to parse string or number JSON value to String with unit
fn json_val_to_display_string(v: Option<&serde_json::Value>, unit: &str) -> String {
    match v {
        Some(serde_json::Value::String(s)) => {
            let tr = s.trim();
            if tr.is_empty() || tr.eq_ignore_ascii_case("null") {
                "—".to_string()
            } else if tr.to_uppercase().contains("GB") || tr.to_uppercase().contains("MB") {
                tr.to_string()
            } else {
                format!("{} {}", tr, unit)
            }
        }
        Some(serde_json::Value::Number(n)) => {
            if let Some(f) = n.as_f64() {
                format!("{:.1} {}", f, unit)
            } else {
                format!("{} {}", n, unit)
            }
        }
        _ => "—".to_string(),
    }
}

/// Parses an SLT VAS bundle JSON object into SltVasBundleData
fn parse_slt_vas_bundle_object(obj: &serde_json::Map<String, serde_json::Value>) -> Option<SltVasBundleData> {
    let name = obj
        .get("name")
        .or_else(|| obj.get("package_name"))
        .or_else(|| obj.get("bundle_name"))
        .or_else(|| obj.get("service_name"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    if name.is_empty() {
        return None;
    }

    let used = json_val_to_raw_string(
        obj.get("used")
            .or_else(|| obj.get("used_data"))
            .or_else(|| obj.get("consumed")),
    );

    let limit = json_val_to_optional_string(
        obj.get("limit")
            .or_else(|| obj.get("volume"))
            .or_else(|| obj.get("total_data"))
            .or_else(|| obj.get("total")),
    );

    let remaining = json_val_to_optional_string(
        obj.get("remaining")
            .or_else(|| obj.get("remaining_data"))
            .or_else(|| obj.get("balance")),
    );

    let volume_unit = obj
        .get("volume_unit")
        .or_else(|| obj.get("unit"))
        .and_then(|v| v.as_str())
        .unwrap_or("GB")
        .to_string();

    let percentage = parse_percentage(
        obj.get("percentage"),
        &used,
        limit.as_deref().unwrap_or("0.0"),
    );

    let expiry_date = obj
        .get("expiry_date")
        .or_else(|| obj.get("valid_till"))
        .or_else(|| obj.get("expireDate"))
        .or_else(|| obj.get("validTill"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let subscription_id = obj
        .get("subscriptionid")
        .or_else(|| obj.get("subscription_id"))
        .or_else(|| obj.get("package_id"))
        .or_else(|| obj.get("packageId"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let is_entertainment = is_entertainment_bundle(&name, subscription_id.as_deref());

    Some(SltVasBundleData {
        name,
        used,
        limit,
        remaining,
        volume_unit,
        percentage,
        expiry_date,
        subscription_id,
        is_entertainment,
    })
}

/// Parses an SLT VAS bundle JSON object into SltVasBundleItem (legacy format)
fn parse_vas_bundle_object(obj: &serde_json::Map<String, serde_json::Value>) -> Option<SltVasBundleItem> {
    let name = obj
        .get("name")
        .or_else(|| obj.get("package_name"))
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
        .or_else(|| obj.get("subscriptionid"))
        .or_else(|| obj.get("subscription_id"))
        .or_else(|| obj.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let volume_unit = obj
        .get("volume_unit")
        .and_then(|v| v.as_str())
        .unwrap_or("GB");

    let total_data = json_val_to_display_string(
        obj.get("volume")
            .or_else(|| obj.get("total_data"))
            .or_else(|| obj.get("total"))
            .or_else(|| obj.get("allocated"))
            .or_else(|| obj.get("limit")),
        volume_unit,
    );

    let used_data = json_val_to_display_string(
        obj.get("used")
            .or_else(|| obj.get("used_data"))
            .or_else(|| obj.get("consumed")),
        volume_unit,
    );

    let remaining_data = json_val_to_display_string(
        obj.get("remaining")
            .or_else(|| obj.get("remaining_data"))
            .or_else(|| obj.get("balance")),
        volume_unit,
    );

    let percentage = if let Some(p) = obj.get("percentage").and_then(|v| v.as_f64()) {
        p
    } else if let Some(p_str) = obj.get("percentage").and_then(|v| v.as_str()) {
        p_str.replace('%', "").trim().parse::<f64>().unwrap_or(0.0)
    } else {
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
        total_data: if total_data == "—" { "Unlimited".to_string() } else { total_data },
        used_data: if used_data == "—" { "0.0 GB".to_string() } else { used_data },
        remaining_data: if remaining_data == "—" { "Unlimited".to_string() } else { remaining_data },
        percentage: (percentage * 10.0).round() / 10.0,
        is_entertainment: is_ent,
        valid_till,
    })
}

/// Queries SLT Usage API for Baseline Quota Verification
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

    if let Some(is_success) = json_val.get("isSuccess").and_then(|v| v.as_bool()) {
        if !is_success {
            let msg = json_val
                .get("errorMessege")
                .or_else(|| json_val.get("message"))
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

/// Queries SLT Dashboard VAS Bundles API
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

    // 1. Search in dataBundle.usageDetails
    if let Some(details) = json_val.pointer("/dataBundle/usageDetails").and_then(|d| d.as_array()) {
        for item in details {
            if let Some(map) = item.as_object() {
                if let Some(parsed) = parse_vas_bundle_object(map) {
                    bundles.push(parsed);
                }
            }
        }
    }

    // 2. Search in dataBundle.vas_bundle / vas_bundles / addOns
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
                        if !bundles.iter().any(|b| b.name == parsed.name) {
                            bundles.push(parsed);
                        }
                    }
                }
            }
        }
    }

    // 3. Search in dataBundle.my_package_info.usageDetails
    if let Some(details) = json_val.pointer("/dataBundle/my_package_info/usageDetails").and_then(|d| d.as_array()) {
        for item in details {
            if let Some(map) = item.as_object() {
                if let Some(parsed) = parse_vas_bundle_object(map) {
                    if !bundles.iter().any(|b| b.name == parsed.name) {
                        bundles.push(parsed);
                    }
                }
            }
        }
    }

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
            if (map.contains_key("package_name") || map.contains_key("bundle_name") || map.contains_key("name"))
                && (map.contains_key("volume") || map.contains_key("remaining") || map.contains_key("used") || map.contains_key("limit"))
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

/// Comprehensive SLT Usage Query combining UsageSummary (API 1) and GetDashboardVASBundles (API 2)
pub async fn query_slt_full_usage(raw_creds: SltCredentials) -> Result<SltUsageResponse, String> {
    let creds = sanitize_slt_credentials(raw_creds);

    if creds.subscriber_id.is_empty() || creds.token.is_empty() {
        return Err("SLT Subscriber ID and Bearer Token are required".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let auth_val = format!("Bearer {}", creds.token);
    let mut base_headers = HeaderMap::new();
    if let Ok(val) = HeaderValue::from_str(&auth_val) {
        base_headers.insert(AUTHORIZATION, val);
    }
    if let Ok(val) = HeaderValue::from_str(&creds.client_id) {
        base_headers.insert("x-ibm-client-id", val);
    }
    base_headers.insert(ACCEPT, HeaderValue::from_static("application/json, text/plain, */*"));
    base_headers.insert(ORIGIN, HeaderValue::from_static("https://myslt.slt.lk"));
    base_headers.insert(REFERER, HeaderValue::from_static("https://myslt.slt.lk/"));
    base_headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    );

    let summary_url = format!(
        "https://omniscapp.slt.lk/slt/ext/api/BBVAS/UsageSummary?subscriberID={}",
        creds.subscriber_id
    );
    let vas_url = format!(
        "https://omniscapp.slt.lk/slt/ext/api/BBVAS/GetDashboardVASBundles?subscriberID={}",
        creds.subscriber_id
    );

    let summary_req = client.get(&summary_url).headers(base_headers.clone()).send();
    let vas_req = client.get(&vas_url).headers(base_headers).send();

    let (summary_res, vas_res) = tokio::join!(summary_req, vas_req);

    let mut primary_pkg_data: Option<SltPrimaryPackageData> = None;
    let mut vas_bundle_list: Vec<SltVasBundleData> = Vec::new();
    let mut reported_time: Option<String> = None;
    let mut overall_status: Option<String> = None;

    // 1. Process API 1: UsageSummary
    if let Ok(res) = summary_res {
        if res.status().is_success() {
            if let Ok(body_text) = res.text().await {
                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&body_text) {
                    if let Some(db) = json_val.get("dataBundle") {
                        if let Some(st) = db.get("status").and_then(|s| s.as_str()) {
                            overall_status = Some(st.to_string());
                        }
                        if let Some(rt) = db.get("reported_time").and_then(|s| s.as_str()) {
                            reported_time = Some(rt.to_string());
                        }

                        let mut pkg_name = "Primary Package".to_string();
                        let mut details_list: Vec<SltPackageUsageDetail> = Vec::new();

                        if let Some(pkg_info) = db.get("my_package_info") {
                            if let Some(pname) = pkg_info.get("package_name").and_then(|p| p.as_str()) {
                                pkg_name = pname.to_string();
                            }
                            if let Some(details) = pkg_info.get("usageDetails").and_then(|d| d.as_array()) {
                                for item in details {
                                    if let Some(map) = item.as_object() {
                                        let name = map.get("name").and_then(|v| v.as_str()).unwrap_or("Usage").to_string();
                                        let limit = json_val_to_raw_string(map.get("limit"));
                                        let used = json_val_to_raw_string(map.get("used"));
                                        let remaining = json_val_to_raw_string(map.get("remaining"));
                                        let volume_unit = map.get("volume_unit").and_then(|v| v.as_str()).unwrap_or("GB").to_string();
                                        let percentage = parse_percentage(map.get("percentage"), &used, &limit);
                                        let expiry_date = map.get("expiry_date").and_then(|v| v.as_str()).map(|s| s.to_string());

                                        details_list.push(SltPackageUsageDetail {
                                            name,
                                            limit,
                                            used,
                                            remaining,
                                            volume_unit,
                                            percentage,
                                            expiry_date,
                                        });
                                    }
                                }
                            }
                        }

                        let mut total_limit = "0.0".to_string();
                        let mut total_used = "0.0".to_string();
                        let mut total_remaining = "0.0".to_string();
                        let mut volume_unit = "GB".to_string();

                        if let Some(summary) = db.get("my_package_summary") {
                            total_limit = json_val_to_raw_string(summary.get("limit"));
                            total_used = json_val_to_raw_string(summary.get("used"));
                            volume_unit = summary.get("volume_unit").and_then(|v| v.as_str()).unwrap_or("GB").to_string();
                            let l_f = total_limit.parse::<f64>().unwrap_or(0.0);
                            let u_f = total_used.parse::<f64>().unwrap_or(0.0);
                            let r_f = (l_f - u_f).max(0.0);
                            total_remaining = format!("{:.1}", r_f);
                        } else if let Some(first) = details_list.first() {
                            total_limit = first.limit.clone();
                            total_used = first.used.clone();
                            total_remaining = first.remaining.clone();
                            volume_unit = first.volume_unit.clone();
                        }

                        primary_pkg_data = Some(SltPrimaryPackageData {
                            package_name: pkg_name,
                            status: overall_status.clone(),
                            reported_time: reported_time.clone(),
                            usage_details: details_list,
                            total_limit,
                            total_used,
                            total_remaining,
                            volume_unit,
                        });
                    }
                }
            }
        }
    }

    // 2. Process API 2: GetDashboardVASBundles
    if let Ok(res) = vas_res {
        if res.status().is_success() {
            if let Ok(body_text) = res.text().await {
                if let Ok(json_val) = serde_json::from_str::<serde_json::Value>(&body_text) {
                    if reported_time.is_none() {
                        if let Some(rt) = json_val.pointer("/dataBundle/reported_time").and_then(|s| s.as_str()) {
                            reported_time = Some(rt.to_string());
                        }
                    }

                    // Look directly in dataBundle.usageDetails
                    if let Some(details) = json_val.pointer("/dataBundle/usageDetails").and_then(|d| d.as_array()) {
                        for item in details {
                            if let Some(map) = item.as_object() {
                                if let Some(parsed) = parse_slt_vas_bundle_object(map) {
                                    vas_bundle_list.push(parsed);
                                }
                            }
                        }
                    }

                    // Also check additional locations
                    let other_locations = [
                        "/dataBundle/vas_bundle",
                        "/dataBundle/vas_bundles",
                        "/dataBundle/addOns",
                        "/dataBundle/vasBundles",
                    ];
                    for loc in other_locations {
                        if let Some(arr) = json_val.pointer(loc).and_then(|d| d.as_array()) {
                            for item in arr {
                                if let Some(map) = item.as_object() {
                                    if let Some(parsed) = parse_slt_vas_bundle_object(map) {
                                        if !vas_bundle_list.iter().any(|b| b.name == parsed.name) {
                                            vas_bundle_list.push(parsed);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if primary_pkg_data.is_none() && vas_bundle_list.is_empty() {
        return Err("Could not load SLT usage data. Please verify your Subscriber ID and Token.".to_string());
    }

    Ok(SltUsageResponse {
        primary_package: primary_pkg_data,
        vas_bundles: vas_bundle_list,
        reported_time,
        status: overall_status,
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
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"),
    );

    let cookie_str = format!("JSESSIONID={}; uuid={}", creds.cookie, creds.uuid);
    if let Ok(val) = HeaderValue::from_str(&cookie_str) {
        headers.insert(COOKIE, val);
    }

    let payload = serde_json::json!({
        "msisdn": creds.msisdn.trim(),
        "connType": "BB",
    });

    let response = client
        .post(url)
        .headers(headers)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Dialog API: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "Dialog API returned HTTP status {} — please verify session cookie",
            status
        ));
    }

    let body_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read Dialog response: {}", e))?;

    let json_val: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("Failed to parse Dialog response JSON: {}", e))?;

    let mut remaining_str = String::new();
    let mut package_name = None;

    if let Some(user_info) = json_val.pointer("/response/userData") {
        if let Some(pkg) = user_info.get("packageName").and_then(|p| p.as_str()) {
            package_name = Some(pkg.to_string());
        }
    }

    if let Some(usage_types) = json_val.pointer("/response/usageTypes").and_then(|u| u.as_array()) {
        let idx = creds.selected_usage_type_index.unwrap_or(0);
        if let Some(target_type) = usage_types.get(idx).or_else(|| usage_types.first()) {
            if let Some(name) = target_type.get("name").and_then(|n| n.as_str()) {
                if package_name.is_none() {
                    package_name = Some(name.to_string());
                }
            }
            if let Some(rem) = target_type.get("remaining") {
                if let Some(s) = rem.as_str() {
                    remaining_str = s.to_string();
                } else if let Some(n) = rem.as_f64() {
                    let unit = target_type.get("unit").and_then(|u| u.as_str()).unwrap_or("GB");
                    remaining_str = format!("{:.1} {}", n, unit);
                }
            }
        }
    }

    if remaining_str.is_empty() {
        find_remaining_recursive(&json_val, &mut remaining_str);
    }

    if remaining_str.is_empty() {
        return Err("Could not find remaining allowance in Dialog response".to_string());
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
