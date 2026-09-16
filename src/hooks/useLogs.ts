import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LogEntry } from "../types/config";

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await invoke<LogEntry[]>("get_system_logs");
      setLogs(res);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    fetchLogs();

    let unlisten: (() => void) | undefined;
    const setupListener = async () => {
      unlisten = await listen<LogEntry>("log-entry", (event) => {
        setLogs((prev) => {
          const next = [...prev, event.payload];
          if (next.length > 500) {
            return next.slice(next.length - 500);
          }
          return next;
        });
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchLogs]);

  return {
    logs,
    clearLogs,
    refreshLogs: fetchLogs,
  };
}
