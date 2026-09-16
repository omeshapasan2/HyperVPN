use crate::routing::{
    cleanup_tun_routes, configure_wintun_adapter, get_default_gateway, setup_tun_routes,
    wait_for_adapter_ready,
};
use crate::vless::VlessConfig;
use crate::xray_config::generate_xray_config;
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::fs;
use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessLogEntry {
    pub id: String,
    pub source: String, // "xray" | "tun2socks" | "system"
    pub level: String,  // "info" | "warn" | "error"
    pub message: String,
    pub timestamp: i64,
}

pub struct ProcessManager {
    xray_child: Mutex<Option<Child>>,
    tun2socks_child: Mutex<Option<Child>>,
    active_config: Mutex<Option<VlessConfig>>,
    connected_at: Mutex<Option<Instant>>,
    logs: Mutex<VecDeque<ProcessLogEntry>>,
    app_handle: Mutex<Option<AppHandle>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            xray_child: Mutex::new(None),
            tun2socks_child: Mutex::new(None),
            active_config: Mutex::new(None),
            connected_at: Mutex::new(None),
            logs: Mutex::new(VecDeque::with_capacity(300)),
            app_handle: Mutex::new(None),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(handle);
    }

    pub fn is_connected(&self) -> bool {
        let xray_alive = self.xray_child.lock().unwrap().as_mut().map(|c| c.try_wait().ok() == Some(None)).unwrap_or(false);
        let tun_alive = self.tun2socks_child.lock().unwrap().as_mut().map(|c| c.try_wait().ok() == Some(None)).unwrap_or(false);
        xray_alive && tun_alive
    }

    pub fn get_active_config_id(&self) -> Option<String> {
        self.active_config.lock().unwrap().as_ref().map(|c| c.id.clone())
    }

    pub fn get_uptime_seconds(&self) -> u64 {
        if let Some(start) = *self.connected_at.lock().unwrap() {
            start.elapsed().as_secs()
        } else {
            0
        }
    }

    pub fn add_log(&self, source: &str, level: &str, message: &str) {
        let entry = ProcessLogEntry {
            id: format!("log_{}", chrono::Utc::now().timestamp_micros()),
            source: source.to_string(),
            level: level.to_string(),
            message: message.to_string(),
            timestamp: chrono::Utc::now().timestamp_millis(),
        };

        if let Ok(mut logs) = self.logs.lock() {
            if logs.len() >= 300 {
                logs.pop_front();
            }
            logs.push_back(entry.clone());
        }

        if let Ok(guard) = self.app_handle.lock() {
            if let Some(ref handle) = *guard {
                let _ = handle.emit("log-entry", &entry);
            }
        }

        println!("[{}] [{}] {}", source, level, message);
    }

    pub fn get_recent_logs(&self) -> Vec<ProcessLogEntry> {
        self.logs.lock().unwrap().iter().cloned().collect()
    }

    /// Finds the path to a sidecar binary (e.g. "xray.exe", "tun2socks.exe", "wintun.dll", "WebView2Loader.dll")
    pub fn find_binary_path(&self, binary_name: &str) -> Option<PathBuf> {
        // Check alongside current executable
        if let Ok(current_exe) = std::env::current_exe() {
            if let Some(parent) = current_exe.parent() {
                let candidate = parent.join(binary_name);
                if candidate.exists() {
                    return Some(candidate);
                }
                let binaries_subdir = parent.join("binaries").join(binary_name);
                if binaries_subdir.exists() {
                    return Some(binaries_subdir);
                }
            }
        }

        // Check relative development path
        let dev_paths = [
            PathBuf::from(format!("src-tauri/binaries/{}", binary_name)),
            PathBuf::from(format!("binaries/{}", binary_name)),
            PathBuf::from(format!("src-tauri/{}", binary_name)),
            PathBuf::from(binary_name),
        ];
        for path in &dev_paths {
            if path.exists() {
                if let Ok(abs) = fs::canonicalize(path) {
                    return Some(abs);
                }
                return Some(path.clone());
            }
        }

        // Check AppData directory
        if let Some(app_data) = dirs_next::data_dir() {
            let app_dir = app_data.join("com.hypervpn.app").join("bin").join(binary_name);
            if app_dir.exists() {
                return Some(app_dir);
            }
        }

        None
    }

    /// Connects the VPN using the provided VLESS configuration.
    pub async fn connect(
        self: &Arc<Self>,
        config: VlessConfig,
        socks_port: u16,
        stats_port: u16,
        custom_exclusions: Vec<String>,
        app_data_dir: PathBuf,
    ) -> Result<(), String> {
        if self.is_connected() {
            self.disconnect().await?;
        }

        self.add_log("system", "info", &format!("Starting connection to {} ({})", config.remark, config.host));

        // 1. Locate binaries
        let xray_bin = self
            .find_binary_path("xray.exe")
            .ok_or_else(|| "xray.exe not found. Please place xray.exe in the binaries folder.".to_string())?;

        let tun2socks_bin = self
            .find_binary_path("tun2socks.exe")
            .ok_or_else(|| "tun2socks.exe not found. Please place tun2socks.exe in the binaries folder.".to_string())?;

        // 2. Write generated Xray config to app_data_dir/config.json
        fs::create_dir_all(&app_data_dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
        let xray_config_json = generate_xray_config(&config, socks_port, stats_port);
        let config_path = app_data_dir.join("xray_runtime_config.json");
        fs::write(&config_path, serde_json::to_string_pretty(&xray_config_json).unwrap())
            .map_err(|e| format!("Failed to write Xray config file: {}", e))?;

        // 3. Spawn Xray-core
        self.add_log("xray", "info", "Spawning Xray-core process...");
        let mut xray_cmd = Command::new(&xray_bin);
        xray_cmd.args(&["run", "-c", config_path.to_str().unwrap()]);
        xray_cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            xray_cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut xray_process = xray_cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn xray.exe: {}", e))?;

        // Pipe Xray stdout & stderr to log stream
        let stdout = xray_process.stdout.take();
        let stderr = xray_process.stderr.take();
        let self_clone_1 = Arc::clone(self);
        let self_clone_2 = Arc::clone(self);

        if let Some(out) = stdout {
            std::thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines().flatten() {
                    self_clone_1.add_log("xray", "info", &line);
                }
            });
        }
        if let Some(err) = stderr {
            std::thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines().flatten() {
                    self_clone_2.add_log("xray", "warn", &line);
                }
            });
        }

        *self.xray_child.lock().unwrap() = Some(xray_process);

        // 4. Wait for Xray SOCKS5 port to accept connections
        self.add_log("system", "info", "Waiting for Xray-core SOCKS5 inbound...");
        let start_wait = Instant::now();
        let mut port_ready = false;
        while start_wait.elapsed() < Duration::from_secs(4) {
            if TcpStream::connect(format!("127.0.0.1:{}", socks_port)).is_ok() {
                port_ready = true;
                break;
            }
            tokio::time::sleep(Duration::from_millis(150)).await;
        }

        if !port_ready {
            self.disconnect().await.ok();
            return Err("Timed out waiting for Xray-core SOCKS5 inbound to listen".to_string());
        }

        // 5. Ensure Windows Device & Network setup services are active, then spawn tun2socks
        #[cfg(target_os = "windows")]
        {
            let _ = crate::routing::run_cmd("cmd", &["/c", "net start NetSetupSvc"]);
            let _ = crate::routing::run_cmd("cmd", &["/c", "net start DsmSvc"]);
        }

        self.add_log("tun2socks", "info", "Spawning tun2socks bridge with Wintun adapter (HyperVPN-Wintun)...");
        let mut tun_cmd = Command::new(&tun2socks_bin);
        if let Some(bin_dir) = tun2socks_bin.parent() {
            tun_cmd.current_dir(bin_dir);
        }
        tun_cmd.args(&[
            "--device",
            "tun://HyperVPN-Wintun",
            "--proxy",
            &format!("socks5://127.0.0.1:{}", socks_port),
            "--loglevel",
            "warning",
            "--udp-timeout",
            "5m",
            "--tcp-auto-tuning",
            "--tcp-sndbuf",
            "2m",
            "--tcp-rcvbuf",
            "2m",
        ]);
        tun_cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            tun_cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut tun_process = tun_cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn tun2socks.exe: {}", e))?;

        let tun_stdout = tun_process.stdout.take();
        let tun_stderr = tun_process.stderr.take();
        let self_clone_3 = Arc::clone(self);
        let self_clone_4 = Arc::clone(self);

        if let Some(out) = tun_stdout {
            std::thread::spawn(move || {
                let reader = BufReader::new(out);
                for line in reader.lines().flatten() {
                    self_clone_3.add_log("tun2socks", "info", &line);
                }
            });
        }
        if let Some(err) = tun_stderr {
            std::thread::spawn(move || {
                let reader = BufReader::new(err);
                for line in reader.lines().flatten() {
                    self_clone_4.add_log("tun2socks", "warn", &line);
                }
            });
        }

        *self.tun2socks_child.lock().unwrap() = Some(tun_process);

        // 6. Wait for Wintun adapter to be created by Windows and verify tun2socks is running
        let adapter_ready = wait_for_adapter_ready("HyperVPN-Wintun", 8);
        if !adapter_ready {
            self.add_log("tun2socks", "warn", "Adapter creation is taking longer than usual, proceeding with configuration...");
        }

        let premature_exit = {
            let mut guard = self.tun2socks_child.lock().unwrap();
            if let Some(ref mut child) = *guard {
                child.try_wait().ok().flatten()
            } else {
                None
            }
        };

        if let Some(status) = premature_exit {
            self.disconnect().await.ok();
            return Err(format!(
                "tun2socks exited prematurely with status: {}. Administrator privileges are required to create Wintun network adapter.",
                status
            ));
        }

        // 7. Configure Wintun interface IP, DNS, and metric
        let wintun_ip = "198.18.0.1";
        if let Err(e) = configure_wintun_adapter("HyperVPN-Wintun", wintun_ip) {
            self.add_log("system", "warn", &format!("Wintun interface config warning: {}", e));
        }

        // 8. Setup TUN routing and LAN exclusions
        let gw_info = get_default_gateway().unwrap_or_else(|_| crate::routing::GatewayInfo {
            gateway_ip: "192.168.1.1".to_string(),
            interface_index: None,
        });

        if let Err(e) = setup_tun_routes(&config.host, wintun_ip, &gw_info.gateway_ip, gw_info.interface_index, &custom_exclusions) {
            self.add_log("system", "error", &format!("Routing setup error: {}", e));
            self.disconnect().await.ok();
            return Err(format!("Failed to configure Windows routing table: {}", e));
        }

        *self.active_config.lock().unwrap() = Some(config.clone());
        *self.connected_at.lock().unwrap() = Some(Instant::now());

        self.add_log("system", "info", "HyperVPN successfully connected in system-wide TUN mode.");

        if let Ok(guard) = self.app_handle.lock() {
            if let Some(ref handle) = *guard {
                let _ = handle.emit("vpn-status-changed", true);
            }
        }

        Ok(())
    }

    /// Disconnects the VPN and cleans up all processes and routes.
    pub async fn disconnect(self: &Arc<Self>) -> Result<(), String> {
        self.add_log("system", "info", "Disconnecting HyperVPN...");

        // 1. Clean up routing first
        let active_cfg = self.active_config.lock().unwrap().take();
        let host = active_cfg.as_ref().map(|c| c.host.as_str()).unwrap_or("");
        let _ = cleanup_tun_routes(host, &[]);

        // 2. Kill tun2socks bridge first
        if let Some(mut child) = self.tun2socks_child.lock().unwrap().take() {
            self.add_log("tun2socks", "info", "Stopping tun2socks...");
            let _ = child.kill();
            let _ = child.wait();
        }

        // 3. Kill Xray-core second
        if let Some(mut child) = self.xray_child.lock().unwrap().take() {
            self.add_log("xray", "info", "Stopping Xray-core...");
            let _ = child.kill();
            let _ = child.wait();
        }

        *self.connected_at.lock().unwrap() = None;
        self.add_log("system", "info", "HyperVPN disconnected.");

        if let Ok(guard) = self.app_handle.lock() {
            if let Some(ref handle) = *guard {
                let _ = handle.emit("vpn-status-changed", false);
            }
        }

        Ok(())
    }

    /// Emergency crash cleanup function called on app startup and quit
    pub fn cleanup_orphans(&self) {
        println!("[ProcessManager] Running orphan cleanup...");
        // Clean leftover routes
        let _ = cleanup_tun_routes("", &[]);

        // On Windows, kill any lingering instances of xray.exe or tun2socks.exe
        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let _ = Command::new("taskkill")
                .args(&["/F", "/IM", "xray.exe"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
            let _ = Command::new("taskkill")
                .args(&["/F", "/IM", "tun2socks.exe"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();
        }
    }
}
