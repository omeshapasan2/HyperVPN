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
    query_dialog_usage, query_slt_usage, query_slt_vas_bundles, DialogCredentials,
    IspVerificationResponse, SltCredentials, SltVasBundleItem,
};
use ping::{measure_tcp_ping, PingResult};
use process::{ProcessLogEntry, ProcessManager};
use serde::{Deserialize, Serialize};
use stats::{StatsTracker, UsageHistory};
use storage::{AppSettings, StorageManager};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{Manager, State, WindowEvent};
use vless::VlessConfig;

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

pub struct AppState {
    pub process_manager: Arc<ProcessManager>,
    pub stats_tracker: Arc<StatsTracker>,
    pub storage_manager: Arc<StorageManager>,
    pub data_dir: PathBuf,
}

// ---------------------------------------------------------------------------
// Tauri Commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn connect_vpn(config: VlessConfig, state: State<'_, AppState>) -> Result<(), String> {
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
            let _ = app.get_webview_window("main").map(|w| {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            });
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
        })
        .setup(move |app| {
            // Setup System Tray
            if let Err(e) = tray::setup_system_tray(app.handle()) {
                eprintln!("Failed to setup system tray: {}", e);
            }

            // Provide app handle to ProcessManager for event emission
            pm_clone.set_app_handle(app.handle().clone());

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
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Intercept close button and minimize to tray
                let app = window.app_handle();
                if let Some(state) = app.try_state::<AppState>() {
                    let settings = state.storage_manager.get_settings();
                    if settings.minimize_to_tray_on_close {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                }
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
            verify_isp_dialog,
            get_system_logs,
            check_binaries_status,
            is_elevated,
            relaunch_as_admin,
            set_windows_autostart,
            get_windows_autostart,
            check_for_updates,
        ])
        .run(tauri::generate_context!())
        .expect("error while running HyperVPN");
}
