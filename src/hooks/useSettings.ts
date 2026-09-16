import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { AppSettings } from "../types/config";

export interface BinariesStatus {
  xrayFound: boolean;
  xrayPath?: string;
  tun2socksFound: boolean;
  tun2socksPath?: string;
  wintunFound: boolean;
  wintunPath?: string;
  ready: boolean;
}

const defaultSettings: AppSettings = {
  autoStart: false,
  autoConnectOnLaunch: false,
  minimizeToTrayOnClose: true,
  socksPort: 10808,
  statsPort: 10085,
  customLanExclusions: [],
  defaultIsp: "slt",
  slt: {
    subscriberId: "",
    token: "",
    clientId: "",
  },
  dialog: {
    msisdn: "",
    uuid: "",
    cookie: "",
    selectedUsageTypeIndex: 0,
  },
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [binaries, setBinaries] = useState<BinariesStatus>({
    xrayFound: false,
    tun2socksFound: false,
    wintunFound: false,
    ready: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const saved = await invoke<AppSettings>("get_app_settings");
      // Check OS autostart state
      try {
        const autostartActive = await isEnabled();
        saved.autoStart = autostartActive;
      } catch {
        // Plugin might fail in non-packaged dev environment, fallback to saved
      }
      setSettings(saved);
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const checkBinaries = useCallback(async () => {
    try {
      const status = await invoke<BinariesStatus>("check_binaries_status");
      setBinaries(status);
    } catch (err) {
      console.error("Failed to check binaries status:", err);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      await invoke("save_app_settings", { settings: newSettings });

      // Handle autostart toggle
      try {
        if (newSettings.autoStart) {
          await enable();
        } else {
          await disable();
        }
      } catch (err) {
        console.warn("Autostart plugin enable/disable failed:", err);
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    checkBinaries();
  }, [fetchSettings, checkBinaries]);

  return {
    settings,
    binaries,
    loading,
    saveSettings,
    checkBinaries,
    refreshSettings: fetchSettings,
  };
}
