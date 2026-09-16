use crate::process::ProcessManager;
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UsageHistory {
    /// Key: "YYYY-MM-DD", Value: total bytes used
    pub daily: HashMap<String, u64>,
    /// Key: "YYYY-MM", Value: total bytes used
    pub monthly: HashMap<String, u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LiveTrafficStats {
    pub session_bytes_uplink: u64,
    pub session_bytes_downlink: u64,
    pub current_upload_speed: u64,   // bytes/sec
    pub current_download_speed: u64, // bytes/sec
}

pub struct StatsTracker {
    data_dir: PathBuf,
    history: Mutex<UsageHistory>,
    live: Mutex<LiveTrafficStats>,
    last_xray_uplink: Mutex<u64>,
    last_xray_downlink: Mutex<u64>,
    last_poll_time: Mutex<Option<Instant>>,
}

impl StatsTracker {
    pub fn new(data_dir: PathBuf) -> Self {
        let history_file = data_dir.join("usage-history.json");
        let history = if history_file.exists() {
            fs::read_to_string(&history_file)
                .ok()
                .and_then(|data| serde_json::from_str::<UsageHistory>(&data).ok())
                .unwrap_or_default()
        } else {
            UsageHistory::default()
        };

        Self {
            data_dir,
            history: Mutex::new(history),
            live: Mutex::new(LiveTrafficStats::default()),
            last_xray_uplink: Mutex::new(0),
            last_xray_downlink: Mutex::new(0),
            last_poll_time: Mutex::new(None),
        }
    }

    pub fn get_live_stats(&self) -> LiveTrafficStats {
        self.live.lock().unwrap().clone()
    }

    pub fn get_usage_history(&self) -> UsageHistory {
        self.history.lock().unwrap().clone()
    }

    pub fn reset_session(&self) {
        *self.live.lock().unwrap() = LiveTrafficStats::default();
        *self.last_xray_uplink.lock().unwrap() = 0;
        *self.last_xray_downlink.lock().unwrap() = 0;
        *self.last_poll_time.lock().unwrap() = None;
    }

    pub fn reset_all_history(&self) -> Result<(), String> {
        let mut history = self.history.lock().unwrap();
        history.daily.clear();
        history.monthly.clear();
        self.save_history(&history)
    }

    fn save_history(&self, history: &UsageHistory) -> Result<(), String> {
        let history_file = self.data_dir.join("usage-history.json");
        let json_data = serde_json::to_string_pretty(history)
            .map_err(|e| format!("Failed to serialize history: {}", e))?;
        fs::write(history_file, json_data).map_err(|e| format!("Failed to write usage history: {}", e))?;
        Ok(())
    }

    /// Polls Xray Stats API via `xray.exe api statsquery --server=127.0.0.1:<stats_port>`
    pub fn poll_xray_stats(&self, process_manager: &ProcessManager, stats_port: u16) {
        process_manager.check_connection_health();

        if !process_manager.is_connected() {
            // If disconnected, set current speeds to 0
            let mut live = self.live.lock().unwrap();
            live.current_upload_speed = 0;
            live.current_download_speed = 0;
            return;
        }

        let xray_bin = match process_manager.find_binary_path("xray.exe") {
            Some(path) => path,
            None => return,
        };

        let server_arg = format!("127.0.0.1:{}", stats_port);
        let mut cmd = Command::new(xray_bin);
        cmd.args(&["api", "statsquery", "--server", &server_arg]);

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let output = match cmd.output() {
            Ok(out) if out.status.success() => out.stdout,
            _ => return,
        };

        let json_text = String::from_utf8_lossy(&output);
        let parsed: serde_json::Value = match serde_json::from_str(&json_text) {
            Ok(v) => v,
            Err(_) => return,
        };

        let mut current_total_uplink = 0u64;
        let mut current_total_downlink = 0u64;

        if let Some(stats_array) = parsed.get("stat").and_then(|s| s.as_array()) {
            for item in stats_array {
                let name = item.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let val = item.get("value").and_then(|v| v.as_u64()).unwrap_or(0);

                // Check inbound or outbound traffic counters
                if name.contains("inbound>>>socks-in>>>traffic>>>uplink")
                    || name.contains("outbound>>>proxy>>>traffic>>>uplink")
                {
                    current_total_uplink = current_total_uplink.max(val);
                }
                if name.contains("inbound>>>socks-in>>>traffic>>>downlink")
                    || name.contains("outbound>>>proxy>>>traffic>>>downlink")
                {
                    current_total_downlink = current_total_downlink.max(val);
                }
            }
        }

        // Calculate delta
        let mut last_up = self.last_xray_uplink.lock().unwrap();
        let mut last_down = self.last_xray_downlink.lock().unwrap();
        let mut last_time = self.last_poll_time.lock().unwrap();

        let delta_up = if *last_up == 0 || current_total_uplink < *last_up {
            0
        } else {
            current_total_uplink - *last_up
        };

        let delta_down = if *last_down == 0 || current_total_downlink < *last_down {
            0
        } else {
            current_total_downlink - *last_down
        };

        *last_up = current_total_uplink;
        *last_down = current_total_downlink;

        let now = Instant::now();
        let elapsed_secs = last_time.map(|t| (now - t).as_secs_f64()).unwrap_or(5.0).max(1.0);
        *last_time = Some(now);

        let total_delta = delta_up + delta_down;

        // Update live stats
        let mut live = self.live.lock().unwrap();
        live.session_bytes_uplink += delta_up;
        live.session_bytes_downlink += delta_down;
        live.current_upload_speed = (delta_up as f64 / elapsed_secs) as u64;
        live.current_download_speed = (delta_down as f64 / elapsed_secs) as u64;

        // Update persistent history
        if total_delta > 0 {
            let today = Local::now().format("%Y-%m-%d").to_string();
            let month = Local::now().format("%Y-%m").to_string();

            let mut history = self.history.lock().unwrap();
            let daily_entry = history.daily.entry(today).or_insert(0);
            *daily_entry += total_delta;

            let monthly_entry = history.monthly.entry(month).or_insert(0);
            *monthly_entry += total_delta;

            let _ = self.save_history(&history);
        }
    }
}
