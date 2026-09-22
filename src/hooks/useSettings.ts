import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { check, Update, DownloadEvent } from "@tauri-apps/plugin-updater";
import {
  AppSettings,
  UpdateCheckResult,
  AppUpdateInfo,
  AppUpdateProgress,
  BinariesUpdateCheckResult,
  BinaryUpdateProgress,
} from "../types/config";

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

  // Tauri Built-in Updater State
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [appUpdateProgress, setAppUpdateProgress] = useState<AppUpdateProgress | null>(null);
  const [installingAppUpdate, setInstallingAppUpdate] = useState<boolean>(false);
  const activeUpdateRef = useRef<Update | null>(null);

  // Core Binaries In-App Updater states
  const [binariesUpdateInfo, setBinariesUpdateInfo] = useState<BinariesUpdateCheckResult | null>(null);
  const [checkingBinariesUpdate, setCheckingBinariesUpdate] = useState<boolean>(false);
  const [binariesUpdateProgress, setBinariesUpdateProgress] = useState<BinaryUpdateProgress | null>(null);
  const [updatingBinaries, setUpdatingBinaries] = useState<boolean>(false);
  const [binariesUpdateError, setBinariesUpdateError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const saved = await invoke<AppSettings>("get_app_settings");
      // Check OS autostart state (Task Scheduler on Windows for elevated UAC compatibility)
      try {
        const autostartActive = await invoke<boolean>("get_windows_autostart");
        saved.autoStart = autostartActive;
      } catch {
        // Fallback to tauri plugin check
        try {
          const pluginActive = await isEnabled();
          saved.autoStart = pluginActive;
        } catch {
          // Keep saved from storage
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
    setAppUpdateProgress({ status: "checking", message: "Checking for updates..." });

    try {
      // 1. Check with Tauri's built-in updater plugin
      const update = await check();
      if (update) {
        activeUpdateRef.current = update;
        const info: AppUpdateInfo = {
          version: update.version,
          currentVersion: update.currentVersion,
          date: update.date,
          body: update.body,
          available: true,
        };
        setAppUpdateInfo(info);
        setAppUpdateProgress({
          status: "available",
          message: `Update v${update.version} available!`,
        });

        // Also populate legacy updateInfo for compatibility
        setUpdateInfo({
          currentVersion: update.currentVersion,
          latestVersion: update.version,
          hasUpdate: true,
          releaseNotes: update.body || "",
          downloadUrl: `https://github.com/omeshapasan2/HyperVPN/releases/tag/v${update.version}`,
          publishedAt: update.date || new Date().toISOString(),
        });
        return;
      }

      // No update from Tauri plugin (or up to date)
      activeUpdateRef.current = null;
      setAppUpdateInfo({
        version: "",
        currentVersion: "",
        available: false,
      });
      setAppUpdateProgress({
        status: "up-to-date",
        message: "You are running the latest version.",
      });

      // Query legacy version info to get accurate current version string
      try {
        const legacyResult = await invoke<UpdateCheckResult>("check_for_updates");
        setUpdateInfo(legacyResult);
        if (legacyResult.currentVersion) {
          setAppUpdateInfo({
            version: legacyResult.latestVersion,
            currentVersion: legacyResult.currentVersion,
            available: legacyResult.hasUpdate,
            body: legacyResult.releaseNotes,
          });
        }
      } catch {
        // Ignore fallback error
      }
    } catch (pluginErr) {
      console.warn("Tauri updater check failed, falling back to GitHub API check:", pluginErr);

      // Fallback to GitHub releases check via Rust command
      try {
        const result = await invoke<UpdateCheckResult>("check_for_updates");
        setUpdateInfo(result);
        setAppUpdateInfo({
          version: result.latestVersion,
          currentVersion: result.currentVersion,
          body: result.releaseNotes,
          available: result.hasUpdate,
          date: result.publishedAt,
        });

        if (result.hasUpdate) {
          setAppUpdateProgress({
            status: "available",
            message: `Update v${result.latestVersion} available!`,
          });
        } else {
          setAppUpdateProgress({
            status: "up-to-date",
            message: "You are running the latest version.",
          });
        }
      } catch (fallbackErr) {
        const msg =
          typeof fallbackErr === "string"
            ? fallbackErr
            : (fallbackErr as Error).message ||
              (typeof pluginErr === "string" ? pluginErr : (pluginErr as Error)?.message) ||
              "Failed to check for updates";
        setUpdateError(msg);
        setAppUpdateProgress({
          status: "error",
          error: msg,
          message: msg,
        });
      }
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  const installAppUpdate = useCallback(async () => {
    if (!activeUpdateRef.current) {
      // Fallback: If no active Tauri updater session, open release page
      if (updateInfo?.downloadUrl) {
        window.open(updateInfo.downloadUrl, "_blank");
      }
      return;
    }

    setInstallingAppUpdate(true);
    setUpdateError(null);
    setAppUpdateProgress({
      status: "downloading",
      percent: 0,
      downloadedBytes: 0,
      message: "Starting update download...",
    });

    let totalLength = 0;
    let downloadedSoFar = 0;

    try {
      await activeUpdateRef.current.downloadAndInstall((event: DownloadEvent) => {
        switch (event.event) {
          case "Started":
            totalLength = event.data.contentLength || 0;
            setAppUpdateProgress({
              status: "downloading",
              totalBytes: totalLength,
              downloadedBytes: 0,
              percent: 0,
              message: totalLength > 0
                ? `Downloading update (0/${(totalLength / (1024 * 1024)).toFixed(1)} MB)...`
                : "Downloading update package...",
            });
            break;

          case "Progress":
            downloadedSoFar += event.data.chunkLength;
            const pct =
              totalLength > 0 ? Math.min(99, Math.round((downloadedSoFar / totalLength) * 100)) : 0;
            const downloadedMB = (downloadedSoFar / (1024 * 1024)).toFixed(1);
            const totalMB = totalLength > 0 ? (totalLength / (1024 * 1024)).toFixed(1) : "?";
            setAppUpdateProgress({
              status: "downloading",
              totalBytes: totalLength,
              downloadedBytes: downloadedSoFar,
              percent: pct,
              message: `Downloading update (${downloadedMB}/${totalMB} MB - ${pct}%)...`,
            });
            break;

          case "Finished":
            setAppUpdateProgress({
              status: "installing",
              percent: 100,
              downloadedBytes: totalLength,
              totalBytes: totalLength,
              message: "Download verified. Installing update and restarting HyperVPN...",
            });
            break;
        }
      });

      // On Windows, downloadAndInstall will execute passive NSIS install and terminate app
      setAppUpdateProgress({
        status: "restarting",
        percent: 100,
        message: "Update applied. Restarting application...",
      });
    } catch (err) {
      console.error("Failed to download and install update:", err);
      const msg = typeof err === "string" ? err : (err as Error).message || "Update installation failed";
      setUpdateError(msg);
      setAppUpdateProgress({
        status: "error",
        error: msg,
        message: msg,
      });
    } finally {
      setInstallingAppUpdate(false);
    }
  }, [updateInfo]);

  const checkCoreBinariesUpdates = useCallback(async () => {
    setCheckingBinariesUpdate(true);
    setBinariesUpdateError(null);
    try {
      const result = await invoke<BinariesUpdateCheckResult>("check_core_binaries_updates");
      setBinariesUpdateInfo(result);
      return result;
    } catch (err) {
      const msg = typeof err === "string" ? err : (err as Error).message || "Failed to check core binaries updates";
      setBinariesUpdateError(msg);
      return null;
    } finally {
      setCheckingBinariesUpdate(false);
    }
  }, []);

  const updateCoreBinaries = useCallback(async (binariesToUpdate?: string[]) => {
    setUpdatingBinaries(true);
    setBinariesUpdateError(null);
    try {
      const result = await invoke<BinariesUpdateCheckResult>("update_core_binaries", {
        binariesToUpdate: binariesToUpdate || null,
      });
      setBinariesUpdateInfo(result);
      await checkBinaries();
    } catch (err) {
      const msg = typeof err === "string" ? err : (err as Error).message || "Failed to update core binaries";
      setBinariesUpdateError(msg);
    } finally {
      setUpdatingBinaries(false);
    }
  }, [checkBinaries]);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
      await invoke("save_app_settings", { settings: newSettings });

      // Ensure Windows Task Scheduler autostart is synchronized
      try {
        await invoke("set_windows_autostart", { enabled: newSettings.autoStart });
      } catch (err) {
        console.warn("set_windows_autostart error:", err);
      }

      // Also sync plugin state if available
      try {
        if (newSettings.autoStart) {
          await enable();
        } else {
          await disable();
        }
      } catch {
        // Ignore plugin fallback errors
      }
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    checkBinaries();
    checkElevation();

    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      unlisten = await listen<BinaryUpdateProgress>("binaries-update-progress", (event) => {
        setBinariesUpdateProgress(event.payload);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchSettings, checkBinaries, checkElevation]);

  return {
    settings,
    binaries,
    isElevated,
    updateInfo,
    checkingUpdate,
    updateError,
    appUpdateInfo,
    appUpdateProgress,
    installingAppUpdate,
    binariesUpdateInfo,
    checkingBinariesUpdate,
    binariesUpdateProgress,
    updatingBinaries,
    binariesUpdateError,
    loading,
    saveSettings,
    checkBinaries,
    checkElevation,
    relaunchAsAdmin,
    checkForUpdates,
    installAppUpdate,
    checkCoreBinariesUpdates,
    updateCoreBinaries,
    refreshSettings: fetchSettings,
  };
}
