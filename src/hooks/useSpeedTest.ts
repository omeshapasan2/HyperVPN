import { useState, useRef, useCallback, useEffect } from "react";

export type SpeedTestPhase = "idle" | "ping" | "download" | "upload" | "complete" | "error";

export interface SpeedTestState {
  phase: SpeedTestPhase;
  ping: number | null; // ms
  jitter: number | null; // ms
  downloadSpeed: number | null; // final Mbps
  currentDownloadSpeed: number; // live smoothed Mbps
  uploadSpeed: number | null; // final Mbps
  currentUploadSpeed: number; // live smoothed Mbps
  progress: number; // 0 - 100
  errorMessage: string | null;
}

// Rolling sample window for accurate throughput calculation
interface ByteSample {
  timestamp: number;
  bytes: number;
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
      progress: 2,
      errorMessage: null,
    });

    try {
      // ==============================================================
      // PHASE 1: LATENCY & JITTER BENCHMARK (8 sequential samples)
      // ==============================================================
      const pingSamples: number[] = [];
      const PING_COUNT = 8;

      for (let i = 0; i < PING_COUNT; i++) {
        if (signal.aborted) return;
        const start = performance.now();
        const res = await fetch(
          `https://speed.cloudflare.com/__down?bytes=0&r=${Math.random()}`,
          { signal, cache: "no-store" }
        );
        await res.text();
        const duration = performance.now() - start;
        pingSamples.push(duration);

        // Sort and discard highest outlier for robust latency
        const sorted = [...pingSamples].sort((a, b) => a - b);
        const trimmed = sorted.length > 3 ? sorted.slice(0, -1) : sorted;
        const currentPing = Math.round(
          trimmed.reduce((a, b) => a + b, 0) / trimmed.length
        );

        setState((prev) => ({
          ...prev,
          ping: currentPing,
          progress: 2 + Math.round(((i + 1) / PING_COUNT) * 13), // 2% -> 15%
        }));

        await new Promise((r) => setTimeout(r, 60));
      }

      // Calculate Jitter (RFC 3550 standard mean deviation between consecutive packets)
      let jitterSum = 0;
      for (let i = 1; i < pingSamples.length; i++) {
        jitterSum += Math.abs(pingSamples[i] - pingSamples[i - 1]);
      }
      const calculatedJitter =
        pingSamples.length > 1
          ? Math.round(jitterSum / (pingSamples.length - 1))
          : 0;

      const sortedPings = [...pingSamples].sort((a, b) => a - b);
      const medianPing = Math.round(sortedPings[Math.floor(sortedPings.length / 2)]);

      setState((prev) => ({
        ...prev,
        phase: "download",
        ping: medianPing,
        jitter: calculatedJitter,
        progress: 15,
      }));

      // ==============================================================
      // PHASE 2: MULTI-STREAM CONCURRENT DOWNLOAD TEST (10 seconds)
      // Saturates gigabit/high-speed connections using 5 parallel streams
      // ==============================================================
      const DOWNLOAD_DURATION_MS = 10000;
      const DOWNLOAD_CONCURRENCY = 5;
      const downloadStartTime = performance.now();
      const downloadSamples: ByteSample[] = [];
      const liveDownloadSpeedHistory: number[] = [];
      let smoothedDownloadMbps = 0;

      // Update ticker for download speed
      let downloadTickerRunning = true;
      const downloadTickerPromise = (async () => {
        while (downloadTickerRunning && !signal.aborted) {
          const now = performance.now();
          const elapsed = now - downloadStartTime;

          // Prune samples older than 1200ms for a smooth rolling throughput window
          const cutoff = now - 1200;
          while (downloadSamples.length > 0 && downloadSamples[0].timestamp < cutoff) {
            downloadSamples.shift();
          }

          if (downloadSamples.length > 1) {
            const windowBytes = downloadSamples.reduce((sum, s) => sum + s.bytes, 0);
            const windowDurationSec = (now - downloadSamples[0].timestamp) / 1000;

            if (windowDurationSec > 0.2) {
              const instantMbps = (windowBytes * 8) / (windowDurationSec * 1_000_000);
              // Exponential Moving Average filter (alpha = 0.25) to avoid abrupt jumps
              smoothedDownloadMbps =
                smoothedDownloadMbps === 0
                  ? instantMbps
                  : smoothedDownloadMbps * 0.75 + instantMbps * 0.25;

              // Record samples after warm-up (first 2 seconds)
              if (elapsed > 2000) {
                liveDownloadSpeedHistory.push(instantMbps);
              }

              const prog = Math.min(58, 15 + (elapsed / DOWNLOAD_DURATION_MS) * 45);
              setState((prev) => ({
                ...prev,
                currentDownloadSpeed: Math.round(smoothedDownloadMbps * 10) / 10,
                progress: Math.round(prog),
              }));
            }
          }

          await new Promise((r) => setTimeout(r, 80));
        }
      })();

      // Worker function: streams 50MB chunks continuously until time is up
      const runDownloadWorker = async () => {
        while (
          performance.now() - downloadStartTime < DOWNLOAD_DURATION_MS &&
          !signal.aborted
        ) {
          try {
            // 50MB payload per stream ensures maximum throughput pipeline
            const res = await fetch(
              `https://speed.cloudflare.com/__down?bytes=50000000&r=${Math.random()}`,
              { signal, cache: "no-store" }
            );

            if (!res.body) break;
            const reader = res.body.getReader();

            while (!signal.aborted) {
              if (performance.now() - downloadStartTime >= DOWNLOAD_DURATION_MS) {
                reader.cancel();
                break;
              }

              const { done, value } = await reader.read();
              if (done) break;

              if (value && value.length > 0) {
                downloadSamples.push({
                  timestamp: performance.now(),
                  bytes: value.length,
                });
              }
            }
          } catch (e: any) {
            if (signal.aborted) break;
            // retry worker if error occurs before timeout
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      };

      // Spawn concurrent workers
      await Promise.all(
        Array.from({ length: DOWNLOAD_CONCURRENCY }, () => runDownloadWorker())
      );

      downloadTickerRunning = false;
      await downloadTickerPromise;

      if (signal.aborted) return;

      // Final download speed calculation: 85th percentile of sustained window
      let finalDownloadMbps = smoothedDownloadMbps;
      if (liveDownloadSpeedHistory.length > 0) {
        liveDownloadSpeedHistory.sort((a, b) => a - b);
        const p85Index = Math.floor(liveDownloadSpeedHistory.length * 0.85);
        finalDownloadMbps = liveDownloadSpeedHistory[p85Index];
      }
      finalDownloadMbps = Math.round(finalDownloadMbps * 10) / 10;

      setState((prev) => ({
        ...prev,
        phase: "upload",
        downloadSpeed: finalDownloadMbps,
        currentDownloadSpeed: finalDownloadMbps,
        progress: 60,
      }));

      // Small cooldown before upload phase
      await new Promise((r) => setTimeout(r, 400));

      // ==============================================================
      // PHASE 3: MULTI-STREAM CONCURRENT UPLOAD TEST (8 seconds)
      // Concurrent chunk uploads to Cloudflare edge
      // ==============================================================
      const UPLOAD_DURATION_MS = 8000;
      const UPLOAD_CONCURRENCY = 4;
      const UPLOAD_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB chunks
      const uploadPayload = new Uint8Array(UPLOAD_CHUNK_SIZE);
      // Pre-fill payload
      for (let i = 0; i < 2048; i++) {
        uploadPayload[i] = (i * 31) % 256;
      }

      const uploadStartTime = performance.now();
      const uploadSamples: ByteSample[] = [];
      const liveUploadSpeedHistory: number[] = [];
      let smoothedUploadMbps = 0;

      let uploadTickerRunning = true;
      const uploadTickerPromise = (async () => {
        while (uploadTickerRunning && !signal.aborted) {
          const now = performance.now();
          const elapsed = now - uploadStartTime;

          // Prune samples older than 1500ms
          const cutoff = now - 1500;
          while (uploadSamples.length > 0 && uploadSamples[0].timestamp < cutoff) {
            uploadSamples.shift();
          }

          if (uploadSamples.length > 0) {
            const windowBytes = uploadSamples.reduce((sum, s) => sum + s.bytes, 0);
            const windowDurationSec = (now - uploadSamples[0].timestamp) / 1000;

            if (windowDurationSec > 0.3) {
              const instantMbps = (windowBytes * 8) / (windowDurationSec * 1_000_000);
              smoothedUploadMbps =
                smoothedUploadMbps === 0
                  ? instantMbps
                  : smoothedUploadMbps * 0.75 + instantMbps * 0.25;

              if (elapsed > 1500) {
                liveUploadSpeedHistory.push(instantMbps);
              }

              const prog = Math.min(98, 60 + (elapsed / UPLOAD_DURATION_MS) * 38);
              setState((prev) => ({
                ...prev,
                currentUploadSpeed: Math.round(smoothedUploadMbps * 10) / 10,
                progress: Math.round(prog),
              }));
            }
          }

          await new Promise((r) => setTimeout(r, 80));
        }
      })();

      const runUploadWorker = async () => {
        while (
          performance.now() - uploadStartTime < UPLOAD_DURATION_MS &&
          !signal.aborted
        ) {
          try {
            await fetch(`https://speed.cloudflare.com/__up?r=${Math.random()}`, {
              method: "POST",
              body: uploadPayload,
              signal,
              cache: "no-store",
            });

            if (signal.aborted) break;
            uploadSamples.push({
              timestamp: performance.now(),
              bytes: UPLOAD_CHUNK_SIZE,
            });
          } catch (e) {
            if (signal.aborted) break;
            await new Promise((r) => setTimeout(r, 100));
          }
        }
      };

      await Promise.all(
        Array.from({ length: UPLOAD_CONCURRENCY }, () => runUploadWorker())
      );

      uploadTickerRunning = false;
      await uploadTickerPromise;

      if (signal.aborted) return;

      let finalUploadMbps = smoothedUploadMbps;
      if (liveUploadSpeedHistory.length > 0) {
        liveUploadSpeedHistory.sort((a, b) => a - b);
        const p85Index = Math.floor(liveUploadSpeedHistory.length * 0.85);
        finalUploadMbps = liveUploadSpeedHistory[p85Index];
      }
      finalUploadMbps = Math.round(finalUploadMbps * 10) / 10;

      // ==============================================================
      // PHASE 4: BENCHMARK COMPLETE
      // ==============================================================
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
