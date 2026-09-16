import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { UsageHistory } from "../types/config";

export function useUsage() {
  const [history, setHistory] = useState<UsageHistory>({ daily: {}, monthly: {} });
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await invoke<UsageHistory>("get_usage_history");
      setHistory(res);
    } catch (err) {
      console.error("Failed to fetch usage history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const resetHistory = useCallback(async () => {
    try {
      await invoke("reset_usage_history");
      await fetchHistory();
    } catch (err) {
      console.error("Failed to reset usage history:", err);
    }
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [fetchHistory]);

  return {
    history,
    loading,
    refreshHistory: fetchHistory,
    resetHistory,
  };
}
