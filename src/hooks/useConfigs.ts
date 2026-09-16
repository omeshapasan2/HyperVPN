import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { VlessConfig } from "../types/config";
import { parseVlessUri, serializeVlessUri } from "../utils/vless";

export function useConfigs(onActiveConfigSwitched?: (newConfig: VlessConfig) => void) {
  const [configs, setConfigs] = useState<VlessConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pingingIds, setPingingIds] = useState<Set<string>>(new Set());

  // Load configs from storage on startup
  const loadConfigs = useCallback(async () => {
    try {
      const saved = await invoke<VlessConfig[]>("get_saved_configs");
      setConfigs(saved);
      if (saved.length > 0) {
        // Read activeConfigId from localStorage or default to first
        const storedActiveId = localStorage.getItem("hypervpn_active_config_id");
        if (storedActiveId && saved.some((c) => c.id === storedActiveId)) {
          setActiveConfigId(storedActiveId);
        } else {
          setActiveConfigId(saved[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load configs from storage:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Save configs to Rust backend
  const persistConfigs = async (newConfigs: VlessConfig[]) => {
    setConfigs(newConfigs);
    try {
      await invoke("save_configs", { configs: newConfigs });
    } catch (err) {
      console.error("Failed to save configs:", err);
    }
  };

  // Select active config
  const selectActiveConfig = useCallback(
    (id: string) => {
      setActiveConfigId(id);
      localStorage.setItem("hypervpn_active_config_id", id);
      const cfg = configs.find((c) => c.id === id);
      if (cfg && onActiveConfigSwitched) {
        onActiveConfigSwitched(cfg);
      }
    },
    [configs, onActiveConfigSwitched]
  );

  // Add config from vless URI
  const addFromUri = useCallback(
    async (rawUri: string): Promise<{ success: boolean; config?: VlessConfig; error?: string }> => {
      try {
        const parsed = parseVlessUri(rawUri);
        const updated = [parsed, ...configs];
        await persistConfigs(updated);
        if (!activeConfigId) {
          selectActiveConfig(parsed.id);
        }
        return { success: true, config: parsed };
      } catch (err) {
        const msg = (err as Error).message || "Failed to parse VLESS URI";
        return { success: false, error: msg };
      }
    },
    [configs, activeConfigId, selectActiveConfig]
  );

  // Save or update config
  const saveConfig = useCallback(
    async (config: VlessConfig) => {
      const index = configs.findIndex((c) => c.id === config.id);
      let updated: VlessConfig[];
      if (index >= 0) {
        updated = [...configs];
        updated[index] = { ...config, updatedAt: Date.now() };
      } else {
        updated = [config, ...configs];
      }
      await persistConfigs(updated);
    },
    [configs]
  );

  // Delete config
  const deleteConfig = useCallback(
    async (id: string) => {
      const updated = configs.filter((c) => c.id !== id);
      await persistConfigs(updated);
      if (activeConfigId === id) {
        const nextId = updated.length > 0 ? updated[0].id : null;
        setActiveConfigId(nextId);
        if (nextId) {
          localStorage.setItem("hypervpn_active_config_id", nextId);
        } else {
          localStorage.removeItem("hypervpn_active_config_id");
        }
      }
    },
    [configs, activeConfigId]
  );

  // Copy config to clipboard as serialized vless:// URI
  const copyConfigUri = useCallback(async (config: VlessConfig): Promise<boolean> => {
    try {
      const uri = serializeVlessUri(config);
      await writeText(uri);
      return true;
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      return false;
    }
  }, []);

  // Ping a single config
  const pingSingleConfig = useCallback(
    async (configId: string) => {
      const config = configs.find((c) => c.id === configId);
      if (!config) return;

      setPingingIds((prev) => new Set(prev).add(configId));
      try {
        const res = await invoke<{ success: boolean; latencyMs?: number; error?: string }>("ping_config", {
          host: config.host,
          port: config.port,
          timeoutMs: 5000,
        });

        const latency = res.success && res.latencyMs !== undefined ? res.latencyMs : -1;
        const updated = configs.map((c) =>
          c.id === configId ? { ...c, latency, lastTested: Date.now() } : c
        );
        await persistConfigs(updated);
      } catch (err) {
        console.error(`Ping failed for ${config.host}:`, err);
        const updated = configs.map((c) =>
          c.id === configId ? { ...c, latency: -1, lastTested: Date.now() } : c
        );
        await persistConfigs(updated);
      } finally {
        setPingingIds((prev) => {
          const next = new Set(prev);
          next.delete(configId);
          return next;
        });
      }
    },
    [configs]
  );

  // Ping all configs in parallel
  const pingAll = useCallback(async () => {
    for (const config of configs) {
      pingSingleConfig(config.id);
    }
  }, [configs, pingSingleConfig]);

  return {
    configs,
    activeConfigId,
    activeConfig: configs.find((c) => c.id === activeConfigId) || configs[0] || null,
    loading,
    pingingIds,
    selectActiveConfig,
    addFromUri,
    saveConfig,
    deleteConfig,
    copyConfigUri,
    pingSingleConfig,
    pingAll,
  };
}
