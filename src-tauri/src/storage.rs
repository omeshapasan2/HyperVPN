use crate::vless::VlessConfig;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SltSettings {
    pub subscriber_id: String,
    pub token: String,
    pub client_id: String,
}

impl Default for SltSettings {
    fn default() -> Self {
        Self {
            subscriber_id: String::new(),
            token: String::new(),
            client_id: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DialogSettings {
    pub msisdn: String,
    pub uuid: String,
    pub cookie: String,
    pub selected_usage_type_index: usize,
}

impl Default for DialogSettings {
    fn default() -> Self {
        Self {
            msisdn: String::new(),
            uuid: String::new(),
            cookie: String::new(),
            selected_usage_type_index: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub auto_start: bool,
    pub auto_connect_on_launch: bool,
    pub minimize_to_tray_on_close: bool,
    pub socks_port: u16,
    pub stats_port: u16,
    pub custom_lan_exclusions: Vec<String>,
    pub default_isp: String,
    pub slt: SltSettings,
    pub dialog: DialogSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            auto_start: false,
            auto_connect_on_launch: false,
            minimize_to_tray_on_close: true,
            socks_port: 10808,
            stats_port: 10085,
            custom_lan_exclusions: vec![],
            default_isp: "slt".to_string(),
            slt: SltSettings::default(),
            dialog: DialogSettings::default(),
        }
    }
}

pub struct StorageManager {
    data_dir: PathBuf,
    configs: Mutex<Vec<VlessConfig>>,
    settings: Mutex<AppSettings>,
}

impl StorageManager {
    pub fn new(data_dir: PathBuf) -> Self {
        let _ = fs::create_dir_all(&data_dir);

        let configs_file = data_dir.join("configs.json");
        let configs = if configs_file.exists() {
            fs::read_to_string(&configs_file)
                .ok()
                .and_then(|data| serde_json::from_str::<Vec<VlessConfig>>(&data).ok())
                .unwrap_or_default()
        } else {
            Vec::new()
        };

        let settings_file = data_dir.join("settings.json");
        let settings = if settings_file.exists() {
            fs::read_to_string(&settings_file)
                .ok()
                .and_then(|data| serde_json::from_str::<AppSettings>(&data).ok())
                .unwrap_or_default()
        } else {
            AppSettings::default()
        };

        Self {
            data_dir,
            configs: Mutex::new(configs),
            settings: Mutex::new(settings),
        }
    }

    pub fn get_configs(&self) -> Vec<VlessConfig> {
        self.configs.lock().unwrap().clone()
    }

    pub fn save_configs(&self, configs: Vec<VlessConfig>) -> Result<(), String> {
        let configs_file = self.data_dir.join("configs.json");
        let json_data = serde_json::to_string_pretty(&configs)
            .map_err(|e| format!("Failed to serialize configs: {}", e))?;
        fs::write(configs_file, json_data).map_err(|e| format!("Failed to write configs: {}", e))?;
        *self.configs.lock().unwrap() = configs;
        Ok(())
    }

    pub fn get_settings(&self) -> AppSettings {
        self.settings.lock().unwrap().clone()
    }

    pub fn save_settings(&self, settings: AppSettings) -> Result<(), String> {
        let settings_file = self.data_dir.join("settings.json");
        let json_data = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;
        fs::write(settings_file, json_data).map_err(|e| format!("Failed to write settings: {}", e))?;
        *self.settings.lock().unwrap() = settings;
        Ok(())
    }
}
