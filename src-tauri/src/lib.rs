pub mod isp;
pub mod ping;
pub mod process;
pub mod routing;
pub mod stats;
pub mod storage;
pub mod tray;
pub mod vless;
pub mod xray_config;

use isp::{
    query_dialog_usage, query_slt_full_usage, query_slt_usage, query_slt_vas_bundles,
    DialogCredentials, IspVerificationResponse, SltCredentials, SltUsageResponse, SltVasBundleItem,
};
use ping::{measure_tcp_ping, PingResult};
use process::{ProcessLogEntry, ProcessManager};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use stats::{StatsTracker, UsageHistory};
use storage::{AppSettings, StorageManager};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use vless::VlessConfig;
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VpnStatus {
    pub connected: bool,
    pub active_config_id: Option<String>,
    pub connecting: bool,
    pub uptime_seconds: u64,
    pub session_bytes_uplink: u64,
    pub session_bytes_downlink: u64,
    pub current_upload_speed: u64,
    pub current_download_speed: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinariesStatus {
    pub xray_found: bool,
    pub xray_path: Option<String>,
    pub tun2socks_found: bool,
    pub tun2socks_path: Option<String>,
    pub wintun_found: bool,
    pub wintun_path: Option<String>,
    pub ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_notes: String,
    pub download_url: String,
    pub published_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryManifestItem {
    pub name: String,
    pub version: String,
    pub url: String,
    #[serde(default)]
    pub archive_type: Option<String>,
    #[serde(default)]
    pub file_path_in_archive: Option<String>,
    #[serde(default)]
    pub sha256: Option<String>,
    #[serde(default)]
    pub extra_files: Option<Vec<String>>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinariesManifest {
    pub version: String,
    #[serde(default)]
    pub updated_at: Option<String>,
    pub binaries: Vec<BinaryManifestItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryItemStatus {
    pub name: String,
    pub description: String,
    pub current_version: Option<String>,
    pub latest_version: String,
    pub exists: bool,
    pub path: Option<String>,
    pub has_update: bool,
    pub size_bytes: Option<u64>,
    pub sha256: Option<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinariesUpdateCheckResult {
    pub has_update: bool,
    pub manifest_version: String,
    pub binaries: Vec<BinaryItemStatus>,
    pub check_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryUpdateProgress {
    pub stage: String, // "checking" | "downloading" | "extracting" | "verifying" | "installing" | "reconnecting" | "complete" | "error"
    pub current_item: String,
    pub current_percent: u8,
    pub message: String,
    pub total_items: usize,
    pub completed_items: usize,
}

pub struct AppState {
    pub process_manager: Arc<ProcessManager>,
    pub stats_tracker: Arc<StatsTracker>,
    pub storage_manager: Arc<StorageManager>,
    pub data_dir: PathBuf,
    pub update_lock: Arc<tokio::sync::Mutex<()>>,
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn connect_vpn(config: VlessConfig, state: State<'_, AppState>) -> Result<(), String> {
    let _guard = state.update_lock.lock().await;
    let settings = state.storage_manager.get_settings();
    state.stats_tracker.reset_session();
    state
        .process_manager
        .connect(
            config,
            settings.socks_port,
            settings.stats_port,
            settings.custom_lan_exclusions,
            state.data_dir.clone(),
        )
        .await
}

#[tauri::command]
async fn disconnect_vpn(state: State<'_, AppState>) -> Result<(), String> {
    let _guard = state.update_lock.lock().await;
    state.process_manager.disconnect().await
}

#[tauri::command]
fn get_vpn_status(state: State<'_, AppState>) -> Result<VpnStatus, String> {
    let connected = state.process_manager.is_connected();
    let active_config_id = state.process_manager.get_active_config_id();
    let uptime = state.process_manager.get_uptime_seconds();
    let live = state.stats_tracker.get_live_stats();

    Ok(VpnStatus {
        connected,
        active_config_id,
        connecting: false,
        uptime_seconds: uptime,
        session_bytes_uplink: live.session_bytes_uplink,
        session_bytes_downlink: live.session_bytes_downlink,
        current_upload_speed: live.current_upload_speed,
        current_download_speed: live.current_download_speed,
        error: None,
    })
}

#[tauri::command]
fn get_saved_configs(state: State<'_, AppState>) -> Result<Vec<VlessConfig>, String> {
    Ok(state.storage_manager.get_configs())
}

#[tauri::command]
fn save_configs(configs: Vec<VlessConfig>, state: State<'_, AppState>) -> Result<(), String> {
    state.storage_manager.save_configs(configs)
}

#[tauri::command]
fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.storage_manager.get_settings())
}

#[tauri::command]
fn save_app_settings(settings: AppSettings, state: State<'_, AppState>) -> Result<(), String> {
    state.storage_manager.save_settings(settings)
}

#[tauri::command]
fn get_usage_history(state: State<'_, AppState>) -> Result<UsageHistory, String> {
    Ok(state.stats_tracker.get_usage_history())
}

#[tauri::command]
fn reset_usage_history(state: State<'_, AppState>) -> Result<(), String> {
    state.stats_tracker.reset_all_history()
}

#[tauri::command]
async fn ping_config(host: String, port: u16, timeout_ms: Option<u64>) -> Result<PingResult, String> {
    Ok(measure_tcp_ping(&host, port, timeout_ms.unwrap_or(5000)).await)
}

#[tauri::command]
async fn verify_isp_slt(creds: SltCredentials) -> Result<IspVerificationResponse, String> {
    query_slt_usage(creds).await
}

#[tauri::command]
async fn get_slt_vas_bundles(creds: SltCredentials) -> Result<Vec<SltVasBundleItem>, String> {
    query_slt_vas_bundles(creds).await
}

#[tauri::command]
async fn get_slt_full_usage(creds: SltCredentials) -> Result<SltUsageResponse, String> {
    query_slt_full_usage(creds).await
}

#[tauri::command]
async fn verify_isp_dialog(creds: DialogCredentials) -> Result<IspVerificationResponse, String> {
    query_dialog_usage(creds).await
}

#[tauri::command]
fn get_system_logs(state: State<'_, AppState>) -> Result<Vec<ProcessLogEntry>, String> {
    Ok(state.process_manager.get_recent_logs())
}

#[tauri::command]
fn check_binaries_status(state: State<'_, AppState>) -> Result<BinariesStatus, String> {
    let xray = state.process_manager.find_binary_path("xray.exe");
    let tun2socks = state.process_manager.find_binary_path("tun2socks.exe");
    let wintun = state.process_manager.find_binary_path("wintun.dll");

    let xray_found = xray.is_some();
    let tun2socks_found = tun2socks.is_some();
    let wintun_found = wintun.is_some();

    Ok(BinariesStatus {
        xray_found,
        xray_path: xray.map(|p| p.to_string_lossy().to_string()),
        tun2socks_found,
        tun2socks_path: tun2socks.map(|p| p.to_string_lossy().to_string()),
        wintun_found,
        wintun_path: wintun.map(|p| p.to_string_lossy().to_string()),
        ready: xray_found && tun2socks_found && wintun_found,
    })
}

#[tauri::command]
fn is_elevated() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let output = std::process::Command::new("net")
            .arg("session")
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        match output {
            Ok(out) => out.status.success(),
            Err(_) => false,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        true
    }
}

#[tauri::command]
fn relaunch_as_admin() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = current_exe.to_string_lossy().to_string();
        let _ = std::process::Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &format!("Start-Process -FilePath '{}' -Verb RunAs", exe_str),
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Failed to launch elevated process: {}", e))?;
        std::process::exit(0);
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(())
    }
}

#[tauri::command]
fn set_windows_autostart(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe_str = exe.to_string_lossy().to_string();

        if enabled {
            let val = format!("\"{}\" --autostart", exe_str);
            let _ = std::process::Command::new("reg")
                .args(&[
                    "add",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "HyperVPN",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &val,
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| format!("Failed to set autostart registry: {}", e))?;
        } else {
            let _ = std::process::Command::new("reg")
                .args(&[
                    "delete",
                    "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                    "/v",
                    "HyperVPN",
                    "/f",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }
    Ok(())
}

#[tauri::command]
fn get_windows_autostart() -> Result<bool, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let output = std::process::Command::new("reg")
            .args(&[
                "query",
                "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run",
                "/v",
                "HyperVPN",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        if let Ok(out) = output {
            return Ok(out.status.success());
        }
    }
    Ok(false)
}

#[tauri::command]
async fn check_for_updates() -> Result<UpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("HyperVPN-Desktop-Client")
        .build()
        .map_err(|e| format!("Client error: {}", e))?;

    let res = client
        .get("https://api.github.com/repos/omeshapasan2/HyperVPN/releases/latest")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| format!("Failed to connect to GitHub releases: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("GitHub API returned HTTP {}", res.status()));
    }

    let json_val: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse release JSON: {}", e))?;

    let tag_name = json_val
        .get("tag_name")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let latest_version = tag_name.trim_start_matches('v').trim().to_string();
    let release_notes = json_val
        .get("body")
        .and_then(|b| b.as_str())
        .unwrap_or("")
        .to_string();
    let published_at = json_val
        .get("published_at")
        .and_then(|p| p.as_str())
        .unwrap_or("")
        .to_string();
    let html_url = json_val
        .get("html_url")
        .and_then(|u| u.as_str())
        .unwrap_or("https://github.com/omeshapasan2/HyperVPN/releases/latest")
        .to_string();

    let mut download_url = html_url.clone();
    if let Some(assets) = json_val.get("assets").and_then(|a| a.as_array()) {
        for asset in assets {
            let name = asset
                .get("name")
                .and_then(|n| n.as_str())
                .unwrap_or("")
                .to_lowercase();
            if name.ends_with(".msi") || name.ends_with(".exe") {
                if let Some(asset_url) = asset.get("browser_download_url").and_then(|u| u.as_str()) {
                    download_url = asset_url.to_string();
                    break;
                }
            }
        }
    }

    let has_update = is_newer_version(&latest_version, &current_version);

    Ok(UpdateCheckResult {
        current_version,
        latest_version,
        has_update,
        release_notes,
        download_url,
        published_at,
    })
}

// ---------------------------------------------------------------------------
// Core Sidecar Binaries In-App Updater
// ---------------------------------------------------------------------------

pub fn compute_file_sha256(path: &Path) -> Result<String, String> {
    let mut file = fs::File::open(path).map_err(|e| format!("Failed to open file for hashing: {}", e))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 65536];
    loop {
        let count = file.read(&mut buffer).map_err(|e| format!("Failed to read file: {}", e))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

pub fn get_binary_version(binary_path: &Path) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let file_name = binary_path.file_name()?.to_string_lossy().to_lowercase();
        if file_name.contains("xray") {
            let output = std::process::Command::new(binary_path)
                .arg("version")
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .ok()?;
            let out_str = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = out_str.lines().next() {
                let parts: Vec<&str> = first_line.split_whitespace().collect();
                if parts.len() >= 2 && parts[0].eq_ignore_ascii_case("xray") {
                    return Some(parts[1].trim_start_matches('v').to_string());
                }
            }
        } else if file_name.contains("tun2socks") {
            let output = std::process::Command::new(binary_path)
                .arg("-v")
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .ok()?;
            let out_str = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = out_str.lines().next() {
                let trimmed = first_line.trim();
                let ver = trimmed
                    .trim_start_matches("tun2socks")
                    .trim_start_matches('-')
                    .trim_start_matches('v')
                    .trim();
                if !ver.is_empty() {
                    return Some(ver.to_string());
                }
            }
        } else if file_name.contains("wintun") {
            return Some("0.14.1".to_string());
        }
    }
    None
}

fn get_default_manifest() -> BinariesManifest {
    BinariesManifest {
        version: "2026.09.1".to_string(),
        updated_at: Some(chrono::Utc::now().to_rfc3339()),
        binaries: vec![
            BinaryManifestItem {
                name: "xray.exe".to_string(),
                version: "latest".to_string(),
                url: "https://github.com/XTLS/Xray-core/releases/latest/download/Xray-windows-64.zip".to_string(),
                archive_type: Some("zip".to_string()),
                file_path_in_archive: Some("xray.exe".to_string()),
                sha256: None,
                extra_files: Some(vec!["geoip.dat".to_string(), "geosite.dat".to_string()]),
                description: Some("Xray-core VLESS/Reality high-performance routing engine".to_string()),
            },
            BinaryManifestItem {
                name: "tun2socks.exe".to_string(),
                version: "latest".to_string(),
                url: "https://github.com/xjasonlyu/tun2socks/releases/latest/download/tun2socks-windows-amd64.zip".to_string(),
                archive_type: Some("zip".to_string()),
                file_path_in_archive: Some("*.exe".to_string()),
                sha256: None,
                extra_files: None,
                description: Some("TUN interface to SOCKS5 packet forwarder".to_string()),
            },
            BinaryManifestItem {
                name: "wintun.dll".to_string(),
                version: "0.14.1".to_string(),
                url: "https://www.wintun.net/builds/wintun-0.14.1.zip".to_string(),
                archive_type: Some("zip".to_string()),
                file_path_in_archive: Some("wintun/bin/amd64/wintun.dll".to_string()),
                sha256: None,
                extra_files: None,
                description: Some("High-speed WireGuard kernel TUN driver for Windows".to_string()),
            },
        ],
    }
}

async fn fetch_binaries_manifest() -> BinariesManifest {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("HyperVPN-Desktop-Client")
        .build()
    {
        Ok(c) => c,
        Err(_) => return get_default_manifest(),
    };

    let res = client
        .get("https://api.github.com/repos/omeshapasan2/HyperVPN/releases/latest")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await;

    if let Ok(response) = res {
        if response.status().is_success() {
            if let Ok(json_val) = response.json::<serde_json::Value>().await {
                if let Some(assets) = json_val.get("assets").and_then(|a| a.as_array()) {
                    for asset in assets {
                        let name = asset
                            .get("name")
                            .and_then(|n| n.as_str())
                            .unwrap_or("")
                            .to_lowercase();
                        if name == "binaries-manifest.json" || name == "binaries-windows-amd64-manifest.json" {
                            if let Some(download_url) = asset.get("browser_download_url").and_then(|u| u.as_str()) {
                                if let Ok(manifest_resp) = client.get(download_url).send().await {
                                    if manifest_resp.status().is_success() {
                                        if let Ok(manifest) = manifest_resp.json::<BinariesManifest>().await {
                                            return manifest;
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

    get_default_manifest()
}

async fn check_core_binaries_updates_internal(state: &AppState) -> Result<BinariesUpdateCheckResult, String> {
    let manifest = fetch_binaries_manifest().await;
    let mut statuses = Vec::new();
    let mut has_any_update = false;

    for item in &manifest.binaries {
        let binary_path = state.process_manager.find_binary_path(&item.name);
        let exists = binary_path.is_some();
        let mut current_version = None;
        let mut size_bytes = None;
        let mut sha256 = None;

        if let Some(ref path) = binary_path {
            size_bytes = fs::metadata(path).map(|m| m.len()).ok();
            sha256 = compute_file_sha256(path).ok();
            current_version = get_binary_version(path);
        }

        let has_update = if !exists {
            true
        } else if let Some(ref target_sha) = item.sha256 {
            sha256.as_ref().map(|s| !s.eq_ignore_ascii_case(target_sha)).unwrap_or(true)
        } else if item.version != "latest" {
            if let Some(ref cur_v) = current_version {
                is_newer_version(&item.version, cur_v)
            } else {
                false
            }
        } else {
            false
        };

        if has_update {
            has_any_update = true;
        }

        statuses.push(BinaryItemStatus {
            name: item.name.clone(),
            description: item.description.clone().unwrap_or_else(|| item.name.clone()),
            current_version,
            latest_version: item.version.clone(),
            exists,
            path: binary_path.map(|p| p.to_string_lossy().to_string()),
            has_update,
            size_bytes,
            sha256,
            url: item.url.clone(),
        });
    }

    Ok(BinariesUpdateCheckResult {
        has_update: has_any_update,
        manifest_version: manifest.version,
        binaries: statuses,
        check_time: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
async fn check_core_binaries_updates(state: State<'_, AppState>) -> Result<BinariesUpdateCheckResult, String> {
    check_core_binaries_updates_internal(&state).await
}

#[tauri::command]
async fn update_core_binaries(
    app: AppHandle,
    state: State<'_, AppState>,
    binaries_to_update: Option<Vec<String>>,
) -> Result<BinariesUpdateCheckResult, String> {
    let _guard = state.update_lock.lock().await;

    let emit_progress = |stage: &str, current_item: &str, current_percent: u8, message: &str, total: usize, completed: usize| {
        let p = BinaryUpdateProgress {
            stage: stage.to_string(),
            current_item: current_item.to_string(),
            current_percent,
            message: message.to_string(),
            total_items: total,
            completed_items: completed,
        };
        let _ = app.emit("binaries-update-progress", &p);
        state.process_manager.add_log("system", "info", &format!("[Core Updater] {}", message));
    };

    emit_progress("checking", "", 5, "Fetching binaries release manifest...", 0, 0);
    let manifest = fetch_binaries_manifest().await;

    // Filter items to update
    let target_items: Vec<BinaryManifestItem> = if let Some(ref specific) = binaries_to_update {
        manifest
            .binaries
            .iter()
            .filter(|b| specific.iter().any(|s| s.eq_ignore_ascii_case(&b.name)))
            .cloned()
            .collect()
    } else {
        manifest.binaries.clone()
    };

    if target_items.is_empty() {
        return Err("No binaries selected for update".to_string());
    }

    let staging_dir = state.data_dir.join(".binaries-update-staging");
    if staging_dir.exists() {
        let _ = fs::remove_dir_all(&staging_dir);
    }
    fs::create_dir_all(&staging_dir).map_err(|e| format!("Failed to create staging directory: {}", e))?;

    let target_dir = state.data_dir.join("bin");
    fs::create_dir_all(&target_dir).map_err(|e| format!("Failed to create bin directory: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .user_agent("HyperVPN-Desktop-Client")
        .build()
        .map_err(|e| format!("Failed to initialize HTTP client: {}", e))?;

    let total = target_items.len();

    for (idx, item) in target_items.iter().enumerate() {
        let base_percent = (10 + (idx * 60 / total)) as u8;
        emit_progress(
            "downloading",
            &item.name,
            base_percent,
            &format!("Downloading {} (item {}/{})...", item.name, idx + 1, total),
            total,
            idx,
        );

        let resp = client
            .get(&item.url)
            .send()
            .await
            .map_err(|e| format!("Failed to download {}: {}", item.name, e))?;

        if !resp.status().is_success() {
            let _ = fs::remove_dir_all(&staging_dir);
            return Err(format!("Download failed for {} with HTTP status {}", item.name, resp.status()));
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("Failed to read stream for {}: {}", item.name, e))?;

        emit_progress(
            "extracting",
            &item.name,
            base_percent + (20 / total as u8),
            &format!("Extracting {}...", item.name),
            total,
            idx,
        );

        let is_zip = item.archive_type.as_deref() == Some("zip") || item.url.to_lowercase().ends_with(".zip");

        if is_zip {
            let cursor = std::io::Cursor::new(bytes);
            let mut zip = ZipArchive::new(cursor)
                .map_err(|e| format!("Failed to open zip archive for {}: {}", item.name, e))?;

            let mut extracted_primary = false;
            for i in 0..zip.len() {
                let mut file = zip
                    .by_index(i)
                    .map_err(|e| format!("Failed to read zip entry: {}", e))?;

                if file.is_dir() {
                    continue;
                }

                let entry_name = file.name().replace('\\', "/");

                // Check primary binary matching
                let is_primary = if let Some(ref target_path) = item.file_path_in_archive {
                    if target_path.starts_with("*.") {
                        let ext = &target_path[1..];
                        entry_name.ends_with(ext) && (entry_name.contains(&item.name.replace(".exe", "")) || !extracted_primary)
                    } else {
                        entry_name == *target_path
                            || entry_name.ends_with(&format!("/{}", target_path))
                            || entry_name.ends_with(&item.name)
                    }
                } else {
                    entry_name == item.name || entry_name.ends_with(&format!("/{}", item.name))
                };

                if is_primary && !extracted_primary {
                    let dest = staging_dir.join(&item.name);
                    let mut out = fs::File::create(&dest)
                        .map_err(|e| format!("Failed to create {}: {}", dest.display(), e))?;
                    std::io::copy(&mut file, &mut out)
                        .map_err(|e| format!("Failed to extract {}: {}", item.name, e))?;
                    extracted_primary = true;
                    continue;
                }

                // Check extra files (e.g. geoip.dat, geosite.dat)
                if let Some(ref extras) = item.extra_files {
                    for extra in extras {
                        if entry_name == *extra || entry_name.ends_with(&format!("/{}", extra)) {
                            let dest = staging_dir.join(extra);
                            let mut out = fs::File::create(&dest)
                                .map_err(|e| format!("Failed to create {}: {}", dest.display(), e))?;
                            std::io::copy(&mut file, &mut out)
                                .map_err(|e| format!("Failed to extract {}: {}", extra, e))?;
                            break;
                        }
                    }
                }
            }

            if !extracted_primary {
                let _ = fs::remove_dir_all(&staging_dir);
                return Err(format!("Could not locate '{}' within downloaded zip archive", item.name));
            }
        } else {
            let dest = staging_dir.join(&item.name);
            fs::write(&dest, &bytes)
                .map_err(|e| format!("Failed to save {}: {}", dest.display(), e))?;
        }

        // SHA-256 verification
        if let Some(ref expected_sha) = item.sha256 {
            emit_progress(
                "verifying",
                &item.name,
                base_percent + (40 / total as u8),
                &format!("Verifying checksum for {}...", item.name),
                total,
                idx,
            );
            let calculated_sha = compute_file_sha256(&staging_dir.join(&item.name))?;
            if !calculated_sha.eq_ignore_ascii_case(expected_sha) {
                let _ = fs::remove_dir_all(&staging_dir);
                return Err(format!(
                    "SHA-256 verification failed for {}: expected {}, got {}",
                    item.name, expected_sha, calculated_sha
                ));
            }
        }
    }

    // Atomic installation step
    emit_progress("installing", "all", 80, "Preparing to install core binaries...", total, total);

    let was_connected = state.process_manager.is_connected();
    let active_cfg = state.process_manager.get_active_config();

    if was_connected {
        emit_progress("installing", "all", 83, "Pausing active VPN connection to release file locks...", total, total);
        state.process_manager.disconnect().await?;
        tokio::time::sleep(std::time::Duration::from_millis(600)).await;
    }

    // List all files in staging_dir
    let entries = fs::read_dir(&staging_dir)
        .map_err(|e| format!("Failed to inspect staging directory: {}", e))?;

    let mut staged_files = Vec::new();
    for entry in entries.flatten() {
        if entry.path().is_file() {
            staged_files.push(entry.file_name());
        }
    }

    // Backup existing files
    let mut backups = Vec::new();
    for file_name in &staged_files {
        let target_file = target_dir.join(file_name);
        if target_file.exists() {
            let backup_file = target_dir.join(format!("{}.bak", file_name.to_string_lossy()));
            if let Err(e) = fs::copy(&target_file, &backup_file) {
                let _ = fs::remove_dir_all(&staging_dir);
                return Err(format!("Failed to backup existing binary {}: {}", file_name.to_string_lossy(), e));
            }
            backups.push((target_file, backup_file));
        }
    }

    // Copy staged files to target bin directory
    let mut install_error = None;
    for file_name in &staged_files {
        let src = staging_dir.join(file_name);
        let dst = target_dir.join(file_name);
        if let Err(e) = fs::copy(&src, &dst) {
            install_error = Some(format!("Failed to install {}: {}", file_name.to_string_lossy(), e));
            break;
        }
    }

    // Rollback if failed
    if let Some(err_msg) = install_error {
        emit_progress("error", "all", 85, &format!("Installation error: {}. Rolling back...", err_msg), total, total);
        for (target, backup) in &backups {
            if backup.exists() {
                let _ = fs::copy(backup, target);
            }
        }
        let _ = fs::remove_dir_all(&staging_dir);
        return Err(err_msg);
    }

    // Clean up backups and staging dir
    for (_, backup) in &backups {
        let _ = fs::remove_file(backup);
    }
    let _ = fs::remove_dir_all(&staging_dir);

    // Reconnect VPN if it was connected
    if was_connected {
        if let Some(cfg) = active_cfg {
            emit_progress("reconnecting", "all", 95, "Resuming VPN connection with updated engine...", total, total);
            let settings = state.storage_manager.get_settings();
            let _ = state
                .process_manager
                .connect(
                    cfg,
                    settings.socks_port,
                    settings.stats_port,
                    settings.custom_lan_exclusions,
                    state.data_dir.clone(),
                )
                .await;
        }
    }

    emit_progress("complete", "all", 100, "Core binaries updated and installed successfully!", total, total);

    drop(_guard);
    check_core_binaries_updates_internal(&state).await
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let parse_ver = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|p| {
                p.chars()
                    .take_while(|c| c.is_ascii_digit())
                    .collect::<String>()
                    .parse::<u32>()
                    .ok()
            })
            .collect()
    };

    let l_parts = parse_ver(latest);
    let c_parts = parse_ver(current);

    for (l, c) in l_parts.iter().zip(c_parts.iter()) {
        if l > c {
            return true;
        } else if l < c {
            return false;
        }
    }
    l_parts.len() > c_parts.len()
}

// ---------------------------------------------------------------------------
// App Entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Determine data directory (%APPDATA%/com.hypervpn.app)
    let data_dir = dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.hypervpn.app");
    std::fs::create_dir_all(&data_dir).ok();

    let process_mgr = Arc::new(ProcessManager::new());
    let stats_tracker = Arc::new(StatsTracker::new(data_dir.clone()));
    let storage_mgr = Arc::new(StorageManager::new(data_dir.clone()));

    // Clean up any orphaned processes/routes from prior unclean exit
    process_mgr.cleanup_orphans();

    let pm_clone = Arc::clone(&process_mgr);
    let st_clone = Arc::clone(&stats_tracker);
    let sm_clone = Arc::clone(&storage_mgr);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = tray::show_or_create_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::default(),
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState {
            process_manager: Arc::clone(&process_mgr),
            stats_tracker: Arc::clone(&stats_tracker),
            storage_manager: Arc::clone(&storage_mgr),
            data_dir,
            update_lock: Arc::new(tokio::sync::Mutex::new(())),
        })
        .setup(move |app| {
            // Setup System Tray
            if let Err(e) = tray::setup_system_tray(app.handle()) {
                eprintln!("Failed to setup system tray: {}", e);
            }

            // Provide app handle to ProcessManager for event emission
            pm_clone.set_app_handle(app.handle().clone());

            // Handle --autostart flag: destroy window on launch to start headless in tray
            let is_autostart = std::env::args().any(|a| a == "--autostart");
            if is_autostart {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.destroy();
                }
            }

            // Spawn background timer to poll Xray Stats API every 1 second
            let pm_bg = Arc::clone(&pm_clone);
            let st_bg = Arc::clone(&st_clone);
            let sm_bg = Arc::clone(&sm_clone);

            tauri::async_runtime::spawn(async move {
                loop {
                    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    let settings = sm_bg.get_settings();
                    st_bg.poll_xray_stats(&pm_bg, settings.stats_port);
                }
            });

            // Check auto-connect on launch
            let settings = sm_clone.get_settings();
            if settings.auto_connect_on_launch {
                let configs = sm_clone.get_configs();
                if let Some(first) = configs.first() {
                    let first_cfg = first.clone();
                    let pm_auto = Arc::clone(&pm_clone);
                    let data_dir_auto = dirs_next::data_dir()
                        .unwrap_or_else(|| PathBuf::from("."))
                        .join("com.hypervpn.app");
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(std::time::Duration::from_millis(1500)).await;
                        let _ = pm_auto
                            .connect(
                                first_cfg,
                                settings.socks_port,
                                settings.stats_port,
                                settings.custom_lan_exclusions,
                                data_dir_auto,
                            )
                            .await;
                    });
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    let app = window.app_handle();
                    if let Some(state) = app.try_state::<AppState>() {
                        let settings = state.storage_manager.get_settings();
                        if settings.minimize_to_tray_on_close {
                            api.prevent_close();
                            let _ = window.destroy();
                            tray::update_tray_menu(app);
                        }
                    }
                }
                WindowEvent::Destroyed => {
                    let app = window.app_handle();
                    tray::update_tray_menu(app);
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            connect_vpn,
            disconnect_vpn,
            get_vpn_status,
            get_saved_configs,
            save_configs,
            get_app_settings,
            save_app_settings,
            get_usage_history,
            reset_usage_history,
            ping_config,
            verify_isp_slt,
            get_slt_vas_bundles,
            get_slt_full_usage,
            verify_isp_dialog,
            get_system_logs,
            check_binaries_status,
            is_elevated,
            relaunch_as_admin,
            set_windows_autostart,
            get_windows_autostart,
            check_for_updates,
            check_core_binaries_updates,
            update_core_binaries,
        ])
        .build(tauri::generate_context!())
        .expect("error while building HyperVPN")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                // Prevent app from exiting when all windows are closed/destroyed
                api.prevent_exit();
            }
        });
}
