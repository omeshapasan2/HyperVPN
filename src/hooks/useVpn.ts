import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { VlessConfig, VpnStatus } from "../types/config";

const initialStatus: VpnStatus = {
  connected: false,
  activeConfigId: null,
  connecting: false,
  uptimeSeconds: 0,
  sessionBytesUplink: 0,
  sessionBytesDownlink: 0,
  currentUploadSpeed: 0,
  currentDownloadSpeed: 0,
  error: null,
};

export function useVpn(configs: VlessConfig[] = [], activeConfigId: string | null = null) {
  const [status, setStatus] = useState<VpnStatus>(initialStatus);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch status from backend
  const refreshStatus = useCallback(async () => {
    try {
      const res = await invoke<VpnStatus>("get_vpn_status");
      setStatus((prev) => ({
        ...res,
        connecting: connecting,
        error: prev.error,
      }));
    } catch (err) {
      console.error("Failed to get VPN status:", err);
    }
  }, [connecting]);

  // Connect to a given config
  const connect = useCallback(
    async (configToConnect: VlessConfig) => {
      setConnecting(true);
      setErrorMessage(null);
      try {
        if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
          // Browser preview mock mode
          await new Promise((r) => setTimeout(r, 600));
          setStatus({
            connected: true,
            activeConfigId: configToConnect.id,
            connecting: false,
            uptimeSeconds: 14,
            sessionBytesUplink: 1024 * 512,
            sessionBytesDownlink: 1024 * 1024 * 8,
            currentUploadSpeed: 840 * 1024,
            currentDownloadSpeed: 4.8 * 1024 * 1024,
            error: null,
          });
          return;
        }
        await invoke("connect_vpn", { config: configToConnect });
        await refreshStatus();
      } catch (err) {
        const msg = typeof err === "string" ? err : (err as Error).message || "Failed to connect";
        setErrorMessage(msg);
        console.error("Connect error:", err);
      } finally {
        setConnecting(false);
      }
    },
    [refreshStatus]
  );

  // Disconnect active VPN
  const disconnect = useCallback(async () => {
    setConnecting(true);
    setErrorMessage(null);
    try {
      if (typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
        // Browser preview mock mode
        await new Promise((r) => setTimeout(r, 400));
        setStatus(initialStatus);
        return;
      }
      await invoke("disconnect_vpn");
      await refreshStatus();
    } catch (err) {
      const msg = typeof err === "string" ? err : (err as Error).message || "Failed to disconnect";
      setErrorMessage(msg);
      console.error("Disconnect error:", err);
    } finally {
      setConnecting(false);
    }
  }, [refreshStatus]);

  // Toggle active connection
  const toggleConnect = useCallback(async () => {
    if (status.connected) {
      await disconnect();
    } else {
      let activeCfg = configs.find((c) => c.id === activeConfigId) || configs[0];
      if (!activeCfg) {
        try {
          const saved = await invoke<VlessConfig[]>("get_saved_configs");
          const storedActiveId = localStorage.getItem("hypervpn_active_config_id");
          activeCfg = saved.find((c) => c.id === storedActiveId) || saved[0];
        } catch (err) {
          console.error("Failed to load configs on tray toggle:", err);
        }
      }

      if (activeCfg) {
        await connect(activeCfg);
      } else {
        setErrorMessage("Please select or add a VLESS configuration first");
      }
    }
  }, [status.connected, configs, activeConfigId, connect, disconnect]);

  // Poll status every 1 second while connected or connecting
  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 1000);
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Listen for backend events
  useEffect(() => {
    let unlistenStatus: (() => void) | undefined;
    let unlistenTrayToggle: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenStatus = await listen<boolean>("vpn-status-changed", () => {
        refreshStatus();
      });

      unlistenTrayToggle = await listen("tray-toggle-vpn", () => {
        toggleConnect();
      });
    };

    setupListeners();

    return () => {
      if (unlistenStatus) unlistenStatus();
      if (unlistenTrayToggle) unlistenTrayToggle();
    };
  }, [refreshStatus, toggleConnect]);

  return {
    status: {
      ...status,
      connecting,
      error: errorMessage,
    },
    connect,
    disconnect,
    toggleConnect,
    clearError: () => setErrorMessage(null),
  };
}
