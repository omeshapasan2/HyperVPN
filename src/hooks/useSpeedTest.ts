import { useState, useRef, useCallback, useEffect } from "react";

export type SpeedTestPhase = "idle" | "ping" | "download" | "upload" | "complete" | "error";

export interface SpeedTestState {
  phase: SpeedTestPhase;
  ping: number | null; // ms
  jitter: number | null; // ms
  downloadSpeed: number | null; // Mbps
  currentDownloadSpeed: number; // live Mbps
  uploadSpeed: number | null; // Mbps
  currentUploadSpeed: number; // live Mbps
  progress: number; // 0 - 100
  errorMessage: string | null;
}

export function useSpeedTest() {
  const [state, setState] = useState<SpeedTestState>({
    phase: "idle",
    ping: null,
    jitter: null,
    downloadSpeed: null,
    currentDownloadSpeed: 0,
    uploadSpeed: null,
    currentUploadSpeed: 0,
    progress: 0,
    errorMessage: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const isRunningRef = useRef(false);

  const stopTest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isRunningRef.current = false;
    setState((prev) => ({
      ...prev,
      phase: prev.phase === "complete" ? "complete" : "idle",
      currentDownloadSpeed: 0,
      currentUploadSpeed: 0,
    }));
  }, []);

  const resetTest = useCallback(() => {
    stopTest();
    setState({
      phase: "idle",
      ping: null,
      jitter: null,
      downloadSpeed: null,
      currentDownloadSpeed: 0,
      uploadSpeed: null,
      currentUploadSpeed: 0,
      progress: 0,
      errorMessage: null,
    });
  }, [stopTest]);

  const startTest = useCallback(async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    setState({
      phase: "ping",
      ping: null,
      jitter: null,
      downloadSpeed: null,
      currentDownloadSpeed: 0,
      uploadSpeed: null,
      currentUploadSpeed: 0,
      progress: 5,
      errorMessage: null,
    });

    try {
      // ==========================================
      // PHASE 1: PING & JITTER TEST (5 iterations)
      // ==========================================
      const pingSamples: number[] = [];
      const PING_COUNT = 5;

      for (let i = 0; i < PING_COUNT; i++) {
        if (signal.aborted) return;
        const start = performance.now();
        const res = await fetch(`https://speed.cloudflare.com/__down?bytes=0&r=${Math.random()}`, {
          signal,
          cache: "no-store",
        });
        await res.text();
        const duration = performance.now() - start;
        pingSamples.push(duration);

        const currentPing = Math.round(
          pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length
        );
        setState((prev) => ({
          ...prev,
          ping: currentPing,
          progress: 5 + Math.round(((i + 1) / PING_COUNT) * 15),
        }));

        // Small pause between pings
        await new Promise((r) => setTimeout(r, 60));
      }

      // Calculate jitter (mean difference between consecutive samples)
      let jitterSum = 0;
      for (let i = 1; i < pingSamples.length; i++) {
        jitterSum += Math.abs(pingSamples[i] - pingSamples[i - 1]);
      }
      const calculatedJitter =
        pingSamples.length > 1 ? Math.round(jitterSum / (pingSamples.length - 1)) : 0;
      const finalPing = Math.round(
        pingSamples.reduce((a, b) => a + b, 0) / pingSamples.length
      );

      setState((prev) => ({
        ...prev,
        phase: "download",
        ping: finalPing,
        jitter: calculatedJitter,
        progress: 25,
      }));

      // ==========================================
      // PHASE 2: DOWNLOAD SPEED TEST (Streaming)
      // ==========================================
      // Use 25MB test payload for accurate high-speed measurement
      const downloadStart = performance.now();
      const downloadRes = await fetch(
        `https://speed.cloudflare.com/__down?bytes=25000000&r=${Math.random()}`,
        {
          signal,
          cache: "no-store",
        }
      );

      if (!downloadRes.body) {
        throw new Error("Unable to read response stream for download test.");
      }

      const reader = downloadRes.body.getReader();
      let receivedBytes = 0;
      let lastUpdate = performance.now();
      let windowBytes = 0;
      let windowStart = performance.now();
      const totalExpectedBytes = 25000000;

      while (true) {
        if (signal.aborted) return;
        const { done, value } = await reader.read();
        if (done) break;

        const len = value ? value.length : 0;
        receivedBytes += len;
        windowBytes += len;

        const now = performance.now();
        // Update live speed roughly every 100ms
        if (now - lastUpdate > 100) {
          const windowSecs = (now - windowStart) / 1000;
          if (windowSecs > 0) {
            const liveMbps = (windowBytes * 8) / (windowSecs * 1000000);
            const downloadProgress = Math.min(
              65,
              25 + (receivedBytes / totalExpectedBytes) * 40
            );
            setState((prev) => ({
              ...prev,
              currentDownloadSpeed: Math.round(liveMbps * 10) / 10,
              progress: Math.round(downloadProgress),
            }));
          }
          windowBytes = 0;
          windowStart = now;
          lastUpdate = now;
        }

        // Cap download test at max 7 seconds to keep test snappy
        if (now - downloadStart > 7000) {
          reader.cancel();
          break;
        }
      }

      const totalDownloadSecs = (performance.now() - downloadStart) / 1000;
      const finalDownloadMbps =
        totalDownloadSecs > 0
          ? Math.round(((receivedBytes * 8) / (totalDownloadSecs * 1000000)) * 10) / 10
          : 0;

      setState((prev) => ({
        ...prev,
        phase: "upload",
        downloadSpeed: finalDownloadMbps,
        currentDownloadSpeed: finalDownloadMbps,
        progress: 70,
      }));

      // ==========================================
      // PHASE 3: UPLOAD SPEED TEST (Multi-chunk POST)
      // ==========================================
      // 3 chunks of 2MB to measure upload
      const uploadChunkSize = 2 * 1024 * 1024; // 2 MB
      const uploadPayload = new Uint8Array(uploadChunkSize);
      // Fill with dummy pattern
      for (let i = 0; i < 1024; i++) {
        uploadPayload[i] = i % 256;
      }

      let totalUploadedBytes = 0;
      const uploadStart = performance.now();
      const UPLOAD_CHUNKS = 4;

      for (let i = 0; i < UPLOAD_CHUNKS; i++) {
        if (signal.aborted) return;
        const chunkStart = performance.now();

        await fetch(`https://speed.cloudflare.com/__up?r=${Math.random()}`, {
          method: "POST",
          body: uploadPayload,
          signal,
          cache: "no-store",
        });

        const chunkDuration = (performance.now() - chunkStart) / 1000;
        totalUploadedBytes += uploadChunkSize;

        const liveUploadMbps =
          chunkDuration > 0
            ? (uploadChunkSize * 8) / (chunkDuration * 1000000)
            : 0;

        const uploadProgress = 70 + Math.round(((i + 1) / UPLOAD_CHUNKS) * 30);

        setState((prev) => ({
          ...prev,
          currentUploadSpeed: Math.round(liveUploadMbps * 10) / 10,
          progress: Math.min(100, uploadProgress),
        }));

        // Cap upload test at 6 seconds max
        if (performance.now() - uploadStart > 6000) {
          break;
        }
      }

      const totalUploadSecs = (performance.now() - uploadStart) / 1000;
      const finalUploadMbps =
        totalUploadSecs > 0
          ? Math.round(((totalUploadedBytes * 8) / (totalUploadSecs * 1000000)) * 10) / 10
          : 0;

      // ==========================================
      // PHASE 4: COMPLETE
      // ==========================================
      setState((prev) => ({
        ...prev,
        phase: "complete",
        uploadSpeed: finalUploadMbps,
        currentUploadSpeed: finalUploadMbps,
        progress: 100,
      }));
    } catch (err: unknown) {
      if (!signal.aborted) {
        const error = err as Error;
        setState((prev) => ({
          ...prev,
          phase: "error",
          errorMessage: error.message || "Speed test failed. Check connection.",
          progress: 0,
        }));
      }
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    state,
    startTest,
    stopTest,
    resetTest,
  };
}
