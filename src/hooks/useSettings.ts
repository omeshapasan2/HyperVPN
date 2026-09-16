import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { AppSettings, UpdateCheckResult } from "../types/config";

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
  const [isElevated, setIsElevated] = useState<boolean>(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState<boolean>(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const saved = await invoke<AppSettings>("get_app_settings");
      // Check OS autostart state
      try {
        const autostartActive = await isEnabled();
        saved.autoStart = autostartActive;
      } catch {
        // Fallback to direct registry check on Windows
        try {
          const regActive = await invoke<boolean>("get_windows_autostart");
          saved.autoStart = regActive;
        } catch {
          // Keep saved
        }
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

  const checkElevation = useCallback(async () => {
    try {
      const elevated = await invoke<boolean>("is_elevated");
      setIsElevated(elevated);
    } catch (err) {
      console.error("Failed to check elevation:", err);
    }
  }, []);

  const relaunchAsAdmin = useCallback(async () => {
    try {
      await invoke("relaunch_as_admin");
    } catch (err) {
      console.error("Failed to relaunch as admin:", err);
    }
  }, []);

  const checkForUpdates = useCallback(async () => {
    setCheckingUpdate(true);
    setUpdateError(null);
    try {
      const result = await invoke<UpdateCheckResult>("check_for_updates");
      setUpdateInfo(result);
    } catch (err) {
      const msg = typeof err === "string" ? err : (err as Error).message || "Failed to check for updates";
      setUpdateError(msg);
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      await invoke("save_app_settings", { settings: newSettings });

      // Handle autostart toggle via plugin and registry
      try {
        if (newSettings.autoStart) {
          await enable();
        } else {
          await disable();
        }
      } catch {
        // Direct registry fallback
        await invoke("set_windows_autostart", { enabled: newSettings.autoStart }).catch(() => {});
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    checkBinaries();
    checkElevation();
  }, [fetchSettings, checkBinaries, checkElevation]);

  return {
    settings,
    binaries,
    isElevated,
    updateInfo,
    checkingUpdate,
    updateError,
    loading,
    saveSettings,
    checkBinaries,
    checkElevation,
    relaunchAsAdmin,
    checkForUpdates,
    refreshSettings: fetchSettings,
  };
}
